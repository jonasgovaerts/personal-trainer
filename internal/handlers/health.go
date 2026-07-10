package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/user/personal-trainer/internal/db"
	"github.com/user/personal-trainer/internal/models"
	"gorm.io/gorm"
)

const maxHealthBody = 20 << 20 // 20 MB

// ---- Health Auto Export payload (tolerant) ----

// hkValue accepts either {"qty":N,"units":"..."} or a bare number.
type hkValue struct {
	Qty   float64
	Units string
}

func (v *hkValue) UnmarshalJSON(b []byte) error {
	// Try object form first.
	var obj struct {
		Qty   float64 `json:"qty"`
		Units string  `json:"units"`
	}
	if err := json.Unmarshal(b, &obj); err == nil && (obj.Qty != 0 || obj.Units != "") {
		v.Qty = obj.Qty
		v.Units = obj.Units
		return nil
	}
	// Fall back to a bare number.
	var n float64
	if err := json.Unmarshal(b, &n); err == nil {
		v.Qty = n
		return nil
	}
	return nil // ignore unknown shapes rather than failing the whole import
}

type hkMetricPoint struct {
	Date string  `json:"date"`
	Qty  float64 `json:"qty"`
	Min  float64 `json:"Min"`
	Max  float64 `json:"Max"`
	Avg  float64 `json:"Avg"`
}

type hkMetric struct {
	Name  string          `json:"name"`
	Units string          `json:"units"`
	Data  []hkMetricPoint `json:"data"`
}

type hkWorkout struct {
	ID                 string  `json:"id"`
	Name               string  `json:"name"`
	Start              string  `json:"start"`
	End                string  `json:"end"`
	Duration           float64 `json:"duration"`
	ActiveEnergyBurned hkValue `json:"activeEnergyBurned"`
	TotalEnergy        hkValue `json:"totalEnergy"`
	AvgHeartRate       hkValue `json:"avgHeartRate"`
	MaxHeartRate       hkValue `json:"maxHeartRate"`
	StepCount          hkValue `json:"stepCount"`
	Distance           hkValue `json:"distance"`
}

type hkPayload struct {
	Data struct {
		Metrics  []hkMetric  `json:"metrics"`
		Workouts []hkWorkout `json:"workouts"`
	} `json:"data"`
}

var hkDateLayouts = []string{
	"2006-01-02 15:04:05 -0700",
	"2006-01-02 15:04:05 Z",
	"2006-01-02 15:04:05 -07:00",
	time.RFC3339,
	"2006-01-02",
}

func parseHKDate(s string) (time.Time, bool) {
	s = strings.TrimSpace(s)
	for _, l := range hkDateLayouts {
		if t, err := time.Parse(l, s); err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}

// toKcal converts an energy value to kcal (Health Auto Export may send kJ).
func toKcal(v hkValue) float64 {
	if strings.EqualFold(strings.TrimSpace(v.Units), "kJ") {
		return v.Qty * 0.239006
	}
	return v.Qty
}

// toKM converts a distance value to kilometres (may arrive as mi/m/km).
func toKM(v hkValue) float64 {
	switch strings.ToLower(strings.TrimSpace(v.Units)) {
	case "mi", "mile", "miles":
		return v.Qty * 1.609344
	case "m", "meter", "meters":
		return v.Qty / 1000
	default:
		return v.Qty // assume km
	}
}

func isDuplicateActivity(a, b models.HealthActivity) bool {
	// 1. Start times within 2 minutes
	timeDiff := a.Start.Sub(b.Start)
	if timeDiff < 0 {
		timeDiff = -timeDiff
	}
	if timeDiff > 2*time.Minute {
		return false
	}

	// 2. Durations within 10 seconds
	durDiff := a.DurationSec - b.DurationSec
	if durDiff < 0 {
		durDiff = -durDiff
	}
	if durDiff > 10 {
		return false
	}

	// 3. Distance within 0.05 km
	distDiff := a.DistanceKM - b.DistanceKM
	if distDiff < 0 {
		distDiff = -distDiff
	}
	if distDiff > 0.05 {
		return false
	}

	// 4. If both have heart rate > 0, avg heart rate within 3 bpm
	if a.AvgHeartRate > 0 && b.AvgHeartRate > 0 {
		hrDiff := a.AvgHeartRate - b.AvgHeartRate
		if hrDiff < 0 {
			hrDiff = -hrDiff
		}
		if hrDiff > 3 {
			return false
		}
	}

	return true
}

// IngestHealth accepts a Health Auto Export JSON POST authenticated by X-API-Key.
func IngestHealth(w http.ResponseWriter, r *http.Request) {
	key := r.Header.Get("X-API-Key")
	if key == "" {
		key = r.URL.Query().Get("key")
	}
	if key == "" {
		respondError(w, http.StatusUnauthorized, "Missing API key")
		return
	}

	var user models.User
	if err := db.DB.Where("health_api_key = ?", key).First(&user).Error; err != nil {
		respondError(w, http.StatusUnauthorized, "Invalid API key")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxHealthBody)
	var payload hkPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid payload")
		return
	}

	// Aggregate metric sample points in memory per (name, day) before writing:
	// cumulative types (qty) are summed; rate types keep min / max / mean(avg).
	type metricAgg struct {
		name          string
		day           time.Time
		units         string
		qty           float64
		min, max      float64
		avgSum        float64
		avgN          int
		hasMin        bool
	}
	aggs := map[string]*metricAgg{}
	for _, m := range payload.Data.Metrics {
		name := strings.ToLower(strings.TrimSpace(m.Name))
		if name == "" {
			continue
		}
		isEnergyKJ := strings.Contains(name, "energy") && strings.EqualFold(m.Units, "kJ")
		for _, p := range m.Data {
			ts, ok := parseHKDate(p.Date)
			if !ok {
				continue
			}
			day := ts.Truncate(24 * time.Hour)
			key := name + "|" + day.Format("2006-01-02")
			a := aggs[key]
			if a == nil {
				a = &metricAgg{name: name, day: day, units: m.Units}
				aggs[key] = a
			}
			qty := p.Qty
			if isEnergyKJ {
				qty *= 0.239006
			}
			a.qty += qty
			if p.Avg > 0 {
				a.avgSum += p.Avg
				a.avgN++
			}
			if p.Max > a.max {
				a.max = p.Max
			}
			if p.Min > 0 && (!a.hasMin || p.Min < a.min) {
				a.min = p.Min
				a.hasMin = true
			}
		}
	}

	// Write the aggregates in one transaction (replace existing day rows).
	metricsImported := len(aggs)
	db.DB.Transaction(func(tx *gorm.DB) error {
		for _, a := range aggs {
			avg := 0.0
			if a.avgN > 0 {
				avg = a.avgSum / float64(a.avgN)
			}
			vals := map[string]interface{}{"min": a.min, "max": a.max, "avg": avg, "qty": a.qty, "units": a.units}
			var existing models.HealthMetric
			if err := tx.Where("user_id = ? AND name = ? AND date = ?", user.ID, a.name, a.day).First(&existing).Error; err == nil {
				tx.Model(&existing).Updates(vals)
			} else {
				tx.Create(&models.HealthMetric{
					UserID: user.ID, Name: a.name, Date: a.day,
					Min: a.min, Max: a.max, Avg: avg, Qty: a.qty, Units: a.units,
				})
			}
		}
		return nil
	})

	// Parse incoming activities
	var incoming []models.HealthActivity
	for _, wo := range payload.Data.Workouts {
		start, ok := parseHKDate(wo.Start)
		if !ok {
			continue
		}
		end, _ := parseHKDate(wo.End)
		ext := wo.ID
		if ext == "" {
			ext = fmt.Sprintf("%s|%s", wo.Start, wo.Name)
		}

		activity := models.HealthActivity{
			UserID:           user.ID,
			ExternalID:       ext,
			Name:             wo.Name,
			Start:            start,
			End:              end,
			DurationSec:      int(wo.Duration),
			ActiveEnergyKcal: toKcal(wo.ActiveEnergyBurned),
			TotalEnergyKcal:  toKcal(wo.TotalEnergy),
			DistanceKM:       toKM(wo.Distance),
			AvgHeartRate:     int(wo.AvgHeartRate.Qty),
			MaxHeartRate:     int(wo.MaxHeartRate.Qty),
			StepCount:        int(wo.StepCount.Qty),
		}
		incoming = append(incoming, activity)
	}

	// Deduplicate inside payload (keep lowest calorie one)
	var deduplicatedIncoming []models.HealthActivity
	for _, inc := range incoming {
		foundIdx := -1
		for idx, existingInc := range deduplicatedIncoming {
			if isDuplicateActivity(inc, existingInc) {
				foundIdx = idx
				break
			}
		}

		if foundIdx >= 0 {
			if inc.ActiveEnergyKcal < deduplicatedIncoming[foundIdx].ActiveEnergyKcal {
				deduplicatedIncoming[foundIdx] = inc
			}
		} else {
			deduplicatedIncoming = append(deduplicatedIncoming, inc)
		}
	}

	activitiesImported := 0
	for _, act := range deduplicatedIncoming {
		// 1. Check exact ExternalID first (fast, ID match)
		var exactExisting models.HealthActivity
		if err := db.DB.Where("user_id = ? AND external_id = ?", user.ID, act.ExternalID).First(&exactExisting).Error; err == nil {
			if act.ActiveEnergyKcal < exactExisting.ActiveEnergyKcal {
				exactExisting.ActiveEnergyKcal = act.ActiveEnergyKcal
				exactExisting.TotalEnergyKcal = act.TotalEnergyKcal
				db.DB.Save(&exactExisting)
			}
			continue
		}

		// 2. Check duplicate activities within a 1-hour window of the start time
		var potentialDupes []models.HealthActivity
		db.DB.Where("user_id = ? AND start >= ? AND start <= ?", user.ID, act.Start.Add(-1*time.Hour), act.Start.Add(1*time.Hour)).Find(&potentialDupes)

		isDupe := false
		for _, dbDupe := range potentialDupes {
			if isDuplicateActivity(act, dbDupe) {
				isDupe = true
				if act.ActiveEnergyKcal < dbDupe.ActiveEnergyKcal {
					dbDupe.ActiveEnergyKcal = act.ActiveEnergyKcal
					dbDupe.TotalEnergyKcal = act.TotalEnergyKcal
					db.DB.Save(&dbDupe)
				}
				break
			}
		}

		if !isDupe {
			if err := db.DB.Create(&act).Error; err == nil {
				activitiesImported++
			}
		}
	}

	respondJSON(w, http.StatusOK, map[string]int{
		"metrics_imported":    metricsImported,
		"activities_imported": activitiesImported,
	})
}

// GetHealthActivities lists imported activities for the current user (newest first).
func GetHealthActivities(w http.ResponseWriter, r *http.Request) {
	user := GetCurrentUser(r)
	q := db.DB.Where("user_id = ?", user.ID)
	if d := r.URL.Query().Get("days"); d != "" {
		if days, err := strconv.Atoi(d); err == nil && days > 0 {
			q = q.Where("start >= ?", time.Now().AddDate(0, 0, -days))
		}
	}
	var activities []models.HealthActivity
	q.Order("start desc").Limit(200).Find(&activities)
	respondJSON(w, http.StatusOK, activities)
}

// GetHealthMetrics returns daily metric points, optionally filtered by name and range.
func GetHealthMetrics(w http.ResponseWriter, r *http.Request) {
	user := GetCurrentUser(r)
	q := db.DB.Where("user_id = ?", user.ID)
	if name := r.URL.Query().Get("name"); name != "" {
		q = q.Where("name = ?", strings.ToLower(name))
	}
	if d := r.URL.Query().Get("days"); d != "" {
		if days, err := strconv.Atoi(d); err == nil && days > 0 {
			q = q.Where("date >= ?", time.Now().AddDate(0, 0, -days).Truncate(24*time.Hour))
		}
	}
	var metrics []models.HealthMetric
	q.Order("date asc").Find(&metrics)
	respondJSON(w, http.StatusOK, metrics)
}

// GenerateHealthKey creates or rotates the current user's Health ingest API key.
func GenerateHealthKey(w http.ResponseWriter, r *http.Request) {
	user := GetCurrentUser(r)

	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to generate key")
		return
	}
	key := "hae_" + hex.EncodeToString(buf)

	if err := db.DB.Model(&models.User{}).Where("id = ?", user.ID).Update("health_api_key", key).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to save key")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"health_api_key": key})
}

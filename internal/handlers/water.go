package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/user/personal-trainer/internal/db"
	"github.com/user/personal-trainer/internal/models"
)

// GetWaterLogs returns the current user's hydration entries, newest first.
func GetWaterLogs(w http.ResponseWriter, r *http.Request) {
	user := GetCurrentUser(r)

	dateParam := r.URL.Query().Get("date")
	daysStr := r.URL.Query().Get("days")

	var logs []models.WaterLog
	if dateParam != "" {
		db.DB.Where("user_id = ? AND DATE(timestamp) = ?", user.ID, dateParam).Order("timestamp desc").Find(&logs)
	} else if daysStr != "" {
		days := 1
		if v, err := strconv.Atoi(daysStr); err == nil && v > 0 {
			days = v
		}
		cutoff := time.Now().AddDate(0, 0, -days).Truncate(24 * time.Hour)
		db.DB.Where("user_id = ? AND timestamp >= ?", user.ID, cutoff).Order("timestamp desc").Find(&logs)
	} else {
		today := time.Now().Format("2006-01-02")
		db.DB.Where("user_id = ? AND DATE(timestamp) = ?", user.ID, today).Order("timestamp desc").Find(&logs)
	}

	respondJSON(w, http.StatusOK, logs)
}

// LogWater adds a hydration entry (millilitres) for the current user.
func LogWater(w http.ResponseWriter, r *http.Request) {
	var req models.WaterLog
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	if req.ML == 0 {
		respondError(w, http.StatusBadRequest, "ml is required")
		return
	}

	user := GetCurrentUser(r)
	req.ID = 0
	req.UserID = user.ID
	if req.Timestamp.IsZero() {
		req.Timestamp = time.Now()
	}

	if err := db.DB.Create(&req).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to log water")
		return
	}

	respondJSON(w, http.StatusCreated, req)
}

// DeleteWaterLog removes a hydration entry owned by the current user.
func DeleteWaterLog(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid water log ID")
		return
	}

	user := GetCurrentUser(r)
	result := db.DB.Where("id = ? AND user_id = ?", id, user.ID).Delete(&models.WaterLog{})
	if result.Error != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete water log")
		return
	}
	if result.RowsAffected == 0 {
		respondError(w, http.StatusNotFound, "Water log not found")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Water log deleted successfully"})
}

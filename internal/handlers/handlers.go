package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/user/personal-trainer/internal/db"
	"github.com/user/personal-trainer/internal/models"
)

// Helper for JSON responses
func respondJSON(w http.ResponseWriter, status int, payload interface{}) {
	response, err := json.Marshal(payload)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("Interne Serverfout"))
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	w.Write(response)
}

// Helper for JSON errors
func respondError(w http.ResponseWriter, code int, message string) {
	log.Printf("ERROR: %d - %s", code, message)
	respondJSON(w, code, map[string]string{"error": message})
}

// --- User Handlers ---

// GetUser fetches a user by ID
func GetUser(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Ongeldig gebruikers ID")
		return
	}

	var user models.User
	if err := db.DB.Preload("Equipment").First(&user, id).Error; err != nil {
		respondError(w, http.StatusNotFound, "Gebruiker niet gevonden")
		return
	}

	respondJSON(w, http.StatusOK, user)
}

// UpdateUserEquipment updates the equipment available to a user
func UpdateUserEquipment(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	userID, err := strconv.Atoi(idStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Ongeldig gebruikers ID")
		return
	}

	var req struct {
		EquipmentIDs []uint `json:"equipment_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Ongeldige aanvraaggegevens")
		return
	}

	var user models.User
	if err := db.DB.First(&user, userID).Error; err != nil {
		// Create user if not exists for simplicity in this prototype
		user = models.User{Username: "speler_" + idStr, HockeyPosition: "Aanvaller"}
		user.ID = uint(userID)
		db.DB.Create(&user)
	}

	var equipment []models.Equipment
	if len(req.EquipmentIDs) > 0 {
		db.DB.Find(&equipment, req.EquipmentIDs)
	}

	// Replace existing associations
	if err := db.DB.Model(&user).Association("Equipment").Replace(&equipment); err != nil {
		respondError(w, http.StatusInternalServerError, "Fout bij bijwerken van materiaal")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Materiaal succesvol bijgewerkt"})
}

// UpdateUserProfile updates the user's personal metrics and goals
func UpdateUserProfile(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	userID, err := strconv.Atoi(idStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Ongeldig gebruikers ID")
		return
	}

	var req models.User
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Ongeldige aanvraaggegevens")
		return
	}

	var user models.User
	if err := db.DB.First(&user, userID).Error; err != nil {
		// Create user if not exists for simplicity in this prototype
		user = models.User{Username: "speler_" + idStr, HockeyPosition: "Aanvaller"}
		user.ID = uint(userID)
		db.DB.Create(&user)
	}

	// Update fields
	user.Name = req.Name
	user.Gender = req.Gender
	user.BirthDate = req.BirthDate
	user.Height = req.Height
	user.CurrentWeight = req.CurrentWeight
	user.TargetWeight = req.TargetWeight
	user.ActivityLevel = req.ActivityLevel
	user.GoalCalories = req.GoalCalories
	user.GoalProtein = req.GoalProtein
	user.GoalCarbs = req.GoalCarbs
	user.GoalFat = req.GoalFat

	if req.LastWeightUpdate.IsZero() {
		user.LastWeightUpdate = time.Now()
	} else {
		user.LastWeightUpdate = req.LastWeightUpdate
	}

	if err := db.DB.Save(&user).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Fout bij opslaan van profiel")
		return
	}

	respondJSON(w, http.StatusOK, user)
}

// --- Exercise Handlers ---

// GetExercises fetches all exercises, optionally filtered by user_id's equipment
func GetExercises(w http.ResponseWriter, r *http.Request) {
	userIDStr := r.URL.Query().Get("user_id")

	var exercises []models.Exercise
	
	if userIDStr != "" {
		userID, err := strconv.Atoi(userIDStr)
		if err == nil {
			var user models.User
			if err := db.DB.Preload("Equipment").First(&user, userID).Error; err == nil {
				// Get IDs of user's equipment
				userEqMap := make(map[uint]bool)
				for _, eq := range user.Equipment {
					userEqMap[eq.ID] = true
				}
				
				// Always assume the user has Bodyweight ("Lichaamsgewicht") available
				var bwEq models.Equipment
				if err := db.DB.Where("name = ?", "Lichaamsgewicht").First(&bwEq).Error; err == nil {
					userEqMap[bwEq.ID] = true
				}

				// Fetch all exercises
				var allExercises []models.Exercise
				db.DB.Preload("Equipment").Find(&allExercises)

				// Filter exercises where user has AT LEAST ONE of the valid equipment options
				for _, ex := range allExercises {
					if len(ex.Equipment) == 0 {
						exercises = append(exercises, ex)
						continue
					}

					hasAny := false
					for _, reqEq := range ex.Equipment {
						if userEqMap[reqEq.ID] {
							hasAny = true
							break
						}
					}
					if hasAny {
						exercises = append(exercises, ex)
					}
				}
				
				respondJSON(w, http.StatusOK, exercises)
				return
			}
		}
	}

	// Default: return all exercises
	db.DB.Preload("Equipment").Find(&exercises)
	respondJSON(w, http.StatusOK, exercises)
}

// GetEquipment fetches all available equipment
func GetEquipment(w http.ResponseWriter, r *http.Request) {
	var equipment []models.Equipment
	db.DB.Find(&equipment)
	respondJSON(w, http.StatusOK, equipment)
}

// --- Workout Handlers ---

// CreateWorkout creates a new workout session
func CreateWorkout(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID uint   `json:"user_id"`
		Notes  string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Ongeldige aanvraaggegevens")
		return
	}

	workout := models.Workout{
		UserID: req.UserID,
		Notes:  req.Notes,
		Date:   time.Now(),
	}

	if err := db.DB.Create(&workout).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Fout bij aanmaken van sessie")
		return
	}

	respondJSON(w, http.StatusCreated, workout)
}

// LogWorkoutSet adds a set/rep log to a workout
func LogWorkoutSet(w http.ResponseWriter, r *http.Request) {
	workoutIDStr := r.PathValue("id")
	workoutID, err := strconv.Atoi(workoutIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Ongeldig sessie ID")
		return
	}

	var req models.WorkoutLog
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Ongeldige aanvraaggegevens")
		return
	}
	req.WorkoutID = uint(workoutID)
	req.Completed = true

	if err := db.DB.Create(&req).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Fout bij loggen van set")
		return
	}

	respondJSON(w, http.StatusCreated, req)
}

// GetWorkoutHistory gets past workouts for a user
func GetWorkoutHistory(w http.ResponseWriter, r *http.Request) {
	userIDStr := r.URL.Query().Get("user_id")
	if userIDStr == "" {
		respondError(w, http.StatusBadRequest, "Ontbrekende user_id parameter")
		return
	}
	
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Ongeldig user_id")
		return
	}

	var workouts []models.Workout
	db.DB.Preload("Logs.Exercise").Where("user_id = ?", userID).Order("date desc").Find(&workouts)

	respondJSON(w, http.StatusOK, workouts)
}

// DeleteWorkout deletes a workout and its logs
func DeleteWorkout(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Ongeldig sessie ID")
		return
	}

	// Delete associated logs first
	if err := db.DB.Where("workout_id = ?", id).Delete(&models.WorkoutLog{}).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Fout bij verwijderen van logs")
		return
	}

	// Delete the workout
	if err := db.DB.Delete(&models.Workout{}, id).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Fout bij verwijderen van sessie")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Sessie succesvol verwijderd"})
}

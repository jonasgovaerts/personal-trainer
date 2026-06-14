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

// GetCurrentUser retrieves the logged-in user from Authentik headers or defaults to ID 1 in development
func GetCurrentUser(r *http.Request) models.User {
	username := r.Header.Get("X-Authentik-Username")
	name := r.Header.Get("X-Authentik-Name")
	if name == "" {
		name = r.Header.Get("X-Authentik-Email")
	}

	if username == "" {
		// Fallback to user ID 1 in development
		var user models.User
		if err := db.DB.Preload("Equipment").First(&user, 1).Error; err != nil {
			// Auto-create user 1 if not exists
			user = models.User{
				ID:             1,
				Username:       "devuser",
				Name:           "Developer User",
				GoalCalories:   2500,
				GoalProtein:    150,
				GoalCarbs:      250,
				GoalFat:        80,
				HockeyPosition: "Aanvaller",
			}
			db.DB.Create(&user)
		}
		return user
	}

	var user models.User
	if err := db.DB.Preload("Equipment").Where("username = ?", username).First(&user).Error; err != nil {
		log.Printf("Auto-provisioning new user '%s' (%s)", username, name)
		// Auto-provision user on first login
		user = models.User{
			Username:       username,
			Name:           name,
			GoalCalories:   2500,
			GoalProtein:    150,
			GoalCarbs:      250,
			GoalFat:        80,
			HockeyPosition: "Aanvaller",
		}
		db.DB.Create(&user)
	}
	return user
}

// --- User Handlers ---

// GetUser fetches a user by ID or 'me'
func GetUser(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	var user models.User

	if idStr == "me" {
		user = GetCurrentUser(r)
	} else {
		id, err := strconv.Atoi(idStr)
		if err != nil {
			respondError(w, http.StatusBadRequest, "Ongeldig gebruikers ID")
			return
		}

		if err := db.DB.Preload("Equipment").First(&user, id).Error; err != nil {
			respondError(w, http.StatusNotFound, "Gebruiker niet gevonden")
			return
		}
	}

	respondJSON(w, http.StatusOK, user)
}

// UpdateUserEquipment updates the equipment available to a user
func UpdateUserEquipment(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	var user models.User

	if idStr == "me" {
		user = GetCurrentUser(r)
	} else {
		userID, err := strconv.Atoi(idStr)
		if err != nil {
			respondError(w, http.StatusBadRequest, "Ongeldig gebruikers ID")
			return
		}

		if err := db.DB.First(&user, userID).Error; err != nil {
			// Create user if not exists for simplicity in this prototype
			user = models.User{Username: "speler_" + idStr, HockeyPosition: "Aanvaller"}
			user.ID = uint(userID)
			db.DB.Create(&user)
		}
	}

	var req struct {
		EquipmentIDs []uint `json:"equipment_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Ongeldige aanvraaggegevens")
		return
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
	var user models.User

	if idStr == "me" {
		user = GetCurrentUser(r)
	} else {
		userID, err := strconv.Atoi(idStr)
		if err != nil {
			respondError(w, http.StatusBadRequest, "Ongeldig gebruikers ID")
			return
		}

		if err := db.DB.First(&user, userID).Error; err != nil {
			// Create user if not exists for simplicity in this prototype
			user = models.User{Username: "speler_" + idStr, HockeyPosition: "Aanvaller"}
			user.ID = uint(userID)
			db.DB.Create(&user)
		}
	}

	var req models.User
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Ongeldige aanvraaggegevens")
		return
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
	var user models.User
	var hasUser bool

	if userIDStr == "me" || (userIDStr == "" && r.Header.Get("X-Authentik-Username") != "") {
		user = GetCurrentUser(r)
		hasUser = true
	} else if userIDStr != "" {
		userID, err := strconv.Atoi(userIDStr)
		if err == nil {
			if err := db.DB.Preload("Equipment").First(&user, userID).Error; err == nil {
				hasUser = true
			}
		}
	}

	if hasUser {
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
		UserID   uint   `json:"user_id"`
		Notes    string `json:"notes"`
		ImageURL string `json:"image_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Ongeldige aanvraaggegevens")
		return
	}

	if req.UserID == 0 {
		user := GetCurrentUser(r)
		req.UserID = user.ID
	}

	workout := models.Workout{
		UserID:   req.UserID,
		Notes:    req.Notes,
		ImageURL: req.ImageURL,
		Date:     time.Now(),
	}

	if err := db.DB.Create(&workout).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Fout bij aanmaken van sessie")
		return
	}

	respondJSON(w, http.StatusCreated, workout)
}

// UpdateWorkout updates an existing workout session
func UpdateWorkout(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Ongeldig sessie ID")
		return
	}

	var workout models.Workout
	if err := db.DB.First(&workout, id).Error; err != nil {
		respondError(w, http.StatusNotFound, "Sessie niet gevonden")
		return
	}

	var req struct {
		Notes          string `json:"notes"`
		ImageURL       string `json:"image_url"`
		CaloriesBurned int    `json:"calories_burned"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Ongeldige aanvraaggegevens")
		return
	}

	workout.Notes = req.Notes
	workout.ImageURL = req.ImageURL
	workout.CaloriesBurned = req.CaloriesBurned

	if err := db.DB.Save(&workout).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Fout bij bijwerken van sessie")
		return
	}

	respondJSON(w, http.StatusOK, workout)
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
	var userID int

	if userIDStr == "" || userIDStr == "me" {
		user := GetCurrentUser(r)
		userID = int(user.ID)
	} else {
		var err error
		userID, err = strconv.Atoi(userIDStr)
		if err != nil {
			respondError(w, http.StatusBadRequest, "Ongeldig user_id")
			return
		}
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

package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/user/personal-trainer/internal/auth"
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

// GetCurrentUser retrieves the logged-in user from the OIDC session, auto-provisioning
// the database record on first login. The RequireAuth middleware guarantees a session
// is present before any handler runs.
func GetCurrentUser(r *http.Request) models.User {
	session, ok := auth.UserFromContext(r.Context())
	if !ok {
		// Should never happen behind RequireAuth; return an empty user defensively.
		log.Println("WARN: GetCurrentUser called without an authenticated session")
		return models.User{}
	}

	var user models.User
	if err := db.DB.Preload("Equipment").Where("username = ?", session.Username).First(&user).Error; err != nil {
		log.Printf("Auto-provisioning new user '%s' (%s)", session.Username, session.Name)
		// Auto-provision user on first login
		user = models.User{
			Username:       session.Username,
			Name:           session.Name,
			GoalCalories:   2500,
			GoalProtein:    150,
			GoalCarbs:      250,
			GoalFat:        80,
			GoalWaterML:    2500,
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
	if req.GoalWaterML > 0 {
		user.GoalWaterML = req.GoalWaterML
	}

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

// GetExercises returns the global (seeded) exercises filtered by the user's available
// equipment, plus all of the user's own custom exercises (unfiltered).
func GetExercises(w http.ResponseWriter, r *http.Request) {
	user := GetCurrentUser(r)

	// Build the set of equipment IDs the user has, always including Bodyweight.
	userEqMap := make(map[uint]bool)
	for _, eq := range user.Equipment {
		userEqMap[eq.ID] = true
	}
	var bwEq models.Equipment
	if err := db.DB.Where("name = ?", "Lichaamsgewicht").First(&bwEq).Error; err == nil {
		userEqMap[bwEq.ID] = true
	}

	// Global exercises, filtered so the user has at least one required piece of equipment.
	var globalExercises []models.Exercise
	db.DB.Preload("Equipment").Where("user_id IS NULL").Find(&globalExercises)

	exercises := make([]models.Exercise, 0, len(globalExercises))
	for _, ex := range globalExercises {
		if len(ex.Equipment) == 0 {
			exercises = append(exercises, ex)
			continue
		}
		for _, reqEq := range ex.Equipment {
			if userEqMap[reqEq.ID] {
				exercises = append(exercises, ex)
				break
			}
		}
	}

	// Append the user's own custom exercises unconditionally.
	var customExercises []models.Exercise
	db.DB.Preload("Equipment").Where("user_id = ?", user.ID).Find(&customExercises)
	exercises = append(exercises, customExercises...)

	respondJSON(w, http.StatusOK, exercises)
}

// exerciseRequest is the payload for creating/updating a custom exercise.
type exerciseRequest struct {
	Name          string `json:"name"`
	Description   string `json:"description"`
	HockeyBenefit string `json:"hockey_benefit"`
	VideoURL      string `json:"video_url"`
	ImageURL      string `json:"image_url"`
	EquipmentIDs  []uint `json:"equipment_ids"`
}

// CreateExercise creates a custom exercise owned by the current user.
func CreateExercise(w http.ResponseWriter, r *http.Request) {
	var req exerciseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "Exercise name is required")
		return
	}

	user := GetCurrentUser(r)
	uid := user.ID
	exercise := models.Exercise{
		UserID:        &uid,
		Name:          req.Name,
		Description:   req.Description,
		HockeyBenefit: req.HockeyBenefit,
		VideoURL:      req.VideoURL,
		ImageURL:      req.ImageURL,
	}
	if err := db.DB.Create(&exercise).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create exercise")
		return
	}
	assignEquipment(&exercise, req.EquipmentIDs)

	db.DB.Preload("Equipment").First(&exercise, exercise.ID)
	respondJSON(w, http.StatusCreated, exercise)
}

// UpdateExercise updates a custom exercise owned by the current user. Global (seeded)
// exercises cannot be edited.
func UpdateExercise(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid exercise ID")
		return
	}

	user := GetCurrentUser(r)
	var exercise models.Exercise
	if err := db.DB.Where("id = ? AND user_id = ?", id, user.ID).First(&exercise).Error; err != nil {
		respondError(w, http.StatusNotFound, "Exercise not found")
		return
	}

	var req exerciseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "Exercise name is required")
		return
	}

	exercise.Name = req.Name
	exercise.Description = req.Description
	exercise.HockeyBenefit = req.HockeyBenefit
	exercise.VideoURL = req.VideoURL
	exercise.ImageURL = req.ImageURL
	if err := db.DB.Save(&exercise).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to update exercise")
		return
	}
	assignEquipment(&exercise, req.EquipmentIDs)

	db.DB.Preload("Equipment").First(&exercise, exercise.ID)
	respondJSON(w, http.StatusOK, exercise)
}

// DeleteExercise deletes a custom exercise owned by the current user, along with any of the
// user's routine entries that reference it.
func DeleteExercise(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid exercise ID")
		return
	}

	user := GetCurrentUser(r)
	var exercise models.Exercise
	if err := db.DB.Where("id = ? AND user_id = ?", id, user.ID).First(&exercise).Error; err != nil {
		respondError(w, http.StatusNotFound, "Exercise not found")
		return
	}

	// Remove references from this user's routines to avoid dangling entries.
	db.DB.Where("exercise_id = ?", exercise.ID).Delete(&models.RoutineExercise{})
	db.DB.Model(&exercise).Association("Equipment").Clear()
	if err := db.DB.Delete(&exercise).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete exercise")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Exercise deleted successfully"})
}

// assignEquipment replaces an exercise's equipment associations with the given IDs.
func assignEquipment(exercise *models.Exercise, equipmentIDs []uint) {
	if equipmentIDs == nil {
		return
	}
	var equipment []models.Equipment
	if len(equipmentIDs) > 0 {
		db.DB.Where("id IN ?", equipmentIDs).Find(&equipment)
	}
	db.DB.Model(exercise).Association("Equipment").Replace(equipment)
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

	if req.UserID == 0 {
		user := GetCurrentUser(r)
		req.UserID = user.ID
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

	query := db.DB.Preload("Logs.Exercise").Where("user_id = ?", userID)
	if daysStr := r.URL.Query().Get("days"); daysStr != "" {
		if days, err := strconv.Atoi(daysStr); err == nil && days > 0 {
			cutoff := time.Now().AddDate(0, 0, -days)
			query = query.Where("date >= ?", cutoff)
		}
	}

	var workouts []models.Workout
	query.Order("date desc").Find(&workouts)

	respondJSON(w, http.StatusOK, workouts)
}

// UpdateWorkout updates a workout's notes and replaces its logged sets (owner-scoped).
func UpdateWorkout(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Ongeldig sessie ID")
		return
	}

	user := GetCurrentUser(r)
	var workout models.Workout
	if err := db.DB.Where("id = ? AND user_id = ?", id, user.ID).First(&workout).Error; err != nil {
		respondError(w, http.StatusNotFound, "Sessie niet gevonden")
		return
	}

	var req struct {
		Notes          string              `json:"notes"`
		CaloriesBurned int                 `json:"calories_burned"`
		Logs           []models.WorkoutLog `json:"logs"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Ongeldige aanvraaggegevens")
		return
	}

	workout.Notes = req.Notes
	workout.CaloriesBurned = req.CaloriesBurned

	// Replace logs wholesale.
	if err := db.DB.Where("workout_id = ?", workout.ID).Delete(&models.WorkoutLog{}).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Fout bij bijwerken van sets")
		return
	}
	for i := range req.Logs {
		req.Logs[i].ID = 0
		req.Logs[i].WorkoutID = workout.ID
	}
	if len(req.Logs) > 0 {
		if err := db.DB.Create(&req.Logs).Error; err != nil {
			respondError(w, http.StatusInternalServerError, "Fout bij bijwerken van sets")
			return
		}
	}
	if err := db.DB.Save(&workout).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Fout bij bijwerken van sessie")
		return
	}

	db.DB.Preload("Logs.Exercise").First(&workout, workout.ID)
	respondJSON(w, http.StatusOK, workout)
}

// DeleteWorkout deletes a workout and its logs (owner-scoped)
func DeleteWorkout(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Ongeldig sessie ID")
		return
	}

	user := GetCurrentUser(r)
	var workout models.Workout
	if err := db.DB.Where("id = ? AND user_id = ?", id, user.ID).First(&workout).Error; err != nil {
		respondError(w, http.StatusNotFound, "Sessie niet gevonden")
		return
	}

	// Delete associated logs first
	if err := db.DB.Where("workout_id = ?", workout.ID).Delete(&models.WorkoutLog{}).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Fout bij verwijderen van logs")
		return
	}

	if err := db.DB.Delete(&workout).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Fout bij verwijderen van sessie")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Sessie succesvol verwijderd"})
}

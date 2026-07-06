package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/user/personal-trainer/internal/db"
	"github.com/user/personal-trainer/internal/models"
	"gorm.io/gorm"
)

// GetRoutines returns all saved workout routines (with exercises) for the current user.
func GetRoutines(w http.ResponseWriter, r *http.Request) {
	user := GetCurrentUser(r)

	var routines []models.WorkoutRoutine
	db.DB.
		Preload("Exercises", func(tx *gorm.DB) *gorm.DB { return tx.Order("position asc") }).
		Preload("Exercises.Exercise").
		Where("user_id = ?", user.ID).
		Order("created_at desc").
		Find(&routines)

	respondJSON(w, http.StatusOK, routines)
}

// CreateRoutine saves a new workout routine with its ordered exercises.
func CreateRoutine(w http.ResponseWriter, r *http.Request) {
	var req models.WorkoutRoutine
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "Routine name is required")
		return
	}
	if len(req.Exercises) == 0 {
		respondError(w, http.StatusBadRequest, "A routine needs at least one exercise")
		return
	}

	user := GetCurrentUser(r)
	req.UserID = user.ID
	req.ID = 0
	for i := range req.Exercises {
		req.Exercises[i].ID = 0
		req.Exercises[i].RoutineID = 0
		req.Exercises[i].Position = i
	}

	if err := db.DB.Create(&req).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to save routine")
		return
	}

	respondJSON(w, http.StatusCreated, req)
}

// UpdateRoutine replaces the name and exercises of an existing routine owned by the current user.
func UpdateRoutine(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid routine ID")
		return
	}

	user := GetCurrentUser(r)
	var routine models.WorkoutRoutine
	if err := db.DB.Where("id = ? AND user_id = ?", id, user.ID).First(&routine).Error; err != nil {
		respondError(w, http.StatusNotFound, "Routine not found")
		return
	}

	var req models.WorkoutRoutine
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "Routine name is required")
		return
	}
	if len(req.Exercises) == 0 {
		respondError(w, http.StatusBadRequest, "A routine needs at least one exercise")
		return
	}

	routine.Name = req.Name

	// Replace exercises wholesale.
	if err := db.DB.Where("routine_id = ?", routine.ID).Delete(&models.RoutineExercise{}).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to update routine exercises")
		return
	}
	for i := range req.Exercises {
		req.Exercises[i].ID = 0
		req.Exercises[i].RoutineID = routine.ID
		req.Exercises[i].Position = i
	}
	if err := db.DB.Create(&req.Exercises).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to update routine exercises")
		return
	}
	if err := db.DB.Save(&routine).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to update routine")
		return
	}

	routine.Exercises = req.Exercises
	respondJSON(w, http.StatusOK, routine)
}

// DeleteRoutine deletes a routine (and its exercises) owned by the current user.
func DeleteRoutine(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid routine ID")
		return
	}

	user := GetCurrentUser(r)
	var routine models.WorkoutRoutine
	if err := db.DB.Where("id = ? AND user_id = ?", id, user.ID).First(&routine).Error; err != nil {
		respondError(w, http.StatusNotFound, "Routine not found")
		return
	}

	db.DB.Where("routine_id = ?", routine.ID).Delete(&models.RoutineExercise{})
	if err := db.DB.Delete(&routine).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete routine")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Routine deleted successfully"})
}

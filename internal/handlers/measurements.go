package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/user/personal-trainer/internal/db"
	"github.com/user/personal-trainer/internal/models"
)

// GetBodyMeasurements fetches the body measurement history for the current user, newest first.
func GetBodyMeasurements(w http.ResponseWriter, r *http.Request) {
	user := GetCurrentUser(r)

	var measurements []models.BodyMeasurement
	db.DB.Where("user_id = ?", user.ID).Order("timestamp desc").Find(&measurements)

	respondJSON(w, http.StatusOK, measurements)
}

// LogBodyMeasurement adds a new body measurement entry for the current user.
func LogBodyMeasurement(w http.ResponseWriter, r *http.Request) {
	var req models.BodyMeasurement
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	user := GetCurrentUser(r)
	req.UserID = user.ID
	req.ID = 0

	if req.Timestamp.IsZero() {
		req.Timestamp = time.Now()
	}

	if err := db.DB.Create(&req).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to log measurement")
		return
	}

	// Keep the profile weight in sync when a weight is included
	if req.WeightKG > 0 {
		db.DB.Model(&models.User{}).Where("id = ?", user.ID).Updates(map[string]interface{}{
			"current_weight":     req.WeightKG,
			"last_weight_update": req.Timestamp,
		})
	}

	respondJSON(w, http.StatusCreated, req)
}

// DeleteBodyMeasurement deletes a measurement entry owned by the current user.
func DeleteBodyMeasurement(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid measurement ID")
		return
	}

	user := GetCurrentUser(r)
	result := db.DB.Where("id = ? AND user_id = ?", id, user.ID).Delete(&models.BodyMeasurement{})
	if result.Error != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete measurement")
		return
	}
	if result.RowsAffected == 0 {
		respondError(w, http.StatusNotFound, "Measurement not found")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Measurement deleted successfully"})
}

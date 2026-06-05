package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/user/personal-trainer/internal/db"
	"github.com/user/personal-trainer/internal/models"
)

// GetNutritionLogs fetches nutrition logs for a user
func GetNutritionLogs(w http.ResponseWriter, r *http.Request) {
	userIDStr := r.URL.Query().Get("user_id")
	if userIDStr == "" {
		respondError(w, http.StatusBadRequest, "Missing user_id parameter")
		return
	}
	
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid user_id")
		return
	}

	daysStr := r.URL.Query().Get("days")
	days := 0
	if daysStr != "" {
		days, _ = strconv.Atoi(daysStr)
	}

	var logs []models.NutritionLog
	if days > 0 {
		startDate := time.Now().AddDate(0, 0, -days).Format("2006-01-02")
		db.DB.Where("user_id = ? AND DATE(timestamp) >= ?", userID, startDate).Order("timestamp desc").Find(&logs)
	} else {
		today := time.Now().Format("2006-01-02")
		db.DB.Where("user_id = ? AND DATE(timestamp) = ?", userID, today).Order("timestamp desc").Find(&logs)
	}

	respondJSON(w, http.StatusOK, logs)
}

// LogNutrition adds a nutrition log
func LogNutrition(w http.ResponseWriter, r *http.Request) {
	var req models.NutritionLog
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if req.UserID == 0 {
		req.UserID = 1 // Hardcode for prototype
	}

	if req.Timestamp.IsZero() {
		req.Timestamp = time.Now()
	}

	if err := db.DB.Create(&req).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to log nutrition")
		return
	}

	respondJSON(w, http.StatusCreated, req)
}

// DeleteNutritionLog deletes a specific nutrition log
func DeleteNutritionLog(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid log ID")
		return
	}

	if err := db.DB.Delete(&models.NutritionLog{}, id).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete log")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Log deleted successfully"})
}

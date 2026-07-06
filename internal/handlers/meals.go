package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/user/personal-trainer/internal/db"
	"github.com/user/personal-trainer/internal/models"
)

// GetMeals fetches all saved meals (with items) for the current user.
func GetMeals(w http.ResponseWriter, r *http.Request) {
	user := GetCurrentUser(r)

	var meals []models.Meal
	db.DB.Preload("Items").Where("user_id = ?", user.ID).Order("created_at desc").Find(&meals)

	respondJSON(w, http.StatusOK, meals)
}

// CreateMeal saves a new reusable meal with its items.
func CreateMeal(w http.ResponseWriter, r *http.Request) {
	var req models.Meal
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "Meal name is required")
		return
	}
	if len(req.Items) == 0 {
		respondError(w, http.StatusBadRequest, "A meal needs at least one item")
		return
	}

	user := GetCurrentUser(r)
	req.UserID = user.ID
	req.ID = 0
	if req.Servings <= 0 {
		req.Servings = 1
	}
	for i := range req.Items {
		req.Items[i].ID = 0
		req.Items[i].MealID = 0
	}

	if err := db.DB.Create(&req).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to save meal")
		return
	}

	respondJSON(w, http.StatusCreated, req)
}

// UpdateMeal replaces the name and items of an existing meal owned by the current user.
func UpdateMeal(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid meal ID")
		return
	}

	user := GetCurrentUser(r)
	var meal models.Meal
	if err := db.DB.Where("id = ? AND user_id = ?", id, user.ID).First(&meal).Error; err != nil {
		respondError(w, http.StatusNotFound, "Meal not found")
		return
	}

	var req models.Meal
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "Meal name is required")
		return
	}
	if len(req.Items) == 0 {
		respondError(w, http.StatusBadRequest, "A meal needs at least one item")
		return
	}

	meal.Name = req.Name
	if req.Servings > 0 {
		meal.Servings = req.Servings
	}

	// Replace items wholesale
	if err := db.DB.Where("meal_id = ?", meal.ID).Delete(&models.MealItem{}).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to update meal items")
		return
	}
	for i := range req.Items {
		req.Items[i].ID = 0
		req.Items[i].MealID = meal.ID
	}
	if err := db.DB.Create(&req.Items).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to update meal items")
		return
	}
	if err := db.DB.Save(&meal).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to update meal")
		return
	}

	meal.Items = req.Items
	respondJSON(w, http.StatusOK, meal)
}

// DeleteMeal deletes a meal (and its items) owned by the current user.
func DeleteMeal(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid meal ID")
		return
	}

	user := GetCurrentUser(r)
	var meal models.Meal
	if err := db.DB.Where("id = ? AND user_id = ?", id, user.ID).First(&meal).Error; err != nil {
		respondError(w, http.StatusNotFound, "Meal not found")
		return
	}

	db.DB.Where("meal_id = ?", meal.ID).Delete(&models.MealItem{})
	if err := db.DB.Delete(&meal).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete meal")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Meal deleted successfully"})
}

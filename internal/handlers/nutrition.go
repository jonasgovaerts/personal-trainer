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

// GetFoodByBarcode looks up a product on Open Food Facts by its barcode
func GetFoodByBarcode(w http.ResponseWriter, r *http.Request) {
	barcode := r.URL.Query().Get("barcode")
	if barcode == "" {
		respondError(w, http.StatusBadRequest, "Barcode is required")
		return
	}

	url := "https://world.openfoodfacts.org/api/v0/product/" + barcode + ".json"
	resp, err := http.Get(url)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to reach Open Food Facts")
		return
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to parse response")
		return
	}

	status, ok := result["status"].(float64)
	if !ok || status == 0 {
		respondError(w, http.StatusNotFound, "Product not found")
		return
	}

	product, _ := result["product"].(map[string]interface{})
	nutriments, _ := product["nutriments"].(map[string]interface{})

	// Map to our simplified format
	data := map[string]interface{}{
		"name":     product["product_name"],
		"brand":    product["brands"],
		"calories": nutriments["energy-kcal_100g"],
		"protein":  nutriments["proteins_100g"],
		"carbs":    nutriments["carbohydrates_100g"],
		"fat":      nutriments["fat_100g"],
		"image":    product["image_url"],
	}

	respondJSON(w, http.StatusOK, data)
}

// SearchFood looks up products on Open Food Facts by name
func SearchFood(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		respondError(w, http.StatusBadRequest, "Search query is required")
		return
	}

	url := "https://world.openfoodfacts.org/cgi/search.pl?search_terms=" + query + "&json=1&page_size=20"
	resp, err := http.Get(url)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to reach Open Food Facts")
		return
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to parse response")
		return
	}

	products, _ := result["products"].([]interface{})
	var searchResults []map[string]interface{}

	for _, p := range products {
		product, _ := p.(map[string]interface{})
		nutriments, _ := product["nutriments"].(map[string]interface{})

		searchResults = append(searchResults, map[string]interface{}{
			"name":     product["product_name"],
			"brand":    product["brands"],
			"calories": nutriments["energy-kcal_100g"],
			"protein":  nutriments["proteins_100g"],
			"carbs":    nutriments["carbohydrates_100g"],
			"fat":      nutriments["fat_100g"],
			"image":    product["image_small_url"],
		})
	}

	respondJSON(w, http.StatusOK, searchResults)
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

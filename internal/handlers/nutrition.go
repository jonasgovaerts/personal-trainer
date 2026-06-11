package handlers

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/user/personal-trainer/internal/db"
	"github.com/user/personal-trainer/internal/models"
)

// GetNutritionLogs fetches nutrition logs for a user
func GetNutritionLogs(w http.ResponseWriter, r *http.Request) {
	userIDStr := r.URL.Query().Get("user_id")
	var userID int

	if userIDStr == "" || userIDStr == "me" {
		user := GetCurrentUser(r)
		userID = int(user.ID)
	} else {
		var err error
		userID, err = strconv.Atoi(userIDStr)
		if err != nil {
			respondError(w, http.StatusBadRequest, "Invalid user_id")
			return
		}
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
		user := GetCurrentUser(r)
		req.UserID = user.ID
	}

	if req.Timestamp.IsZero() {
		req.Timestamp = time.Now()
	}

	// Smart prediction of meal based on timestamp if not set or invalid
	req.Meal = strings.ToLower(strings.TrimSpace(req.Meal))
	if req.Meal != "breakfast" && req.Meal != "lunch" && req.Meal != "dinner" && req.Meal != "snack" {
		hour := req.Timestamp.Hour()
		if hour >= 5 && hour < 11 {
			req.Meal = "breakfast"
		} else if hour >= 11 && hour < 16 {
			req.Meal = "lunch"
		} else if hour >= 16 && hour < 18 {
			req.Meal = "snack"
		} else if hour >= 18 && hour < 22 {
			req.Meal = "dinner"
		} else {
			req.Meal = "snack"
		}
	}

	if err := db.DB.Create(&req).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to log nutrition")
		return
	}

	// If a barcode is present, save/update the BarcodeProduct cache with these verified values
	if req.Barcode != "" {
		var product models.BarcodeProduct
		db.DB.Where("barcode = ?", req.Barcode).First(&product)
		
		product.Barcode = req.Barcode
		product.Name = req.Name
		
		// If portion_grams is provided, we calculate the 100g values
		if req.PortionGrams > 0 {
			factor := 100.0 / req.PortionGrams
			product.Calories = float64(req.Calories) * factor
			product.Protein = req.Protein * factor
			product.Carbs = req.Carbs * factor
			product.Fat = req.Fat * factor
			product.Fiber = req.Fiber * factor
		} else {
			// Fallback if portion is not provided (assume 100g)
			product.Calories = float64(req.Calories)
			product.Protein = req.Protein
			product.Carbs = req.Carbs
			product.Fat = req.Fat
			product.Fiber = req.Fiber
		}
		
		product.Type = req.Type
		product.UpdatedAt = time.Now()
		db.DB.Save(&product)
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

	// Check local DB first
	var localProduct models.BarcodeProduct
	if err := db.DB.Where("barcode = ?", barcode).First(&localProduct).Error; err == nil {
		data := map[string]interface{}{
			"name":     localProduct.Name,
			"brand":    localProduct.Brand,
			"calories": localProduct.Calories,
			"protein":  localProduct.Protein,
			"carbs":    localProduct.Carbs,
			"fat":      localProduct.Fat,
			"fiber":    localProduct.Fiber,
			"image":    localProduct.Image,
			"type":     localProduct.Type,
			"source":   "local",
		}
		respondJSON(w, http.StatusOK, data)
		return
	}

	url := "https://world.openfoodfacts.org/api/v0/product/" + barcode + ".json"
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create request")
		return
	}
	req.Header.Set("User-Agent", "PersonalTrainerApp - Go - Version 1.0")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
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

	// Robustly extract calories
	calories := 0.0
	if val, ok := nutriments["energy-kcal_100g"].(float64); ok {
		calories = val
	} else if val, ok := nutriments["energy_100g"].(float64); ok {
		calories = val / 4.184
	}

	// Map to our simplified format
	data := map[string]interface{}{
		"name":     product["product_name"],
		"brand":    product["brands"],
		"calories": calories,
		"protein":  getFloat(nutriments, "proteins_100g"),
		"carbs":    getFloat(nutriments, "carbohydrates_100g"),
		"fat":      getFloat(nutriments, "fat_100g"),
		"fiber":    getFloat(nutriments, "fiber_100g"),
		"image":    product["image_url"],
		"type":     determineType(product),
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

	// Use url.Values to safely encode the query parameters
	params := url.Values{}
	params.Add("search_terms", query)
	params.Add("search_simple", "1")
	params.Add("action", "process")
	params.Add("json", "1")
	params.Add("page_size", "20")

	apiURL := "https://world.openfoodfacts.org/cgi/search.pl?" + params.Encode()
	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create request")
		return
	}
	req.Header.Set("User-Agent", "PersonalTrainerApp - Go - Version 1.0")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to reach Open Food Facts")
		return
	}
	defer resp.Body.Close()

	var result struct {
		Products []map[string]interface{} `json:"products"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to parse response")
		return
	}

	var searchResults []map[string]interface{}
	for _, product := range result.Products {
		nutriments, _ := product["nutriments"].(map[string]interface{})

		// Robustly extract calories
		calories := 0.0
		if val, ok := nutriments["energy-kcal_100g"].(float64); ok {
			calories = val
		} else if val, ok := nutriments["energy_100g"].(float64); ok {
			// Convert kJ to kcal if kcal is missing (1 kcal = 4.184 kJ)
			calories = val / 4.184
		}

		// Only add if it has a name
		name, _ := product["product_name"].(string)
		if name == "" {
			continue
		}

		searchResults = append(searchResults, map[string]interface{}{
			"name":     name,
			"brand":    product["brands"],
			"calories": calories,
			"protein":  getFloat(nutriments, "proteins_100g"),
			"carbs":    getFloat(nutriments, "carbohydrates_100g"),
			"fat":      getFloat(nutriments, "fat_100g"),
			"fiber":    getFloat(nutriments, "fiber_100g"),
			"image":    product["image_small_url"],
			"type":     determineType(product),
		})
	}

	respondJSON(w, http.StatusOK, searchResults)
}

func determineType(product map[string]interface{}) string {
	name, _ := product["product_name"].(string)
	categories, _ := product["categories"].(string)
	
	// Lowercase for comparison
	ln := strings.ToLower(name)
	lc := strings.ToLower(categories)
	
	drinkKeywords := []string{"cola", "coffee", "soda", "juice", "water", "drink", "milk", "tea", "beer", "wine", "spirit", "liquid"}
	
	for _, kw := range drinkKeywords {
		if strings.Contains(ln, kw) || strings.Contains(lc, kw) {
			return "drink"
		}
	}
	
	return "food"
}

func getFloat(m map[string]interface{}, key string) float64 {
	if val, ok := m[key].(float64); ok {
		return val
	}
	return 0.0
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

// UpdateNutritionLog updates a specific nutrition log
func UpdateNutritionLog(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid log ID")
		return
	}

	var log models.NutritionLog
	if err := db.DB.First(&log, id).Error; err != nil {
		respondError(w, http.StatusNotFound, "Log not found")
		return
	}

	var req models.NutritionLog
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	// Update fields
	log.Name = req.Name
	log.Calories = req.Calories
	log.Protein = req.Protein
	log.Carbs = req.Carbs
	log.Fat = req.Fat
	log.Fiber = req.Fiber
	log.PortionGrams = req.PortionGrams
	if req.Type != "" {
		log.Type = req.Type
	}
	if req.Meal != "" {
		log.Meal = req.Meal
	}
	if !req.Timestamp.IsZero() {
		log.Timestamp = req.Timestamp
	}

	if err := db.DB.Save(&log).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to update log")
		return
	}

	respondJSON(w, http.StatusOK, log)
}

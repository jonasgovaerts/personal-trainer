package handlers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"

	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/option"
)

type AnalyzeResponse struct {
	Name     string  `json:"name"`
	Calories int     `json:"calories"`
	Protein  float64 `json:"protein"`
	Carbs    float64 `json:"carbs"`
	Fat      float64 `json:"fat"`
}

// AnalyzeNutrition handles AI analysis of food or barcodes
func AnalyzeNutrition(w http.ResponseWriter, r *http.Request) {
	err := r.ParseMultipartForm(10 << 20) // 10 MB limit
	if err != nil {
		respondError(w, http.StatusBadRequest, "File too large or invalid form")
		return
	}

	file, header, err := r.FormFile("image")
	if err != nil {
		respondError(w, http.StatusBadRequest, "Image is required")
		return
	}
	defer file.Close()

	imgData, err := io.ReadAll(file)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to read image")
		return
	}

	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		respondError(w, http.StatusInternalServerError, "Gemini API Key is not configured")
		return
	}

	ctx := context.Background()
	client, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to initialize AI client")
		return
	}
	defer client.Close()

	model := client.GenerativeModel("gemini-2.5-flash")
	model.ResponseMIMEType = "application/json"

	mimeType := header.Header.Get("Content-Type")
	// The genai.ImageData function expects just the format extension (e.g. "jpeg", "png")
	// so we strip "image/" if it exists. If it's empty, we default to "jpeg".
	format := "jpeg"
	if len(mimeType) > 6 && mimeType[:6] == "image/" {
		format = mimeType[6:]
	}

	mode := r.URL.Query().Get("mode")
	var prompt genai.Text
	if mode == "barcode" {
		prompt = genai.Text(`Analyze this image of a barcode or nutrition label. Provide a single JSON object with the following fields: "name" (a short descriptive name), "calories" (integer estimate of the calories per 100 grams), "protein" (float estimate per 100g), "carbs" (float estimate per 100g), and "fat" (float estimate per 100g). Example: {"name": "Protein Bar", "calories": 350, "protein": 20.0, "carbs": 30.0, "fat": 10.0}. Return ONLY valid JSON, no markdown formatting.`)
	} else {
		prompt = genai.Text(`Analyze this image of a plate of food. Provide a single JSON object with the following fields: "name" (a short descriptive name for the entire meal), "calories" (integer estimate of the TOTAL calories for the entire plate), "protein" (float estimate of total protein in grams), "carbs" (float estimate of total carbs in grams), and "fat" (float estimate of total fat in grams). Example: {"name": "Steak and Rice", "calories": 650, "protein": 45.0, "carbs": 50.0, "fat": 20.0}. Return ONLY valid JSON, no markdown formatting.`)
	}

	resp, err := model.GenerateContent(ctx, prompt, genai.ImageData(format, imgData))
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to analyze image: "+err.Error())
		return
	}

	if len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
		respondError(w, http.StatusInternalServerError, "No analysis returned")
		return
	}

	part := resp.Candidates[0].Content.Parts[0]
	if textPart, ok := part.(genai.Text); ok {
		// Clean up potential markdown formatting
		jsonStr := string(textPart)
		if len(jsonStr) >= 7 && jsonStr[:7] == "```json" {
			jsonStr = jsonStr[7:]
		}
		if len(jsonStr) >= 3 && jsonStr[len(jsonStr)-3:] == "```" {
			jsonStr = jsonStr[:len(jsonStr)-3]
		}

		var result AnalyzeResponse
		err = json.Unmarshal([]byte(jsonStr), &result)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "Failed to parse AI response")
			return
		}
		respondJSON(w, http.StatusOK, result)
		return
	}

	respondError(w, http.StatusInternalServerError, "Unexpected AI response format")
}

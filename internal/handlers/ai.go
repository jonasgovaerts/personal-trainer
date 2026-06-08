package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/generative-ai-go/genai"
	"github.com/user/personal-trainer/internal/db"
	"github.com/user/personal-trainer/internal/models"
	"google.golang.org/api/option"
)

type AnalyzeResponse struct {
	Name     string  `json:"name"`
	Calories int     `json:"calories"`
	Protein  float64 `json:"protein"`
	Carbs    float64 `json:"carbs"`
	Fat      float64 `json:"fat"`
	Type     string  `json:"type"`
}

type ChatRequest struct {
	Message string `json:"message"`
}

type ChatResponse struct {
	Reply          string `json:"reply"`
	BurnedCalories int    `json:"burned_calories,omitempty"`
	ActivityName   string `json:"activity_name,omitempty"`
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
	userPrompt := r.FormValue("prompt")
	log.Printf("INFO: Starting AI analysis in %s mode. User prompt: %s", mode, userPrompt)
	
	var prompt genai.Text
	if mode == "barcode" {
		instruction := `Analyze this image of a barcode or nutrition label. Provide a single JSON object with the following fields: "name" (a short descriptive name), "calories" (integer estimate of the calories per 100 grams), "protein" (float estimate per 100g), "carbs" (float estimate per 100g), and "fat" (float estimate per 100g). Example: {"name": "Protein Bar", "calories": 350, "protein": 20.0, "carbs": 30.0, "fat": 10.0}. Return ONLY valid JSON, no markdown formatting.`
		if userPrompt != "" {
			instruction += " Context from user: " + userPrompt
		}
		prompt = genai.Text(instruction)
	} else {
		instruction := `Analyze this image of a plate of food or a drink. Provide a single JSON object with the following fields: "name" (a short descriptive name for the entire meal), "calories" (integer estimate of the TOTAL calories for the entire plate), "protein" (float estimate of total protein in grams), "carbs" (float estimate of total carbs in grams), and "fat" (float estimate of total fat in grams), and "type" (either "food" or "drink"). Example: {"name": "Steak and Rice", "calories": 650, "protein": 45.0, "carbs": 50.0, "fat": 20.0, "type": "food"}. Return ONLY valid JSON, no markdown formatting.`
		if userPrompt != "" {
			instruction += " Context from user: " + userPrompt
		}
		prompt = genai.Text(instruction)
	}

	resp, err := model.GenerateContent(ctx, prompt, genai.ImageData(format, imgData))
	if err != nil {
		log.Printf("ERROR: AI generation failed: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to analyze image: "+err.Error())
		return
	}

	if len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
		log.Printf("ERROR: AI returned no candidates or parts")
		respondError(w, http.StatusInternalServerError, "No analysis returned")
		return
	}

	part := resp.Candidates[0].Content.Parts[0]
	if textPart, ok := part.(genai.Text); ok {
		jsonStr := string(textPart)
		log.Printf("INFO: AI raw response: %s", jsonStr)
		
		// Clean up potential markdown formatting
		if len(jsonStr) >= 7 && jsonStr[:7] == "```json" {
			jsonStr = jsonStr[7:]
		}
		if len(jsonStr) >= 3 && jsonStr[len(jsonStr)-3:] == "```" {
			jsonStr = jsonStr[:len(jsonStr)-3]
		}

		var result AnalyzeResponse
		err = json.Unmarshal([]byte(jsonStr), &result)
		if err != nil {
			log.Printf("ERROR: Failed to unmarshal AI response: %v | Raw: %s", err, jsonStr)
			respondError(w, http.StatusInternalServerError, "Failed to parse AI response")
			return
		}
		respondJSON(w, http.StatusOK, result)
		return
	}

	log.Printf("ERROR: AI response was not Text")
	respondError(w, http.StatusInternalServerError, "Unexpected AI response format")
}

// ChatWithAI handles general fitness and nutrition questions, and workout file analysis
func ChatWithAI(w http.ResponseWriter, r *http.Request) {
	// Parse multipart form to handle potential file uploads
	err := r.ParseMultipartForm(10 << 20) // 10 MB limit
	if err != nil {
		// If it fails, try to see if it's just a JSON request
		var req ChatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err == nil {
			handleSimpleChat(w, req.Message)
			return
		}
		respondError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	userMessage := r.FormValue("message")
	file, header, err := r.FormFile("file")
	
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
	
	var prompt []genai.Part
	systemPrompt := "You are a professional fitness coach. "
	
	if err == nil {
		defer file.Close()
		fileBytes, _ := io.ReadAll(file)
		fileName := header.Filename
		
		systemPrompt += fmt.Sprintf("The user has uploaded a fitness activity file named '%s'. ", fileName)
		systemPrompt += "Analyze this file (it might be GPX, TCX, XML, or binary .FIT data). "
		systemPrompt += "Extract the activity type, duration, and specifically the ESTIMATED CALORIES BURNED. "
		systemPrompt += "Return your response in two parts: 1. A friendly encouraging message about the workout. "
		systemPrompt += "2. A JSON-like block at the end (but still within your text response) in the format: [WORKOUT_DATA:{\"calories\": 450, \"name\": \"Morning Run\"}]. "
		
		prompt = append(prompt, genai.Text(systemPrompt))
		
		if strings.HasSuffix(strings.ToLower(fileName), ".fit") {
			prompt = append(prompt, genai.Blob{
				MIMEType: "application/octet-stream",
				Data:     fileBytes,
			})
		} else {
			prompt = append(prompt, genai.Text("File Content: "+string(fileBytes)))
		}
	} else {
		systemPrompt += "Answer the following question briefly and encouragingly: "
		prompt = append(prompt, genai.Text(systemPrompt))
	}

	prompt = append(prompt, genai.Text(userMessage))

	resp, err := model.GenerateContent(ctx, prompt...)
	if err != nil {
		log.Printf("ERROR: AI chat failed: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to get AI response")
		return
	}

	if len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
		respondError(w, http.StatusInternalServerError, "No response from AI")
		return
	}

	part := resp.Candidates[0].Content.Parts[0]
	if textPart, ok := part.(genai.Text); ok {
		reply := string(textPart)
		
		// Parse workout data if present
		response := ChatResponse{Reply: reply}
		
		workoutTag := "[WORKOUT_DATA:"
		if idx := strings.Index(reply, workoutTag); idx != -1 {
			endIdx := strings.Index(reply[idx:], "]")
			if endIdx != -1 {
				jsonStr := reply[idx+len(workoutTag) : idx+endIdx]
				var data struct {
					Calories int    `json:"calories"`
					Name     string `json:"name"`
				}
				if err := json.Unmarshal([]byte(jsonStr), &data); err == nil {
					response.BurnedCalories = data.Calories
					response.ActivityName = data.Name
					
					// Auto-save the workout to the database
					newWorkout := models.Workout{
						UserID:         1, // Hardcoded for prototype
						Date:           time.Now(),
						Notes:          "Imported via AI Coach: " + data.Name,
						CaloriesBurned: data.Calories,
					}
					db.DB.Create(&newWorkout)
				}
				// Clean the tag from the visible reply
				response.Reply = strings.TrimSpace(reply[:idx] + reply[idx+endIdx+1:])
			}
		}
		
		respondJSON(w, http.StatusOK, response)
		return
	}

	respondError(w, http.StatusInternalServerError, "Unexpected AI response format")
}

func handleSimpleChat(w http.ResponseWriter, message string) {
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
	prompt := "You are a professional fitness coach and nutrition expert. Answer the following question briefly and encouragingly: " + message

	resp, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get AI response")
		return
	}

	if len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
		respondError(w, http.StatusInternalServerError, "No response from AI")
		return
	}

	part := resp.Candidates[0].Content.Parts[0]
	if textPart, ok := part.(genai.Text); ok {
		respondJSON(w, http.StatusOK, ChatResponse{Reply: string(textPart)})
		return
	}

	respondError(w, http.StatusInternalServerError, "Unexpected AI response format")
}


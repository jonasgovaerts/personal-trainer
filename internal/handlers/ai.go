package handlers

import (
	"context"
	"encoding/base64"
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
	file, header, fileErr := r.FormFile("file")
	
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
	systemPrompt := "You are a strict professional fitness coach and nutrition expert. " + getUserProgressContext() + " "
	systemPrompt += "IMPORTANT MANDATE: You must ONLY answer questions directly related to fitness, workouts, training, exercises, gym, sports, body weight, physical health, diet, food, recipes, or nutrition. If the user's question or message is NOT related to these fitness and nutrition topics, you must refuse to answer and instead reply with exactly: 'I am sorry, but I can only help you with fitness and nutrition related questions.' "
	
	if fileErr == nil {
		defer file.Close()
		fileBytes, _ := io.ReadAll(file)
		fileName := header.Filename
		
		systemPrompt += fmt.Sprintf("The user has uploaded a fitness activity file named '%s'. ", fileName)
		systemPrompt += "Analyze this file (it might be GPX, TCX, XML, or binary .FIT data). "
		systemPrompt += "Extract the activity type, duration, and specifically the ESTIMATED CALORIES BURNED. "
		
		// Try parsing .fit files natively first
		if strings.HasSuffix(strings.ToLower(fileName), ".fit") {
			if cal, act, dur, err := ParseFitFile(fileBytes); err == nil {
				// Force Gemini to use these exact values!
				systemPrompt += fmt.Sprintf("AUTHENTIC STATS extracted from the binary: The activity is actually '%s', with a duration of %d minutes, and the EXACT device-calculated calories burned is %d kcal. You MUST use these exact parsed values (%d kcal for calories, '%s' for name) in your response and in the [WORKOUT_DATA] block. Do NOT estimate different values. ", act, dur, cal, cal, act)
			} else {
				log.Printf("WARN: Native FIT parsing failed: %v. Falling back to AI estimation.", err)
			}
		}

		systemPrompt += "Return your response in two parts: 1. A friendly encouraging message about the workout. "
		systemPrompt += "2. A JSON-like block at the end (but still within your text response) in the format: [WORKOUT_DATA:{\"calories\": 450, \"name\": \"Morning Run\"}]. "
		
		prompt = append(prompt, genai.Text(systemPrompt))
		
		if strings.HasSuffix(strings.ToLower(fileName), ".fit") {
			// Base64 encode the binary FIT file so Gemini can parse it as a text prompt natively.
			// This avoids 400 Unsupported MIME type application/octet-stream errors from the API.
			encoded := base64.StdEncoding.EncodeToString(fileBytes)
			prompt = append(prompt, genai.Text("Binary .FIT File Content (base64-encoded): "+encoded))
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
	prompt := "You are a strict professional fitness coach and nutrition expert. " + getUserProgressContext() + " IMPORTANT MANDATE: You must ONLY answer questions directly related to fitness, workouts, training, exercises, gym, sports, body weight, physical health, diet, food, recipes, or nutrition. If the user's question or message is NOT related to these fitness and nutrition topics, you must refuse to answer and instead reply with exactly: 'I am sorry, but I can only help you with fitness and nutrition related questions.' Answer the following question briefly and encouragingly: " + message

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

func getUserProgressContext() string {
	var user models.User
	if err := db.DB.First(&user, 1).Error; err != nil {
		// Fallback to default goals if user 1 not found
		user = models.User{
			GoalCalories: 2500,
			GoalProtein:  150,
			GoalCarbs:    250,
			GoalFat:      80,
		}
	}

	var logs []models.NutritionLog
	today := time.Now().Format("2006-01-02")
	db.DB.Where("user_id = ? AND DATE(timestamp) = ?", 1, today).Find(&logs)

	var consumedCalories int
	var consumedProtein, consumedCarbs, consumedFat float64
	for _, l := range logs {
		consumedCalories += l.Calories
		consumedProtein += l.Protein
		consumedCarbs += l.Carbs
		consumedFat += l.Fat
	}

	var workouts []models.Workout
	db.DB.Where("user_id = ? AND DATE(date) = ?", 1, today).Find(&workouts)
	var burnedCalories int
	for _, w := range workouts {
		burnedCalories += w.CaloriesBurned
	}

	netConsumed := consumedCalories - burnedCalories
	if netConsumed < 0 {
		netConsumed = 0
	}
	remainingCals := user.GoalCalories - netConsumed

	return fmt.Sprintf(
		"Today's Date: %s. Here is the user's current daily progress:\n"+
			"- Calorie Goal: %d kcal\n"+
			"- Calories Consumed (Food): %d kcal\n"+
			"- Calories Burned (Workouts): %d kcal\n"+
			"- Net Calories: %d kcal\n"+
			"- Calories Remaining: %d kcal\n"+
			"- Protein: %.1f g consumed / %d g goal (Remaining: %.1f g)\n"+
			"- Carbs: %.1f g consumed / %d g goal (Remaining: %.1f g)\n"+
			"- Fat: %.1f g consumed / %d g goal (Remaining: %.1f g)\n\n"+
			"Use this data to answer questions about their daily limits, consumed food, remaining targets, and general nutrition.",
		today,
		user.GoalCalories,
		consumedCalories,
		burnedCalories,
		netConsumed,
		remainingCals,
		consumedProtein, user.GoalProtein, float64(user.GoalProtein)-consumedProtein,
		consumedCarbs, user.GoalCarbs, float64(user.GoalCarbs)-consumedCarbs,
		consumedFat, user.GoalFat, float64(user.GoalFat)-consumedFat,
	)
}


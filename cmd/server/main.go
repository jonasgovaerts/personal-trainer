package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/user/personal-trainer/internal/db"
	"github.com/user/personal-trainer/internal/handlers"
)

func main() {
	// Initialize database
	db.InitDB()

	// Set up router
	mux := http.NewServeMux()

	// API Routes (using Go 1.22+ routing)
	mux.HandleFunc("GET /api/user/{id}", handlers.GetUser)
	mux.HandleFunc("PUT /api/user/{id}/profile", handlers.UpdateUserProfile)
	mux.HandleFunc("PUT /api/user/{id}/equipment", handlers.UpdateUserEquipment)
	
	mux.HandleFunc("GET /api/equipment", handlers.GetEquipment)
	
	mux.HandleFunc("GET /api/exercises", handlers.GetExercises)

	mux.HandleFunc("POST /api/workouts", handlers.CreateWorkout)
	mux.HandleFunc("POST /api/workouts/{id}/log", handlers.LogWorkoutSet)
	mux.HandleFunc("GET /api/workouts/history", handlers.GetWorkoutHistory)
	mux.HandleFunc("DELETE /api/workouts/{id}", handlers.DeleteWorkout)

	mux.HandleFunc("GET /api/nutrition", handlers.GetNutritionLogs)
	mux.HandleFunc("POST /api/nutrition", handlers.LogNutrition)
	mux.HandleFunc("DELETE /api/nutrition/{id}", handlers.DeleteNutritionLog)
	mux.HandleFunc("POST /api/nutrition/analyze", handlers.AnalyzeNutrition)
	mux.HandleFunc("GET /api/nutrition/search", handlers.SearchFood)
	mux.HandleFunc("GET /api/nutrition/barcode", handlers.GetFoodByBarcode)
	mux.HandleFunc("POST /api/ai/chat", handlers.ChatWithAI)

	// Serve static files (frontend) with SPA fallback
	staticPath := "./static"
	indexPath := "index.html"
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// If the path contains a dot (like .js, .css, .png), it's likely a static asset
		// Otherwise, or if the file doesn't exist, serve index.html
		path := filepath.Join(staticPath, r.URL.Path)
		
		// Use Stat to check if file exists
		fi, err := os.Stat(path)
		if os.IsNotExist(err) || fi.IsDir() || !strings.Contains(r.URL.Path, ".") {
			http.ServeFile(w, r, filepath.Join(staticPath, indexPath))
			return
		}

		// Otherwise serve the file normally
		http.FileServer(http.Dir(staticPath)).ServeHTTP(w, r)
	})

	// Wrap mux with middleware chain
	handler := loggingMiddleware(corsMiddleware(mux))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s...", port)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

// responseWriter is a wrapper for http.ResponseWriter to capture the status code
type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

// loggingMiddleware logs details about every incoming request
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseWriter{w, http.StatusOK}
		
		next.ServeHTTP(rw, r)
		
		duration := time.Since(start)
		log.Printf(
			"[%s] %s %s %d %s %s",
			r.RemoteAddr,
			r.Method,
			r.URL.Path,
			rw.status,
			duration,
			r.UserAgent(),
		)
	})
}

// corsMiddleware adds basic CORS headers for local development
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

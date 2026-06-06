package main

import (
	"log"
	"net/http"
	"os"
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

	// Serve static files (frontend)
	fs := http.FileServer(http.Dir("./static"))
	mux.Handle("/", fs)

	// Wrap mux with CORS middleware
	handler := corsMiddleware(mux)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s...", port)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
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
StatusOK}
		
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

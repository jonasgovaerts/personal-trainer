package handlers

import (
	"net/http"
	"github.com/user/personal-trainer/internal/db"
)

// Healthz is a simple health check endpoint.
func Healthz(w http.ResponseWriter, r *http.Request) {
	// Check database connection
	sqlDB, err := db.DB.DB()
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Database connection error")
		return
	}
	if err := sqlDB.Ping(); err != nil {
		respondError(w, http.StatusInternalServerError, "Database ping failed")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

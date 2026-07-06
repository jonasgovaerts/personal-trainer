package handlers

import (
	"fmt"
	"net/http"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/user/personal-trainer/internal/db"
	"github.com/user/personal-trainer/internal/models"
	"github.com/user/personal-trainer/internal/storage"
)

const maxPhotoBytes = 10 << 20 // 10 MB

// GetProgressPhotos lists the current user's progress photos with presigned URLs.
func GetProgressPhotos(w http.ResponseWriter, r *http.Request) {
	if !storage.Enabled() {
		respondError(w, http.StatusServiceUnavailable, "Photo storage is not configured")
		return
	}
	user := GetCurrentUser(r)

	var photos []models.ProgressPhoto
	db.DB.Where("user_id = ?", user.ID).Order("taken_at desc").Find(&photos)

	for i := range photos {
		if url, err := storage.PresignedGetURL(r.Context(), photos[i].ObjectKey, time.Hour); err == nil {
			photos[i].URL = url
		}
	}
	respondJSON(w, http.StatusOK, photos)
}

// UploadProgressPhoto stores an uploaded image and records it for the current user.
func UploadProgressPhoto(w http.ResponseWriter, r *http.Request) {
	if !storage.Enabled() {
		respondError(w, http.StatusServiceUnavailable, "Photo storage is not configured")
		return
	}
	if err := r.ParseMultipartForm(maxPhotoBytes); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid upload (max 10MB)")
		return
	}

	file, header, err := r.FormFile("image")
	if err != nil {
		respondError(w, http.StatusBadRequest, "Missing image file")
		return
	}
	defer file.Close()

	contentType := header.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "image/") {
		respondError(w, http.StatusBadRequest, "File must be an image")
		return
	}

	user := GetCurrentUser(r)

	ext := path.Ext(header.Filename)
	if ext == "" {
		ext = ".jpg"
	}
	key := fmt.Sprintf("user/%d/%s%s", user.ID, uuid.NewString(), ext)

	if err := storage.Put(r.Context(), key, file, header.Size, contentType); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to store photo")
		return
	}

	takenAt := time.Now()
	if ts := r.FormValue("taken_at"); ts != "" {
		if parsed, err := time.Parse("2006-01-02", ts); err == nil {
			takenAt = parsed
		}
	}

	photo := models.ProgressPhoto{
		UserID:    user.ID,
		ObjectKey: key,
		Note:      r.FormValue("note"),
		TakenAt:   takenAt,
	}
	if err := db.DB.Create(&photo).Error; err != nil {
		_ = storage.Remove(r.Context(), key)
		respondError(w, http.StatusInternalServerError, "Failed to save photo record")
		return
	}

	if url, err := storage.PresignedGetURL(r.Context(), key, time.Hour); err == nil {
		photo.URL = url
	}
	respondJSON(w, http.StatusCreated, photo)
}

// DeleteProgressPhoto removes a photo (object + record) owned by the current user.
func DeleteProgressPhoto(w http.ResponseWriter, r *http.Request) {
	if !storage.Enabled() {
		respondError(w, http.StatusServiceUnavailable, "Photo storage is not configured")
		return
	}
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid photo ID")
		return
	}

	user := GetCurrentUser(r)
	var photo models.ProgressPhoto
	if err := db.DB.Where("id = ? AND user_id = ?", id, user.ID).First(&photo).Error; err != nil {
		respondError(w, http.StatusNotFound, "Photo not found")
		return
	}

	_ = storage.Remove(r.Context(), photo.ObjectKey)
	if err := db.DB.Delete(&photo).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to delete photo")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Photo deleted successfully"})
}

package auth

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

const (
	stateCookieName = "pt_oauth_state"
	nonceCookieName = "pt_oauth_nonce"
	pkceCookieName  = "pt_oauth_pkce"
)

// tempCookie writes a short-lived, HttpOnly cookie used during the OIDC handshake.
func tempCookie(w http.ResponseWriter, name, value string) {
	http.SetCookie(w, &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		MaxAge:   600, // 10 minutes
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
}

// HandleLogin starts the Authorization Code flow with PKCE, state and nonce.
func HandleLogin(w http.ResponseWriter, r *http.Request) {
	state := randomString(24)
	nonce := randomString(24)
	verifier := oauth2.GenerateVerifier()

	tempCookie(w, stateCookieName, state)
	tempCookie(w, nonceCookieName, nonce)
	tempCookie(w, pkceCookieName, verifier)

	url := oauth2Config.AuthCodeURL(state, oidc.Nonce(nonce), oauth2.S256ChallengeOption(verifier))
	http.Redirect(w, r, url, http.StatusFound)
}

// HandleCallback completes the flow: validates state, exchanges the code,
// verifies the ID token, and establishes the session.
func HandleCallback(w http.ResponseWriter, r *http.Request) {
	// Validate state against the cookie set at login.
	stateCookie, err := r.Cookie(stateCookieName)
	if err != nil || r.URL.Query().Get("state") != stateCookie.Value {
		http.Error(w, "invalid oauth state", http.StatusBadRequest)
		return
	}

	pkceCookie, err := r.Cookie(pkceCookieName)
	if err != nil {
		http.Error(w, "missing pkce verifier", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	oauth2Token, err := oauth2Config.Exchange(ctx, r.URL.Query().Get("code"), oauth2.VerifierOption(pkceCookie.Value))
	if err != nil {
		log.Printf("ERROR: token exchange failed: %v", err)
		http.Error(w, "token exchange failed", http.StatusBadGateway)
		return
	}

	rawIDToken, ok := oauth2Token.Extra("id_token").(string)
	if !ok {
		http.Error(w, "no id_token in token response", http.StatusBadGateway)
		return
	}

	idToken, err := verifier.Verify(ctx, rawIDToken)
	if err != nil {
		log.Printf("ERROR: id token verification failed: %v", err)
		http.Error(w, "id token verification failed", http.StatusBadGateway)
		return
	}

	// Verify nonce.
	nonceCookie, err := r.Cookie(nonceCookieName)
	if err != nil || idToken.Nonce != nonceCookie.Value {
		http.Error(w, "invalid nonce", http.StatusBadRequest)
		return
	}

	var claims struct {
		PreferredUsername string `json:"preferred_username"`
		Name              string `json:"name"`
		Email             string `json:"email"`
	}
	if err := idToken.Claims(&claims); err != nil {
		http.Error(w, "failed to parse claims", http.StatusInternalServerError)
		return
	}

	username := claims.PreferredUsername
	if username == "" {
		username = claims.Email
	}
	if username == "" {
		http.Error(w, "no username claim in token", http.StatusBadGateway)
		return
	}

	name := claims.Name
	if name == "" {
		name = claims.Email
	}

	if err := setSession(w, SessionData{
		Username: username,
		Name:     name,
		Email:    claims.Email,
		Expiry:   time.Now().Add(sessionTTL),
	}); err != nil {
		http.Error(w, "failed to create session", http.StatusInternalServerError)
		return
	}

	log.Printf("INFO: user '%s' authenticated via OIDC", username)
	http.Redirect(w, r, "/", http.StatusFound)
}

// HandleLogout clears the session and performs RP-initiated logout at Authentik.
func HandleLogout(w http.ResponseWriter, r *http.Request) {
	clearSession(w)
	logoutURL := strings.TrimRight(cfg.Issuer, "/") + "/end-session/?post_logout_redirect_uri=" + cfg.BaseURL
	http.Redirect(w, r, logoutURL, http.StatusFound)
}

// RequireAuth enforces a valid session on all routes except the /auth/* handshake
// endpoints. Unauthenticated API calls get 401; browser navigations are redirected
// to the login endpoint.
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/auth/") {
			next.ServeHTTP(w, r)
			return
		}

		data, ok := readSession(r)
		if !ok {
			if strings.HasPrefix(r.URL.Path, "/api/") {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				json.NewEncoder(w).Encode(map[string]string{"error": "unauthenticated"})
				return
			}
			http.Redirect(w, r, "/auth/login", http.StatusFound)
			return
		}

		ctx := context.WithValue(r.Context(), userContextKey, data)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

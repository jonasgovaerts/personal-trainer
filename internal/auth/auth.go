package auth

import (
	"context"
	"encoding/base64"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/gorilla/securecookie"
	"golang.org/x/oauth2"
)

const sessionCookieName = "pt_session"
const sessionTTL = 7 * 24 * time.Hour

// Config holds the resolved OIDC configuration for the app.
type Config struct {
	Issuer      string
	ClientID    string
	RedirectURL string
	BaseURL     string
}

var (
	cfg          Config
	provider     *oidc.Provider
	verifier     *oidc.IDTokenVerifier
	oauth2Config oauth2.Config
	secureCookie *securecookie.SecureCookie
)

// SessionData is the identity persisted in the signed+encrypted session cookie.
type SessionData struct {
	Username string    `json:"username"`
	Name     string    `json:"name"`
	Email    string    `json:"email"`
	Expiry   time.Time `json:"expiry"`
}

type contextKey struct{}

var userContextKey = contextKey{}

// mustEnv fetches a required environment variable or aborts startup.
func mustEnv(key string) string {
	v := os.Getenv(key)
	if strings.TrimSpace(v) == "" {
		log.Fatalf("FATAL: required environment variable %s is not set", key)
	}
	return v
}

// Init reads OIDC configuration from the environment and performs provider
// discovery. It aborts startup if configuration is missing or discovery fails.
func Init() {
	cfg = Config{
		Issuer:      mustEnv("OIDC_ISSUER"),
		ClientID:    mustEnv("OIDC_CLIENT_ID"),
		RedirectURL: mustEnv("OIDC_REDIRECT_URL"),
		BaseURL:     mustEnv("APP_BASE_URL"),
	}
	clientSecret := mustEnv("OIDC_CLIENT_SECRET")
	sessionSecret := mustEnv("SESSION_SECRET")

	// securecookie needs a hash key (auth) and a block key (encryption).
	// Derive a 32-byte block key from the session secret.
	hashKey := []byte(sessionSecret)
	blockKey := deriveKey(sessionSecret, 32)
	secureCookie = securecookie.New(hashKey, blockKey)
	secureCookie.MaxAge(int(sessionTTL.Seconds()))

	var err error
	provider, err = oidc.NewProvider(context.Background(), cfg.Issuer)
	if err != nil {
		log.Fatalf("FATAL: OIDC provider discovery failed for issuer %q: %v", cfg.Issuer, err)
	}
	verifier = provider.Verifier(&oidc.Config{ClientID: cfg.ClientID})

	oauth2Config = oauth2.Config{
		ClientID:     cfg.ClientID,
		ClientSecret: clientSecret,
		RedirectURL:  cfg.RedirectURL,
		Endpoint:     provider.Endpoint(),
		Scopes:       []string{oidc.ScopeOpenID, "profile", "email"},
	}

	log.Printf("INFO: OIDC initialized (issuer=%s, client=%s)", cfg.Issuer, cfg.ClientID)
}

// deriveKey produces a fixed-length key from a secret string (pad or truncate).
func deriveKey(secret string, length int) []byte {
	b := []byte(secret)
	if len(b) >= length {
		return b[:length]
	}
	out := make([]byte, length)
	copy(out, b)
	return out
}

// setSession writes the signed+encrypted session cookie.
func setSession(w http.ResponseWriter, data SessionData) error {
	encoded, err := secureCookie.Encode(sessionCookieName, data)
	if err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    encoded,
		Path:     "/",
		Expires:  data.Expiry,
		MaxAge:   int(sessionTTL.Seconds()),
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
	return nil
}

// readSession decodes and validates the session cookie.
func readSession(r *http.Request) (SessionData, bool) {
	c, err := r.Cookie(sessionCookieName)
	if err != nil {
		return SessionData{}, false
	}
	var data SessionData
	if err := secureCookie.Decode(sessionCookieName, c.Value, &data); err != nil {
		return SessionData{}, false
	}
	if time.Now().After(data.Expiry) {
		return SessionData{}, false
	}
	return data, true
}

// clearSession expires the session cookie.
func clearSession(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
}

// UserFromContext returns the authenticated user's session data, if present.
func UserFromContext(ctx context.Context) (SessionData, bool) {
	data, ok := ctx.Value(userContextKey).(SessionData)
	return data, ok
}

// randomString returns a URL-safe random token of n bytes of entropy.
func randomString(n int) string {
	return base64.RawURLEncoding.EncodeToString(securecookie.GenerateRandomKey(n))
}

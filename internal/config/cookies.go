package config

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
)

// TODO: Implement cookie encryption in future version
// For maximum security, consider using:
// - OS keyring (github.com/zalando/go-keyring)
// - AES-256 encryption with key derived from machine identifier
// - File permissions 600 (already implemented)

// CookieStore handles cookie storage and loading
type CookieStore struct {
	path string
}

// NewCookieStore creates a new CookieStore
func NewCookieStore(path string) *CookieStore {
	return &CookieStore{path: path}
}

// cookieJSON represents a cookie in JSON format
type cookieJSON struct {
	Name     string `json:"name"`
	Value    string `json:"value"`
	Path     string `json:"path,omitempty"`
	Domain   string `json:"domain,omitempty"`
	Expires  string `json:"expires,omitempty"`
	MaxAge   int    `json:"maxAge,omitempty"`
	Secure   bool   `json:"secure,omitempty"`
	HttpOnly bool   `json:"httpOnly,omitempty"`
	SameSite string `json:"sameSite,omitempty"`
}

// ParseCookiesJSON parses a JSON string with cookies and returns []*http.Cookie
func ParseCookiesJSON(data string) ([]*http.Cookie, error) {
	var cookiesJSON []cookieJSON
	if err := json.Unmarshal([]byte(data), &cookiesJSON); err != nil {
		return nil, fmt.Errorf("invalid JSON format: %w", err)
	}

	if len(cookiesJSON) == 0 {
		return nil, fmt.Errorf("no cookies found in JSON")
	}

	cookies := make([]*http.Cookie, 0, len(cookiesJSON))
	for _, cj := range cookiesJSON {
		if cj.Name == "" || cj.Value == "" {
			continue
		}

		cookie := &http.Cookie{
			Name:     cj.Name,
			Value:    cj.Value,
			Path:     cj.Path,
			Domain:   cj.Domain,
			MaxAge:   cj.MaxAge,
			Secure:   cj.Secure,
			HttpOnly: cj.HttpOnly,
		}

		// Map SameSite
		switch cj.SameSite {
		case "Strict":
			cookie.SameSite = http.SameSiteStrictMode
		case "Lax":
			cookie.SameSite = http.SameSiteLaxMode
		case "None":
			cookie.SameSite = http.SameSiteNoneMode
		default:
			cookie.SameSite = http.SameSiteDefaultMode
		}

		cookies = append(cookies, cookie)
	}

	return cookies, nil
}

// Save saves the cookies to a JSON file with 600 permissions
func (cs *CookieStore) Save(cookies []*http.Cookie) error {
	if len(cookies) == 0 {
		return fmt.Errorf("no cookies to save")
	}

	// Convert cookies to JSON format
	cookiesJSON := make([]cookieJSON, 0, len(cookies))
	for _, c := range cookies {
		sameSite := "Default"
		switch c.SameSite {
		case http.SameSiteStrictMode:
			sameSite = "Strict"
		case http.SameSiteLaxMode:
			sameSite = "Lax"
		case http.SameSiteNoneMode:
			sameSite = "None"
		}

		cookiesJSON = append(cookiesJSON, cookieJSON{
			Name:     c.Name,
			Value:    c.Value,
			Path:     c.Path,
			Domain:   c.Domain,
			MaxAge:   c.MaxAge,
			Secure:   c.Secure,
			HttpOnly: c.HttpOnly,
			SameSite: sameSite,
		})
	}

	// Serialize to JSON
	data, err := json.MarshalIndent(cookiesJSON, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal cookies: %w", err)
	}

	// Create directory if it doesn't exist
	dir := filepath.Dir(cs.path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// Save with 600 permissions (read/write for owner only)
	if err := os.WriteFile(cs.path, data, 0600); err != nil {
		return fmt.Errorf("failed to write cookies file: %w", err)
	}

	return nil
}

// Load loads the cookies from the file
func (cs *CookieStore) Load() ([]*http.Cookie, error) {
	// Verify that the file exists
	if _, err := os.Stat(cs.path); os.IsNotExist(err) {
		return nil, fmt.Errorf("cookies file not found: %s", cs.path)
	}

	// Read file
	data, err := os.ReadFile(cs.path)
	if err != nil {
		return nil, fmt.Errorf("failed to read cookies file: %w", err)
	}

	// Parse cookies
	cookies, err := ParseCookiesJSON(string(data))
	if err != nil {
		return nil, fmt.Errorf("failed to parse cookies: %w", err)
	}

	return cookies, nil
}

// Exists checks if the cookies file exists
func (cs *CookieStore) Exists() bool {
	_, err := os.Stat(cs.path)
	return err == nil
}

// Delete removes the cookies file
func (cs *CookieStore) Delete() error {
	if !cs.Exists() {
		return nil
	}
	return os.Remove(cs.path)
}

package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"time"

	"golang.org/x/time/rate"
)

const (
	baseURL   = "https://learning.oreilly.com"
	userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

// Client is the main HTTP client for interacting with the O'Reilly API
type Client struct {
	httpClient *http.Client
	baseURL    string
	limiter    *rate.Limiter
}

// NewClient creates a new API client with the provided cookies
func NewClient(cookies []*http.Cookie) (*Client, error) {
	jar, err := cookiejar.New(nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create cookie jar: %w", err)
	}

	u, err := url.Parse(baseURL)
	if err != nil {
		return nil, fmt.Errorf("invalid base URL: %w", err)
	}
	jar.SetCookies(u, cookies)

	httpClient := &http.Client{
		Jar:     jar,
		Timeout: 30 * time.Second,
	}

	limiter := rate.NewLimiter(rate.Limit(10), 1)

	return &Client{
		httpClient: httpClient,
		baseURL:    baseURL,
		limiter:    limiter,
	}, nil
}

// doRequest performs an HTTP request with rate limiting and common headers
func (c *Client) doRequest(ctx context.Context, method, path string, body interface{}) (*http.Response, error) {
	if err := c.limiter.Wait(ctx); err != nil {
		return nil, fmt.Errorf("rate limiter error: %w", err)
	}

	fullURL := c.baseURL + path

	req, err := http.NewRequestWithContext(ctx, method, fullURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("User-Agent", userAgent)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}

	return resp, nil
}

// ValidateSession validates the current session by calling the /api/v1/me/ endpoint
func (c *Client) ValidateSession(ctx context.Context) (*UserProfile, error) {
	resp, err := c.doRequest(ctx, http.MethodGet, "/api/v1/me/", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("session expired or invalid")
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var profile UserProfile
	if err := json.NewDecoder(resp.Body).Decode(&profile); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if !profile.Subscription.Active {
		return nil, fmt.Errorf("active subscription required")
	}

	return &profile, nil
}

// UserProfile represents the user's profile
type UserProfile struct {
	ID           string `json:"id"`
	Email        string `json:"email"`
	FirstName    string `json:"first_name"`
	LastName     string `json:"last_name"`
	Username     string `json:"username"`
	Subscription struct {
		Active    bool      `json:"active"`
		Type      string    `json:"type"`
		ExpiresAt time.Time `json:"expires_at"`
	} `json:"subscription"`
	CreatedAt time.Time `json:"created_at"`
}

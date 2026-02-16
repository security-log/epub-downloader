package config

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// Config represents the application configuration
type Config struct {
	// DownloadPath is the directory where downloaded EPUBs are saved
	DownloadPath string `yaml:"download_path"`

	// ConcurrentDownloads is the number of simultaneous downloads
	ConcurrentDownloads int `yaml:"concurrent_downloads"`

	// RateLimitRPS is the limit of requests per second to the API
	RateLimitRPS int `yaml:"rate_limit_rps"`

	// Theme is the interface theme (dark, light)
	Theme string `yaml:"theme"`

	// AutoOpenAfterDownload opens the EPUB after downloading
	AutoOpenAfterDownload bool `yaml:"auto_open_after_download"`

	// LogLevel is the logging level (debug, info, warn, error)
	LogLevel string `yaml:"log_level"`

	// LogPath is the path to the log file (empty for stderr)
	LogPath string `yaml:"log_path"`

	// PrettyLog uses pretty format instead of JSON
	PrettyLog bool `yaml:"pretty_log"`

	// DatabasePath is the path to the SQLite database
	DatabasePath string `yaml:"database_path"`

	// CookiesPath is the path to the cookies file
	CookiesPath string `yaml:"cookies_path"`
}

// Default returns a configuration with default values
func Default() (*Config, error) {
	downloadDir, err := GetDownloadDir()
	if err != nil {
		downloadDir = "~/Books/OReilly"
	}

	dbPath, err := GetDatabasePath()
	if err != nil {
		dbPath = ""
	}

	cookiesPath, err := GetCookiesFilePath()
	if err != nil {
		cookiesPath = ""
	}

	logPath := GetDefaultLogPath()

	return &Config{
		DownloadPath:          downloadDir,
		ConcurrentDownloads:   5,
		RateLimitRPS:          10,
		Theme:                 "dark",
		AutoOpenAfterDownload: false,
		LogLevel:              "info",
		LogPath:               logPath,
		PrettyLog:             true,
		DatabasePath:          dbPath,
		CookiesPath:           cookiesPath,
	}, nil
}

// Load loads the configuration from a YAML file
func Load(path string) (*Config, error) {
	// If the file doesn't exist, create one with default values
	if _, err := os.Stat(path); os.IsNotExist(err) {
		cfg, err := Default()
		if err != nil {
			return nil, err
		}
		if err := cfg.Save(path); err != nil {
			return nil, fmt.Errorf("failed to create default config: %w", err)
		}
		return cfg, nil
	}

	// Read file
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	// Parse YAML
	cfg := &Config{}
	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	return cfg, nil
}

// Save saves the configuration to a YAML file
func (c *Config) Save(path string) error {
	// Create directory if it doesn't exist
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	// Serialize to YAML
	data, err := yaml.Marshal(c)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	// Write file
	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}

// Validate validates the configuration
func (c *Config) Validate() error {
	if c.ConcurrentDownloads < 1 || c.ConcurrentDownloads > 20 {
		return fmt.Errorf("concurrent_downloads must be between 1 and 20")
	}

	if c.RateLimitRPS < 1 || c.RateLimitRPS > 100 {
		return fmt.Errorf("rate_limit_rps must be between 1 and 100")
	}

	validLogLevels := map[string]bool{
		"debug": true,
		"info":  true,
		"warn":  true,
		"error": true,
	}
	if !validLogLevels[c.LogLevel] {
		return fmt.Errorf("invalid log_level: must be debug, info, warn, or error")
	}

	validThemes := map[string]bool{
		"dark":  true,
		"light": true,
	}
	if !validThemes[c.Theme] {
		return fmt.Errorf("invalid theme: must be dark or light")
	}

	return nil
}

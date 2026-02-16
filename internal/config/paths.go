package config

import (
	"os"
	"path/filepath"
)

const appName = "epub-downloader"

// GetConfigDir returns the configuration directory
// Follows XDG Base Directory: $XDG_CONFIG_HOME/epub-downloader or ~/.config/epub-downloader
func GetConfigDir() (string, error) {
	configHome := os.Getenv("XDG_CONFIG_HOME")
	if configHome == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		configHome = filepath.Join(home, ".config")
	}

	configDir := filepath.Join(configHome, appName)
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return "", err
	}

	return configDir, nil
}

// GetDataDir returns the local data directory
// Follows XDG Base Directory: $XDG_DATA_HOME/epub-downloader or ~/.local/share/epub-downloader
func GetDataDir() (string, error) {
	dataHome := os.Getenv("XDG_DATA_HOME")
	if dataHome == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		dataHome = filepath.Join(home, ".local", "share")
	}

	dataDir := filepath.Join(dataHome, appName)
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return "", err
	}

	return dataDir, nil
}

// GetCacheDir returns the cache directory
// Follows XDG Base Directory: $XDG_CACHE_HOME/epub-downloader or ~/.cache/epub-downloader
func GetCacheDir() (string, error) {
	cacheHome := os.Getenv("XDG_CACHE_HOME")
	if cacheHome == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		cacheHome = filepath.Join(home, ".cache")
	}

	cacheDir := filepath.Join(cacheHome, appName)
	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		return "", err
	}

	return cacheDir, nil
}

// GetDownloadDir returns the default directory for downloads
// Default: ~/Books/OReilly
func GetDownloadDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}

	downloadDir := filepath.Join(home, "Books", "OReilly")
	if err := os.MkdirAll(downloadDir, 0755); err != nil {
		return "", err
	}

	return downloadDir, nil
}

// GetConfigFilePath returns the full path to the configuration file
func GetConfigFilePath() (string, error) {
	configDir, err := GetConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(configDir, "config.yaml"), nil
}

// GetCookiesFilePath returns the full path to the cookies file
func GetCookiesFilePath() (string, error) {
	configDir, err := GetConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(configDir, "cookies.json"), nil
}

// GetDatabasePath returns the full path to the database
func GetDatabasePath() (string, error) {
	dataDir, err := GetDataDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dataDir, "app.db"), nil
}

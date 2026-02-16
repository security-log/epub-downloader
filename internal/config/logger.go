package config

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/charmbracelet/log"
)

// LogLevel represents the logging level
type LogLevel string

const (
	LogLevelDebug LogLevel = "debug"
	LogLevelInfo  LogLevel = "info"
	LogLevelWarn  LogLevel = "warn"
	LogLevelError LogLevel = "error"
)

var (
	// Logger is the global logger instance
	Logger *log.Logger
)

// InitLogger initializes the global logger with the specified configuration
func InitLogger(level LogLevel, logPath string, pretty bool) error {
	// Create log directory if it doesn't exist
	if logPath != "" {
		logDir := filepath.Dir(logPath)
		if err := os.MkdirAll(logDir, 0755); err != nil {
			return fmt.Errorf("failed to create log directory: %w", err)
		}
	}

	// Configure output
	var output *os.File
	var err error
	if logPath != "" {
		output, err = os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
		if err != nil {
			return fmt.Errorf("failed to open log file: %w", err)
		}
	} else {
		output = os.Stderr
	}

	// Create logger
	Logger = log.NewWithOptions(output, log.Options{
		ReportCaller:    level == LogLevelDebug,
		ReportTimestamp: true,
		TimeFormat:      time.DateTime,
		Prefix:          "epub-downloader",
	})

	// Configure level
	switch level {
	case LogLevelDebug:
		Logger.SetLevel(log.DebugLevel)
	case LogLevelInfo:
		Logger.SetLevel(log.InfoLevel)
	case LogLevelWarn:
		Logger.SetLevel(log.WarnLevel)
	case LogLevelError:
		Logger.SetLevel(log.ErrorLevel)
	default:
		Logger.SetLevel(log.InfoLevel)
	}

	// Configure format
	if !pretty {
		// JSON format for production
		Logger.SetFormatter(log.JSONFormatter)
	}
	// Pretty format is the default

	Logger.Info("Logger initialized",
		"level", level,
		"path", logPath,
		"pretty", pretty,
	)

	return nil
}

// GetDefaultLogPath returns the default path for the log file
func GetDefaultLogPath() string {
	dataDir, err := GetDataDir()
	if err != nil {
		return filepath.Join(os.TempDir(), "epub-downloader.log")
	}
	return filepath.Join(dataDir, "app.log")
}

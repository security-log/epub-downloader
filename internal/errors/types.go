package errors

// Error codes by category
const (
	// Authentication (AUTH_xxx)
	CodeAuthSessionExpired     = "AUTH_001"
	CodeAuthInvalidCredentials = "AUTH_002"
	CodeAuthNoSubscription     = "AUTH_003"
	CodeAuthInvalidCookies     = "AUTH_004"

	// Network and API (NET_xxx)
	CodeNetworkError   = "NET_001"
	CodeAPIError       = "NET_002"
	CodeRateLimitError = "NET_003"
	CodeTimeoutError   = "NET_004"

	// Validation (VAL_xxx)
	CodeValidationError = "VAL_001"
	CodeInvalidInput    = "VAL_002"

	// Storage (STOR_xxx)
	CodeDatabaseError = "STOR_001"
	CodeFileError     = "STOR_002"

	// EPUB (EPUB_xxx)
	CodeEPUBGenerationError = "EPUB_001"
	CodeEPUBInvalidFormat   = "EPUB_002"

	// Configuration (CFG_xxx)
	CodeConfigError       = "CFG_001"
	CodeConfigNotFound    = "CFG_002"
	CodeConfigInvalidYAML = "CFG_003"

	// Download (DL_xxx)
	CodeDownloadError    = "DL_001"
	CodeDownloadCanceled = "DL_002"
)

// Common predefined errors

var (
	// Authentication
	ErrSessionExpired = &AppError{
		Code:        CodeAuthSessionExpired,
		Message:     "Session has expired or is invalid",
		UserMessage: "Your session has expired. Please enter your cookies again.",
		Retryable:   false,
	}

	ErrInvalidCredentials = &AppError{
		Code:        CodeAuthInvalidCredentials,
		Message:     "Invalid authentication credentials",
		UserMessage: "The provided credentials are not valid.",
		Retryable:   false,
	}

	ErrNoSubscription = &AppError{
		Code:        CodeAuthNoSubscription,
		Message:     "Active O'Reilly subscription required",
		UserMessage: "You need an active O'Reilly subscription to use this feature.",
		Retryable:   false,
	}

	ErrInvalidCookies = &AppError{
		Code:        CodeAuthInvalidCookies,
		Message:     "Cookies format is invalid or incomplete",
		UserMessage: "The cookies format is invalid. Verify that they are valid cookies from learning.oreilly.com",
		Retryable:   false,
	}

	// Network and API
	ErrNetwork = &AppError{
		Code:        CodeNetworkError,
		Message:     "Network connection error",
		UserMessage: "Connection error. Check your internet connection and try again.",
		Retryable:   true,
	}

	ErrRateLimit = &AppError{
		Code:        CodeRateLimitError,
		Message:     "Rate limit exceeded",
		UserMessage: "Too many requests have been made. Wait a moment and try again.",
		Retryable:   true,
	}

	ErrTimeout = &AppError{
		Code:        CodeTimeoutError,
		Message:     "Request timeout",
		UserMessage: "The operation took too long. Try again.",
		Retryable:   true,
	}

	// Configuration
	ErrConfigNotFound = &AppError{
		Code:        CodeConfigNotFound,
		Message:     "Configuration file not found",
		UserMessage: "Configuration file not found. A new one will be created.",
		Retryable:   false,
	}
)

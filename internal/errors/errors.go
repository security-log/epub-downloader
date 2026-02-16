package errors

import "fmt"

// AppError represents an application error with additional information
// for error handling and user presentation
type AppError struct {
	Code        string // Unique error code (e.g., "AUTH_001")
	Message     string // Detailed technical message for logs
	UserMessage string // User-friendly message to display
	Retryable   bool   // Indicates if the operation can be retried
	Err         error  // Original error (if exists)
}

// Error implements the error interface
func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("[%s] %s: %v", e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

// Unwrap returns the original error for compatibility with errors.Is/As
func (e *AppError) Unwrap() error {
	return e.Err
}

// IsRetryable indicates if the error allows retries
func (e *AppError) IsRetryable() bool {
	return e.Retryable
}

// GetUserMessage returns the user-friendly message
func (e *AppError) GetUserMessage() string {
	if e.UserMessage != "" {
		return e.UserMessage
	}
	return e.Message
}

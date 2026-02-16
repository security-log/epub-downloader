package errors

import (
	"errors"
	"fmt"
)

// New creates a new AppError
func New(code, message, userMessage string, retryable bool) *AppError {
	return &AppError{
		Code:        code,
		Message:     message,
		UserMessage: userMessage,
		Retryable:   retryable,
	}
}

// Wrap wraps an existing error in an AppError
func Wrap(err error, code, message, userMessage string, retryable bool) *AppError {
	if err == nil {
		return nil
	}
	return &AppError{
		Code:        code,
		Message:     message,
		UserMessage: userMessage,
		Retryable:   retryable,
		Err:         err,
	}
}

// Wrapf wraps an error with a formatted message
func Wrapf(err error, code, userMessage string, retryable bool, format string, args ...interface{}) *AppError {
	if err == nil {
		return nil
	}
	return &AppError{
		Code:        code,
		Message:     fmt.Sprintf(format, args...),
		UserMessage: userMessage,
		Retryable:   retryable,
		Err:         err,
	}
}

// IsRetryable determines if an error is retryable
func IsRetryable(err error) bool {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr.Retryable
	}
	return false
}

// GetUserMessage extracts the user message from an error
func GetUserMessage(err error) string {
	if err == nil {
		return ""
	}

	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr.GetUserMessage()
	}

	return err.Error()
}

// GetCode extracts the error code from an AppError
func GetCode(err error) string {
	if err == nil {
		return ""
	}

	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr.Code
	}

	return ""
}

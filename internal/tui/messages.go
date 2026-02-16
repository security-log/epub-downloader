package tui

import tea "github.com/charmbracelet/bubbletea"

// NavigateMsg is the message to navigate between screens
type NavigateMsg struct {
	Screen Screen
}

// ErrorMsg is the message to show errors
type ErrorMsg struct {
	Err error
}

// SuccessMsg is the message to show successes
type SuccessMsg struct {
	Message string
}

// Navigate creates a command to navigate to a screen
func Navigate(screen Screen) tea.Cmd {
	return func() tea.Msg {
		return NavigateMsg{Screen: screen}
	}
}

// ShowError creates a command to show an error
func ShowError(err error) tea.Cmd {
	return func() tea.Msg {
		return ErrorMsg{Err: err}
	}
}

// ShowSuccess creates a command to show a success message
func ShowSuccess(message string) tea.Cmd {
	return func() tea.Msg {
		return SuccessMsg{Message: message}
	}
}

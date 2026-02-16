package models

import (
	"fmt"

	"github.com/charmbracelet/bubbles/textarea"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/rubacava/epub-downloader/internal/config"
	apperrors "github.com/rubacava/epub-downloader/internal/errors"
	"github.com/rubacava/epub-downloader/internal/tui/styles"
)

// AuthModel is the model for the authentication screen
type AuthModel struct {
	config     *config.Config
	styles     *styles.Styles
	textarea   textarea.Model
	err        error
	validating bool
	width      int
	height     int
}

// NewAuthModel creates a new authentication model
func NewAuthModel(cfg *config.Config) *AuthModel {
	ta := textarea.New()
	ta.Placeholder = `[{"name": "BrowserCookie", "value": "..."}, ...]`
	ta.Focus()
	ta.CharLimit = 0
	ta.SetWidth(80)
	ta.SetHeight(8)

	return &AuthModel{
		config:   cfg,
		styles:   styles.DefaultStyles(),
		textarea: ta,
	}
}

// Init initializes the model
func (m *AuthModel) Init() tea.Cmd {
	return textarea.Blink
}

// Update handles state updates
func (m *AuthModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.textarea.SetWidth(min(80, msg.Width-10))

	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "esc":
			return m, tea.Quit

		case "ctrl+s":
			// TODO: Validate and save cookies when API client is implemented
			m.validating = true
			config.Logger.Debug("validating cookies")

			// For now, just show a placeholder
			m.err = apperrors.New(
				"NOT_IMPL",
				"Cookie validation not implemented yet",
				"Cookie validation is not yet implemented. Continue to home for now.",
				false,
			)
			m.validating = false
			return m, nil
		}
	}

	// Update textarea
	m.textarea, cmd = m.textarea.Update(msg)
	return m, cmd
}

// View renders the model
func (m *AuthModel) View() string {
	if m.width == 0 {
		return ""
	}

	// Header
	header := m.styles.Title.Render("O'Reilly Authentication")
	subtitle := m.styles.Subtitle.Render("Enter your session cookies")

	// Instructions
	instructions := lipgloss.NewStyle().
		Foreground(styles.ColorTextDim).
		MarginTop(1).
		MarginBottom(1).
		Render(`To use this application you need O'Reilly Learning cookies.

How to get the cookies:
  1. Log in to learning.oreilly.com
  2. Open DevTools (F12) > Application > Cookies
  3. Copy all cookies in JSON format
  4. Paste them below`)

	// Textarea
	textareaView := m.textarea.View()

	// Error if exists
	errorView := ""
	if m.err != nil {
		errorView = "\n" + m.styles.Error.Render(fmt.Sprintf("❌ %s", apperrors.GetUserMessage(m.err)))
	}

	help := lipgloss.NewStyle().
		Foreground(styles.ColorTextDim).
		MarginTop(1).
		Render("ctrl+s: validate and save • esc: quit")

	content := lipgloss.JoinVertical(
		lipgloss.Left,
		header,
		subtitle,
		instructions,
		textareaView,
		errorView,
		help,
	)

	return lipgloss.Place(
		m.width,
		m.height,
		lipgloss.Center,
		lipgloss.Center,
		content,
	)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

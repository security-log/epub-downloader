package models

import (
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/rubacava/epub-downloader/internal/tui/styles"
)

// HomeModel is the model for the main screen
type HomeModel struct {
	styles  *styles.Styles
	cursor  int
	choices []string
	width   int
	height  int
}

// NewHomeModel creates a new home model
func NewHomeModel() *HomeModel {
	return &HomeModel{
		styles: styles.DefaultStyles(),
		cursor: 0,
		choices: []string{
			"🔍 Search books",
			"📚 My library",
			"📥 Download history",
			"⚙️  Settings",
			"❌ Exit",
		},
	}
}

// Init initializes the model
func (m *HomeModel) Init() tea.Cmd {
	return nil
}

// Update handles state updates
func (m *HomeModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit

		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
			}

		case "down", "j":
			if m.cursor < len(m.choices)-1 {
				m.cursor++
			}

		case "enter":
			// TODO: Navigate to corresponding screen
			switch m.cursor {
			case 0:
				// Navigate to search
			case 1:
				// Navigate to library
			case 2:
				// Navigate to history
			case 3:
				// Navigate to settings
			case 4:
				return m, tea.Quit
			}
		}
	}

	return m, nil
}

// View renders the model
func (m *HomeModel) View() string {
	if m.width == 0 {
		return ""
	}

	header := m.styles.Title.Render("O'Reilly EPUB Downloader")
	subtitle := m.styles.Subtitle.Render("Terminal User Interface")

	var menuItems []string
	for i, choice := range m.choices {
		cursor := "  "
		if m.cursor == i {
			cursor = "▶ "
			choice = m.styles.ListItemActive.Render(choice)
		} else {
			choice = m.styles.ListItem.Render(choice)
		}
		menuItems = append(menuItems, cursor+choice)
	}

	menu := lipgloss.JoinVertical(lipgloss.Left, menuItems...)

	help := lipgloss.NewStyle().
		Foreground(styles.ColorTextDim).
		MarginTop(2).
		Render("↑/k: up • ↓/j: down • enter: select • q: quit")

	content := lipgloss.JoinVertical(
		lipgloss.Left,
		header,
		subtitle,
		"",
		menu,
		help,
	)

	return lipgloss.Place(
		m.width,
		m.height,
		lipgloss.Center,
		lipgloss.Center,
		m.styles.Border.Render(content),
	)
}

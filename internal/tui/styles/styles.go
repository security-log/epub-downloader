package styles

import "github.com/charmbracelet/lipgloss"

var (
	// Primary colors
	ColorPrimary   = lipgloss.Color("#d3869b")
	ColorSecondary = lipgloss.Color("#b16286")
	ColorAccent    = lipgloss.Color("#fbf1c7")

	// State colors
	ColorSuccess = lipgloss.Color("#b8bb26")
	ColorWarning = lipgloss.Color("#fabd2f")
	ColorError   = lipgloss.Color("#fb4934")
	ColorInfo    = lipgloss.Color("#83a598")

	// Text colors
	ColorText     = lipgloss.Color("#ebdbb2")
	ColorTextDim  = lipgloss.Color("#928374")
	ColorTextGray = lipgloss.Color("#7c6f64")

	// Background colors
	ColorBg     = lipgloss.Color("#282828")
	ColorBgDark = lipgloss.Color("#1d2021")
)

// Styles contains all the application's styles
type Styles struct {
	Title    lipgloss.Style
	Subtitle lipgloss.Style
	Header   lipgloss.Style

	Success lipgloss.Style
	Warning lipgloss.Style
	Error   lipgloss.Style
	Info    lipgloss.Style

	Border       lipgloss.Style
	BorderActive lipgloss.Style
	Box          lipgloss.Style
	BoxActive    lipgloss.Style

	Text       lipgloss.Style
	TextBold   lipgloss.Style
	TextDim    lipgloss.Style
	TextItalic lipgloss.Style

	Button       lipgloss.Style
	ButtonActive lipgloss.Style
	Input        lipgloss.Style
	InputActive  lipgloss.Style

	ListItem       lipgloss.Style
	ListItemActive lipgloss.Style
	ListTitle      lipgloss.Style

	Help    lipgloss.Style
	HelpKey lipgloss.Style
}

// DefaultStyles returns the default styles
func DefaultStyles() *Styles {
	return &Styles{
		Title: lipgloss.NewStyle().
			Bold(true).
			Foreground(ColorPrimary).
			MarginBottom(1),

		Subtitle: lipgloss.NewStyle().
			Foreground(ColorSecondary).
			MarginBottom(1),

		Header: lipgloss.NewStyle().
			Bold(true).
			Foreground(ColorText).
			Background(ColorPrimary).
			Padding(0, 1),

		Success: lipgloss.NewStyle().
			Foreground(ColorSuccess).
			Bold(true),

		Warning: lipgloss.NewStyle().
			Foreground(ColorWarning).
			Bold(true),

		Error: lipgloss.NewStyle().
			Foreground(ColorError).
			Bold(true),

		Info: lipgloss.NewStyle().
			Foreground(ColorInfo),

		Border: lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(ColorTextDim).
			Padding(1, 2),

		BorderActive: lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(ColorPrimary).
			Padding(1, 2),

		Box: lipgloss.NewStyle().
			Border(lipgloss.NormalBorder()).
			BorderForeground(ColorTextDim).
			Padding(0, 1),

		BoxActive: lipgloss.NewStyle().
			Border(lipgloss.NormalBorder()).
			BorderForeground(ColorPrimary).
			Padding(0, 1),

		Text: lipgloss.NewStyle().
			Foreground(ColorText),

		TextBold: lipgloss.NewStyle().
			Foreground(ColorText).
			Bold(true),

		TextDim: lipgloss.NewStyle().
			Foreground(ColorTextDim),

		TextItalic: lipgloss.NewStyle().
			Foreground(ColorText).
			Italic(true),

		Button: lipgloss.NewStyle().
			Foreground(ColorText).
			Background(ColorTextDim).
			Padding(0, 2).
			MarginRight(1),

		ButtonActive: lipgloss.NewStyle().
			Foreground(ColorAccent).
			Background(ColorPrimary).
			Padding(0, 2).
			MarginRight(1).
			Bold(true),

		Input: lipgloss.NewStyle().
			Border(lipgloss.NormalBorder()).
			BorderForeground(ColorTextDim).
			Padding(0, 1),

		InputActive: lipgloss.NewStyle().
			Border(lipgloss.NormalBorder()).
			BorderForeground(ColorPrimary).
			Padding(0, 1),

		ListItem: lipgloss.NewStyle().
			Foreground(ColorText).
			PaddingLeft(2),

		ListItemActive: lipgloss.NewStyle().
			Foreground(ColorPrimary).
			PaddingLeft(0).
			Bold(true),

		ListTitle: lipgloss.NewStyle().
			Foreground(ColorText).
			Bold(true).
			MarginBottom(1),

		Help: lipgloss.NewStyle().
			Foreground(ColorTextDim),

		HelpKey: lipgloss.NewStyle().
			Foreground(ColorPrimary).
			Bold(true),
	}
}

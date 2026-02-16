package tui

import (
	tea "github.com/charmbracelet/bubbletea"
	"github.com/rubacava/epub-downloader/internal/config"
	"github.com/rubacava/epub-downloader/internal/tui/models"
	"github.com/rubacava/epub-downloader/internal/tui/styles"
)

type Screen int

const (
	ScreenAuth Screen = iota
	ScreenHome
	ScreenSearch
	ScreenDetail
	ScreenDownload
	ScreenLibrary
	ScreenHistory
)

// App is the main TUI application model
type App struct {
	screen Screen
	models map[Screen]tea.Model
	config *config.Config
	styles *styles.Styles
	keys   KeyMap
	width  int
	height int
	ready  bool
}

// NewApp creates a new instance of the application
func NewApp(cfg *config.Config) *App {
	app := &App{
		screen: ScreenAuth,
		models: make(map[Screen]tea.Model),
		config: cfg,
		styles: styles.DefaultStyles(),
		keys:   DefaultKeyMap(),
		ready:  false,
	}

	// Initialize models
	app.models[ScreenAuth] = models.NewAuthModel(cfg)
	app.models[ScreenHome] = models.NewHomeModel()
	// TODO: Initialize other models when implemented
	// app.models[ScreenSearch] = models.NewSearchModel()
	// app.models[ScreenDetail] = models.NewDetailModel()
	// app.models[ScreenDownload] = models.NewDownloadModel()
	// app.models[ScreenLibrary] = models.NewLibraryModel()
	// app.models[ScreenHistory] = models.NewHistoryModel()

	return app
}

// Init initializes the application
func (a *App) Init() tea.Cmd {
	return a.models[a.screen].Init()
}

// Update handles state updates
func (a *App) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		a.width = msg.Width
		a.height = msg.Height
		a.ready = true

		var cmds []tea.Cmd
		for screen, model := range a.models {
			newModel, cmd := model.Update(msg)
			a.models[screen] = newModel
			cmds = append(cmds, cmd)
		}
		return a, tea.Batch(cmds...)

	case NavigateMsg:
		a.screen = msg.Screen
		config.Logger.Info("navigating to screen", "screen", a.screen)

		if model, ok := a.models[a.screen]; ok {
			return a, model.Init()
		}
		return a, nil

	case ErrorMsg:
		config.Logger.Error("error occurred", "error", msg.Err)

		if model, ok := a.models[a.screen]; ok {
			newModel, cmd := model.Update(msg)
			a.models[a.screen] = newModel
			return a, cmd
		}
		return a, nil

	case SuccessMsg:
		config.Logger.Info("success", "message", msg.Message)

		if model, ok := a.models[a.screen]; ok {
			newModel, cmd := model.Update(msg)
			a.models[a.screen] = newModel
			return a, cmd
		}
		return a, nil

	case tea.KeyMsg:
		switch {
		case msg.String() == "ctrl+c":
			config.Logger.Info("application quit by user")
			return a, tea.Quit
		}
	}

	if model, ok := a.models[a.screen]; ok {
		newModel, cmd := model.Update(msg)
		a.models[a.screen] = newModel
		return a, cmd
	}

	return a, nil
}

// View renders the application
func (a *App) View() string {
	if !a.ready {
		return "\n  Initializing..."
	}

	if model, ok := a.models[a.screen]; ok {
		return model.View()
	}

	return "\n  Screen not found"
}

.PHONY: build run test clean install lint fmt vet help

# Variables
BINARY_NAME=epub-downloader
MAIN_PATH=./cmd/epub-downloader
INSTALL_PATH=$(shell go env GOPATH)/bin

all: build

build:
	@echo "Building $(BINARY_NAME)..."
	go build -o $(BINARY_NAME) $(MAIN_PATH)

run: build
	@echo "Running $(BINARY_NAME)..."
	./$(BINARY_NAME)

test:
	@echo "Running tests..."
	go test -v -race ./...

test-coverage:
	@echo "Running tests with coverage..."
	go test -v -race -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report generated: coverage.html"

clean:
	@echo "Cleaning..."
	rm -f $(BINARY_NAME)
	rm -f coverage.out coverage.html
	rm -rf dist/

install:
	@echo "Installing to $(INSTALL_PATH)..."
	go install $(MAIN_PATH)

lint:
	@echo "Running linters..."
	@if command -v golangci-lint >/dev/null 2>&1; then \
		golangci-lint run; \
	else \
		echo "golangci-lint not installed. Install with: go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest"; \
	fi

fmt:
	@echo "Formatting code..."
	go fmt ./...

vet:
	@echo "Running go vet..."
	go vet ./...

deps:
	@echo "Downloading dependencies..."
	go mod download
	go mod verify

tidy:
	@echo "Tidying dependencies..."
	go mod tidy

help:
	@echo "Makefile commands:"
	@grep -E '^## ' Makefile | sed 's/## /  /'

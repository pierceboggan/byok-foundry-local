# Change Log

All notable changes to the "foundry-local" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.1] - 2024-12-19

### Added
- Initial implementation of Foundry Local VS Code extension
- Integration with Foundry Local service for local AI model management
- Model discovery and management capabilities
- Configuration interface for Foundry Local connection settings
- Service status monitoring and health checks
- Token counting utilities for model usage estimation
- Command palette integration for common operations
- Foundation for GitHub Copilot chat provider integration
- Comprehensive logging and error handling
- Auto-refresh capabilities for model discovery
- Support for streaming chat responses (ready for future API integration)

### Features
- **Model Management**: Discover, load, unload, and manage local AI models
- **Service Integration**: Connect to Foundry Local instances with configurable endpoints
- **Configuration**: User-friendly settings for endpoint, port, API keys, and preferences
- **Status Monitoring**: Real-time monitoring of service availability and model status
- **Command Interface**: Easy-to-use commands for model selection and service management
- **Error Handling**: Robust error handling with detailed logging and user feedback
- **Token Estimation**: Built-in token counting for managing model context limits

### Technical Implementation
- TypeScript-based architecture with proper type definitions
- Service-oriented design with separate concerns for configuration, discovery, and communication
- Event-driven model updates with proper cleanup
- Axios-based HTTP client for Foundry Local API communication
- VS Code extension best practices with proper activation and disposal
- Modular structure ready for future enhancements

### Developer Experience
- Comprehensive logging with configurable levels
- Proper error handling and user feedback
- TypeScript types for all major interfaces
- Modular architecture for easy extension
- Command palette integration for discoverability
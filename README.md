# Foundry Local VS Code Extension

This VS Code extension integrates Foundry Local with GitHub Copilot chat, allowing users to bring their own local AI models and use them within VS Code's chat interface.

## Features

- **Foundry Local Integration**: Connect to your local Foundry Local instance
- **Model Management**: Discover, load, and manage local AI models
- **GitHub Copilot Chat Provider**: Use local models seamlessly with GitHub Copilot chat (when API becomes available)
- **Configuration Management**: Easy setup and configuration of Foundry Local connection
- **Status Monitoring**: Real-time monitoring of service status and model availability
- **Token Counting**: Built-in token estimation for model usage

## Requirements

- VS Code version 1.101.0 or higher
- Foundry Local instance running locally
- Network access to your Foundry Local service

## Extension Settings

This extension contributes the following settings:

- `foundryLocal.endpoint`: Foundry Local API endpoint URL (default: `http://localhost`)
- `foundryLocal.port`: Foundry Local API port (default: `8000`)
- `foundryLocal.apiKey`: API key for Foundry Local (if required)
- `foundryLocal.timeout`: Request timeout in milliseconds (default: `30000`)
- `foundryLocal.maxRetries`: Maximum number of request retries (default: `3`)
- `foundryLocal.defaultModel`: Default model ID to use for chat
- `foundryLocal.autoStart`: Automatically start service monitoring on extension activation
- `foundryLocal.logLevel`: Log level for debugging (`debug`, `info`, `warn`, `error`)

## Commands

The extension provides the following commands:

- `Foundry Local: Refresh Models` - Refresh the list of available models
- `Foundry Local: Select Model` - Select the default model for chat
- `Foundry Local: Show Status` - Show current service status and model information
- `Foundry Local: Open Settings` - Open extension settings

## Getting Started

1. **Install the extension** from the VS Code marketplace
2. **Start Foundry Local** on your local machine (default: `http://localhost:8000`)
3. **Configure the extension** via VS Code settings if your Foundry Local runs on a different endpoint
4. **Load models** in Foundry Local
5. **Refresh models** using the command palette (`Cmd/Ctrl+Shift+P` → "Foundry Local: Refresh Models")
6. **Select a default model** using the command palette ("Foundry Local: Select Model")

## Configuration

### Basic Setup

1. Open VS Code Settings (`Cmd/Ctrl+,`)
2. Search for "foundry local"
3. Configure your Foundry Local endpoint and port
4. Set your preferred default model

### Advanced Configuration

For advanced users, you can configure additional settings like timeout, retry behavior, and logging level through the settings interface.

## Architecture

The extension is built with the following components:

- **Chat Provider**: Implements the proposed VS Code Language Model API for seamless integration
- **Model Discovery**: Manages model discovery and lifecycle
- **Foundry Local Service**: Handles API communication with Foundry Local
- **Configuration Manager**: Manages extension settings and validation
- **Utilities**: Token counting, logging, and helper functions

## API Integration

This extension is designed to integrate with the proposed VS Code Language Model API (`LanguageModelChatProvider2`). When this API becomes stable and available, the extension will automatically register as a chat provider for GitHub Copilot.

Currently, the extension provides:
- Model management and discovery
- Service status monitoring
- Configuration interface
- Foundry Local API integration

## Development

### Building from Source

```bash
git clone https://github.com/pierceboggan/byok-foundry-local.git
cd byok-foundry-local/foundry-local
npm install
npm run compile
```

### Running Tests

```bash
npm test
```

### Debugging

1. Open the project in VS Code
2. Press `F5` to start debugging
3. A new Extension Development Host window will open
4. Test the extension in the new window

## Troubleshooting

### Common Issues

**Cannot connect to Foundry Local**
- Ensure Foundry Local is running on the configured endpoint
- Check firewall settings
- Verify the endpoint URL and port in settings

**No models available**
- Ensure models are loaded in Foundry Local
- Use "Foundry Local: Refresh Models" command
- Check the extension logs for detailed error information

**Performance issues**
- Adjust timeout settings for slower models
- Monitor token usage and model context limits
- Check Foundry Local resource usage

### Viewing Logs

Use the "Foundry Local: Show Status" command and click "View Logs" to see detailed logging information.

## Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Release Notes

### 0.0.1

Initial release of Foundry Local VS Code extension featuring:
- Foundry Local service integration
- Model discovery and management
- Configuration interface
- Status monitoring
- Foundation for GitHub Copilot chat integration

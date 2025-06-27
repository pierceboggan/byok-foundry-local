# Foundry Local Extension - Language Model Chat Provider Implementation

## Overview

This extension implements a Language Model Chat Provider for VS Code that integrates Foundry Local models with VS Code's Chat and Language Model APIs. The implementation enables Foundry Local models to appear in VS Code's "Manage Models" dropdown and be used by other extensions.

## Key Features

### 1. Language Model Chat Provider Integration
- **`FoundryLanguageModelChatProvider`** - Implements VS Code's `LanguageModelChatProvider2` interface
- **Model Discovery** - Automatically discovers available Foundry Local models
- **VS Code Integration** - Models appear in "Manage Models" dropdown with proper metadata
- **Token Counting** - Provides accurate token usage estimation

### 2. Backward Compatible Chat Participant
- **`@foundry-local` participant** - Direct chat interaction in VS Code Chat
- **Streaming responses** - Real-time response streaming from Foundry Local
- **Context aware** - Maintains conversation history

### 3. Robust Service Architecture
- **ModelDiscovery** - Handles model discovery and caching
- **FoundryLocalService** - Manages communication with Foundry Local API
- **ConfigurationManager** - Centralized configuration management
- **Logger** - Comprehensive logging with multiple levels

## Installation & Setup

### Prerequisites
- VS Code 1.101.0 or later
- Foundry Local running locally (default: http://localhost:8080)

### Configuration
The extension can be configured through VS Code settings (`foundryLocal.*`):

```json
{
  "foundryLocal.endpoint": "http://localhost",
  "foundryLocal.port": 8080,
  "foundryLocal.timeout": 30000,
  "foundryLocal.maxRetries": 3,
  "foundryLocal.defaultModel": "your-model-id",
  "foundryLocal.logLevel": "info"
}
```

## Usage

### 1. Using Language Model API
Once installed, Foundry Local models will appear in:
- VS Code's "Manage Models" dropdown
- Language model selection interfaces
- Other extensions that use VS Code's Language Model API

### 2. Using Chat Participant
In VS Code Chat, use the `@foundry-local` participant:
```
@foundry-local What is TypeScript?
```

### 3. Commands
The extension provides several commands accessible via Command Palette:

- **Foundry Local: Refresh Models** - Manually refresh model list
- **Foundry Local: Select Model** - Set default model
- **Foundry Local: Load Model** - Load a specific model
- **Foundry Local: Unload Model** - Unload a specific model
- **Foundry Local: Show Status** - Display service status
- **Foundry Local: Open Settings** - Open extension settings

## API Implementation Details

### Language Model Chat Provider Registration
```typescript
// Registers with VS Code's Language Model API
vscode.lm.registerChatModelProvider('foundry-local', provider, metadata);
```

### Provider Interface Implementation
```typescript
interface LanguageModelChatProvider2 {
  prepareLanguageModelChat(options, token): Promise<ModelInfo[]>
  provideLanguageModelChatResponse(model, messages, options, progress, token): Promise<void>
  provideTokenCount(model, text, token): Promise<number>
}
```

### Metadata Configuration
```typescript
const metadata = {
  vendor: 'Foundry Local',
  name: 'Foundry Local Models',
  family: 'foundry-local',
  isUserSelectable: true,
  capabilities: { vision: false, toolCalling: false },
  category: { label: 'Local Models', order: 10 }
};
```

## Development

### Building the Extension
```bash
npm install
npm run compile
npm run lint
```

### Testing
```bash
npm test  # Requires VS Code environment
```

### Project Structure
```
src/
├── extension.ts                     # Main extension entry point
├── types/foundryLocal.ts           # TypeScript interfaces
├── utils/
│   ├── logger.ts                   # Logging utility
│   └── tokenCounter.ts             # Token estimation
├── services/
│   ├── configurationManager.ts    # Settings management
│   └── foundryLocalService.ts     # Foundry Local API client
└── providers/
    ├── modelDiscovery.ts           # Model discovery service
    ├── foundryLocalChatProvider.ts # Chat participant
    └── foundryLanguageModelChatProvider.ts # Language Model API
```

## Proposed API Usage

This extension uses VS Code's proposed Chat Provider API. The `vscode.proposed.chatProvider.d.ts` file contains the necessary type definitions for:

- `LanguageModelChatProvider2` interface
- `LanguageModelChatInformation` metadata
- `ChatResponseProviderMetadata` configuration
- `lm.registerChatModelProvider` function

## Error Handling

The implementation includes comprehensive error handling:
- **API Availability Checks** - Graceful fallback if proposed APIs are not available
- **Network Error Handling** - Retry logic with exponential backoff
- **Model Loading Validation** - Checks model availability before use
- **Type Safety** - Proper type assertions for proposed API compatibility

## Logging

Comprehensive logging is available at multiple levels:
- **DEBUG** - Detailed execution information
- **INFO** - General operational messages
- **WARN** - Warning conditions
- **ERROR** - Error conditions with stack traces

Access logs via the "Foundry Local" output channel in VS Code.

## Contributing

When contributing to this extension:

1. Ensure TypeScript compilation passes: `npm run compile`
2. Run linting: `npm run lint` 
3. Test with actual VS Code environment
4. Maintain backward compatibility with chat participant
5. Update this documentation for new features

## Troubleshooting

### Models Not Appearing in VS Code
1. Check that Foundry Local is running and accessible
2. Verify extension is loaded: Check VS Code Extensions view
3. Refresh models: Use "Foundry Local: Refresh Models" command
4. Check logs: Open "Foundry Local" output channel

### Chat Participant Not Working
1. Ensure at least one model is loaded in Foundry Local
2. Check default model configuration
3. Verify Foundry Local connectivity
4. Review error messages in chat response

### Configuration Issues
1. Validate settings using "Foundry Local: Show Status" command
2. Reset to defaults if needed
3. Check Foundry Local endpoint accessibility
4. Review timeout and retry settings

---

## Extension Guidelines

This extension follows VS Code's [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines) and implements best practices for:

- Language Model API integration
- Chat participant implementation
- Configuration management
- Error handling and logging
- TypeScript development

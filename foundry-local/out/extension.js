"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __importStar(require("vscode"));
// Import our services and providers
const logger_1 = require("./utils/logger");
const configurationManager_1 = require("./services/configurationManager");
const foundryLocalService_1 = require("./services/foundryLocalService");
const modelDiscovery_1 = require("./providers/modelDiscovery");
const foundryLocalChatProvider_1 = require("./providers/foundryLocalChatProvider");
const foundryLocal_1 = require("./types/foundryLocal");
// Global instances
let logger;
let configManager;
let foundryService;
let modelDiscovery;
let chatProviderFactory;
let languageModelProviderDisposables = [];
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate(context) {
    console.log('Activating Foundry Local extension...');
    // Initialize logger
    logger = logger_1.Logger.getInstance();
    logger.info('Foundry Local extension is being activated');
    // Initialize services
    configManager = configurationManager_1.ConfigurationManager.getInstance();
    foundryService = foundryLocalService_1.FoundryLocalService.getInstance();
    modelDiscovery = modelDiscovery_1.ModelDiscovery.getInstance();
    chatProviderFactory = foundryLocalChatProvider_1.FoundryLocalChatProviderFactory.getInstance();
    // Set up log level from configuration
    const logLevel = configManager.getLogLevel();
    switch (logLevel) {
        case 'debug':
            logger.setLogLevel(logger_1.LogLevel.DEBUG);
            break;
        case 'warn':
            logger.setLogLevel(logger_1.LogLevel.WARN);
            break;
        case 'error':
            logger.setLogLevel(logger_1.LogLevel.ERROR);
            break;
        default:
            logger.setLogLevel(logger_1.LogLevel.INFO);
    }
    // Register all commands
    registerCommands(context);
    // Register chat provider if the API is available
    registerChatProvider(context);
    // Register language model providers
    registerLanguageModelProviders(context);
    // Set up model discovery event handlers
    setupModelDiscoveryEvents(context);
    // Auto-start if configured
    if (configManager.getAutoStart()) {
        autoStartServices();
    }
    // Add disposables to context
    context.subscriptions.push(logger, configManager, modelDiscovery);
    // Add chat provider factory cleanup
    context.subscriptions.push({
        dispose: () => chatProviderFactory.dispose()
    });
    logger.info('Foundry Local extension activated successfully');
}
// This method is called when your extension is deactivated
function deactivate() {
    logger?.info('Foundry Local extension is being deactivated');
    chatProviderFactory?.dispose();
}
/**
 * Registers all extension commands
 */
function registerCommands(context) {
    // Refresh models command
    const refreshModelsCommand = vscode.commands.registerCommand(foundryLocal_1.COMMANDS.REFRESH_MODELS, async () => {
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Refreshing Foundry Local models...',
                cancellable: false
            }, async () => {
                await modelDiscovery.refreshModels();
                vscode.window.showInformationMessage('Models refreshed successfully');
            });
        }
        catch (error) {
            logger.error('Failed to refresh models', error);
            vscode.window.showErrorMessage(`Failed to refresh models: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });
    // Select model command
    const selectModelCommand = vscode.commands.registerCommand(foundryLocal_1.COMMANDS.SELECT_MODEL, async () => {
        try {
            const selectedModel = await modelDiscovery.showModelSelectionQuickPick({
                title: 'Select Default Model',
                onlyLoaded: true
            });
            if (selectedModel) {
                await modelDiscovery.setDefaultModel(selectedModel.id);
                vscode.window.showInformationMessage(`Default model set to: ${selectedModel.name}`);
            }
        }
        catch (error) {
            logger.error('Failed to select model', error);
            vscode.window.showErrorMessage(`Failed to select model: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });
    // Show status command
    const showStatusCommand = vscode.commands.registerCommand(foundryLocal_1.COMMANDS.SHOW_STATUS, async () => {
        try {
            const status = await foundryService.checkServiceStatus();
            const models = modelDiscovery.getModels();
            const loadedModels = models.filter(m => m.isLoaded);
            const statusMessage = `
Foundry Local Status:
• Service: ${status.isConnected ? 'Connected' : 'Disconnected'}
• Version: ${status.version || 'Unknown'}
• Models Available: ${models.length}
• Models Loaded: ${loadedModels.length}
• Last Checked: ${status.lastChecked.toLocaleString()}
				`.trim();
            vscode.window.showInformationMessage(statusMessage, 'Refresh Status', 'View Logs').then(selection => {
                if (selection === 'Refresh Status') {
                    vscode.commands.executeCommand(foundryLocal_1.COMMANDS.SHOW_STATUS);
                }
                else if (selection === 'View Logs') {
                    logger.show();
                }
            });
        }
        catch (error) {
            logger.error('Failed to get status', error);
            vscode.window.showErrorMessage(`Failed to get status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });
    // Open settings command
    const openSettingsCommand = vscode.commands.registerCommand(foundryLocal_1.COMMANDS.OPEN_SETTINGS, async () => {
        await configManager.openSettings();
    });
    // Debug command to test configuration and connection
    const debugCommand = vscode.commands.registerCommand(foundryLocal_1.COMMANDS.DEBUG, async () => {
        try {
            logger.info('=== FOUNDRY LOCAL DEBUG INFO ===');
            // Check configuration
            const config = configManager.getConfiguration();
            const apiUrl = configManager.getApiUrl();
            logger.info('Configuration:', config);
            logger.info('API URL:', apiUrl);
            // Test service connection
            logger.info('Testing service connection...');
            const status = await foundryService.checkServiceStatus();
            logger.info('Service status:', status);
            // Try to discover models
            if (status.isConnected) {
                logger.info('Attempting to discover models...');
                try {
                    const models = await foundryService.discoverModels();
                    logger.info(`Discovered ${models.length} models:`, models);
                    // Check model discovery cache
                    const cachedModels = modelDiscovery.getModels();
                    logger.info(`Cached models: ${cachedModels.length}`);
                    // Check currently registered providers
                    const registeredCount = chatProviderFactory.getRegisteredModelsCount();
                    const registeredIds = chatProviderFactory.getRegisteredModelIds();
                    logger.info(`Currently registered language model providers: ${registeredCount}`);
                    logger.info(`Registered model IDs: ${registeredIds.join(', ')}`);
                    // Try to register models (this might be 0 if already registered)
                    logger.info('Attempting to register language model providers...');
                    const disposables = chatProviderFactory.registerModelProviders();
                    logger.info(`New registrations attempted: ${disposables.length} (0 means already registered)`);
                }
                catch (modelError) {
                    logger.error('Model discovery failed:', modelError);
                }
            }
            logger.info('=== DEBUG INFO COMPLETE ===');
            // Show a summary to the user
            const registeredCount = status.isConnected ? chatProviderFactory.getRegisteredModelsCount() : 0;
            const message = `Debug complete. Check the Foundry Local logs for detailed information.
				
Configuration:
• Endpoint: ${config.endpoint}
• Port: ${config.port}
• API URL: ${apiUrl}
• Service Connected: ${status.isConnected}
• Models Discovered: ${status.isConnected ? status.modelsLoaded : 'N/A'}
• Language Model Providers: ${registeredCount}`;
            vscode.window.showInformationMessage(message, 'View Logs').then(selection => {
                if (selection === 'View Logs') {
                    logger.show();
                }
            });
        }
        catch (error) {
            logger.error('Debug command failed', error);
            vscode.window.showErrorMessage(`Debug failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });
    // Add commands to context
    context.subscriptions.push(refreshModelsCommand, selectModelCommand, showStatusCommand, openSettingsCommand, debugCommand);
    logger.info('Registered all extension commands');
}
/**
 * Registers the chat provider if the API is available
 */
function registerChatProvider(context) {
    try {
        // Create and register the chat participant
        logger.info('Registering Foundry Local chat participant');
        const chatProvider = chatProviderFactory.getProvider();
        const participant = chatProvider.getParticipant();
        // Add the participant to the context subscriptions so it gets disposed properly
        context.subscriptions.push(participant);
        logger.info('Foundry Local chat participant registered successfully');
    }
    catch (error) {
        logger.error('Failed to register chat participant', error);
    }
}
/**
 * Registers language model providers for discovered models
 */
function registerLanguageModelProviders(context) {
    try {
        logger.info('Registering Foundry Local language model providers');
        // Register current models
        const disposables = chatProviderFactory.registerModelProviders();
        // Add to context subscriptions
        context.subscriptions.push(...disposables);
        languageModelProviderDisposables.push(...disposables);
        logger.info('Foundry Local language model providers registered successfully');
    }
    catch (error) {
        logger.error('Failed to register language model providers', error);
    }
}
/**
 * Refreshes language model providers when models change
 */
function refreshLanguageModelProviders(context) {
    try {
        logger.info('Refreshing Foundry Local language model providers');
        // Dispose existing providers (they're already in context.subscriptions so will be cleaned up)
        languageModelProviderDisposables = [];
        // Register updated models
        const disposables = chatProviderFactory.refreshModelProviders();
        // Add to context subscriptions
        context.subscriptions.push(...disposables);
        languageModelProviderDisposables.push(...disposables);
        logger.info('Foundry Local language model providers refreshed successfully');
    }
    catch (error) {
        logger.error('Failed to refresh language model providers', error);
    }
}
/**
 * Sets up event handlers for model discovery
 */
function setupModelDiscoveryEvents(context) {
    // Listen for model changes
    modelDiscovery.onModelsChanged(models => {
        logger.info(`Models updated: ${models.length} models available`);
        // Show notification if no models are loaded
        const loadedModels = models.filter(m => m.isLoaded);
        if (models.length > 0 && loadedModels.length === 0) {
            vscode.window.showWarningMessage('No Foundry Local models are loaded. Load a model to enable chat functionality.', 'Refresh Models', 'Open Settings').then(selection => {
                if (selection === 'Refresh Models') {
                    vscode.commands.executeCommand(foundryLocal_1.COMMANDS.REFRESH_MODELS);
                }
                else if (selection === 'Open Settings') {
                    vscode.commands.executeCommand(foundryLocal_1.COMMANDS.OPEN_SETTINGS);
                }
            });
        }
        // Refresh language model providers when models change
        refreshLanguageModelProviders(context);
    });
}
/**
 * Auto-starts services if configured
 */
async function autoStartServices() {
    try {
        logger.info('Auto-starting Foundry Local services');
        // Check service status
        const status = await foundryService.checkServiceStatus();
        logger.debug('Auto-start service status check:', status);
        if (status.isConnected) {
            // Refresh models if service is available
            logger.info('Service is connected, refreshing models...');
            await modelDiscovery.refreshModels();
            logger.info('Auto-start completed successfully');
        }
        else {
            logger.warn('Foundry Local service is not available for auto-start');
            logger.debug('Service status details:', {
                isRunning: status.isRunning,
                isConnected: status.isConnected,
                error: status.error
            });
        }
    }
    catch (error) {
        logger.error('Auto-start failed', error);
    }
}
//# sourceMappingURL=extension.js.map
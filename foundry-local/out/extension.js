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
// Import services and providers
const logger_1 = require("./utils/logger");
const configurationManager_1 = require("./services/configurationManager");
const foundryLocalService_1 = require("./services/foundryLocalService");
const modelDiscovery_1 = require("./providers/modelDiscovery");
const foundryLocalChatProvider_1 = require("./providers/foundryLocalChatProvider");
const foundryLanguageModelChatProvider_1 = require("./providers/foundryLanguageModelChatProvider");
// Global service instances
let logger;
let configManager;
let foundryService;
let modelDiscovery;
let chatProviderFactory;
let languageModelProviderFactory;
// Command constants
const COMMANDS = {
    HELLO_WORLD: 'foundry-local.helloWorld',
    REFRESH_MODELS: 'foundry-local.refreshModels',
    SELECT_MODEL: 'foundry-local.selectModel',
    LOAD_MODEL: 'foundry-local.loadModel',
    UNLOAD_MODEL: 'foundry-local.unloadModel',
    OPEN_SETTINGS: 'foundry-local.openSettings',
    SHOW_STATUS: 'foundry-local.showStatus'
};
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
    languageModelProviderFactory = foundryLanguageModelChatProvider_1.FoundryLanguageModelChatProviderFactory.getInstance();
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
    // Register Language Model Chat Provider for VS Code model integration
    registerLanguageModelChatProvider(context);
    // Set up model discovery event handlers
    setupModelDiscoveryEvents();
    // Auto-start services if configured
    autoStartServices();
    logger.info('Foundry Local extension activated successfully');
}
/**
 * Registers all extension commands
 */
function registerCommands(context) {
    logger.info('Registering extension commands');
    // Hello World command (legacy)
    const helloWorldDisposable = vscode.commands.registerCommand(COMMANDS.HELLO_WORLD, () => {
        vscode.window.showInformationMessage('Hello World from Foundry Local!');
    });
    // Refresh models command
    const refreshModelsDisposable = vscode.commands.registerCommand(COMMANDS.REFRESH_MODELS, async () => {
        try {
            vscode.window.showInformationMessage('Refreshing Foundry Local models...');
            await modelDiscovery.refreshModels(true);
            const models = modelDiscovery.getModels();
            vscode.window.showInformationMessage(`Found ${models.length} Foundry Local models`);
        }
        catch (error) {
            logger.error('Failed to refresh models', error);
            vscode.window.showErrorMessage(`Failed to refresh models: ${error.message}`);
        }
    });
    // Select model command
    const selectModelDisposable = vscode.commands.registerCommand(COMMANDS.SELECT_MODEL, async () => {
        try {
            const models = modelDiscovery.getModels();
            if (models.length === 0) {
                vscode.window.showWarningMessage('No Foundry Local models available. Please ensure Foundry Local is running.');
                return;
            }
            const items = models.map(model => ({
                label: model.name,
                description: model.description || model.id,
                detail: `${model.isLoaded ? '✅ Loaded' : '❌ Not loaded'} | ${model.isDefault ? 'Default' : ''}`,
                model
            }));
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a Foundry Local model to set as default'
            });
            if (selected) {
                await modelDiscovery.setDefaultModel(selected.model.id);
                vscode.window.showInformationMessage(`Set ${selected.model.name} as default model`);
            }
        }
        catch (error) {
            logger.error('Failed to select model', error);
            vscode.window.showErrorMessage(`Failed to select model: ${error.message}`);
        }
    });
    // Load model command
    const loadModelDisposable = vscode.commands.registerCommand(COMMANDS.LOAD_MODEL, async () => {
        try {
            const models = modelDiscovery.getModels().filter(m => !m.isLoaded);
            if (models.length === 0) {
                vscode.window.showInformationMessage('All available models are already loaded.');
                return;
            }
            const items = models.map(model => ({
                label: model.name,
                description: model.description || model.id,
                model
            }));
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a model to load'
            });
            if (selected) {
                const success = await modelDiscovery.loadModel(selected.model.id);
                if (success) {
                    vscode.window.showInformationMessage(`Successfully loaded ${selected.model.name}`);
                }
                else {
                    vscode.window.showErrorMessage(`Failed to load ${selected.model.name}`);
                }
            }
        }
        catch (error) {
            logger.error('Failed to load model', error);
            vscode.window.showErrorMessage(`Failed to load model: ${error.message}`);
        }
    });
    // Unload model command
    const unloadModelDisposable = vscode.commands.registerCommand(COMMANDS.UNLOAD_MODEL, async () => {
        try {
            const models = modelDiscovery.getModels().filter(m => m.isLoaded);
            if (models.length === 0) {
                vscode.window.showInformationMessage('No models are currently loaded.');
                return;
            }
            const items = models.map(model => ({
                label: model.name,
                description: model.description || model.id,
                model
            }));
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a model to unload'
            });
            if (selected) {
                const success = await modelDiscovery.unloadModel(selected.model.id);
                if (success) {
                    vscode.window.showInformationMessage(`Successfully unloaded ${selected.model.name}`);
                }
                else {
                    vscode.window.showErrorMessage(`Failed to unload ${selected.model.name}`);
                }
            }
        }
        catch (error) {
            logger.error('Failed to unload model', error);
            vscode.window.showErrorMessage(`Failed to unload model: ${error.message}`);
        }
    });
    // Open settings command
    const openSettingsDisposable = vscode.commands.registerCommand(COMMANDS.OPEN_SETTINGS, () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'foundryLocal');
    });
    // Show status command
    const showStatusDisposable = vscode.commands.registerCommand(COMMANDS.SHOW_STATUS, async () => {
        try {
            const status = await foundryService.checkStatus();
            const models = modelDiscovery.getModels();
            const loadedModels = models.filter(m => m.isLoaded);
            const statusMessage = `
**Foundry Local Status**
- Service: ${status.isRunning ? '✅ Running' : '❌ Not running'}
- Reachable: ${status.isReachable ? '✅ Yes' : '❌ No'}
- Models: ${loadedModels.length}/${models.length} loaded
- Version: ${status.version || 'Unknown'}
- Last check: ${status.lastCheck.toLocaleTimeString()}
			`.trim();
            vscode.window.showInformationMessage(statusMessage);
        }
        catch (error) {
            logger.error('Failed to show status', error);
            vscode.window.showErrorMessage(`Failed to get status: ${error.message}`);
        }
    });
    // Add all commands to context subscriptions
    context.subscriptions.push(helloWorldDisposable, refreshModelsDisposable, selectModelDisposable, loadModelDisposable, unloadModelDisposable, openSettingsDisposable, showStatusDisposable);
    logger.info('Extension commands registered successfully');
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
 * Registers the Language Model Chat Provider for VS Code model integration
 */
function registerLanguageModelChatProvider(context) {
    try {
        logger.info('Registering Foundry Language Model Chat Provider');
        // Register the language model provider
        languageModelProviderFactory.registerProvider().then(registration => {
            context.subscriptions.push(registration);
            logger.info('Foundry Language Model Chat Provider registered successfully');
        }).catch(error => {
            logger.error('Failed to register Language Model Chat Provider', error);
        });
    }
    catch (error) {
        logger.error('Failed to register Language Model Chat Provider', error);
    }
}
/**
 * Sets up event handlers for model discovery
 */
function setupModelDiscoveryEvents() {
    // Listen for model changes
    modelDiscovery.onModelsChanged(models => {
        logger.info(`Models updated: ${models.length} models available`);
        // Show notification if no models are loaded
        const loadedModels = models.filter(m => m.isLoaded);
        if (models.length > 0 && loadedModels.length === 0) {
            vscode.window.showWarningMessage('No Foundry Local models are loaded. Load a model to enable chat functionality.', 'Refresh Models', 'Open Settings').then(selection => {
                if (selection === 'Refresh Models') {
                    vscode.commands.executeCommand(COMMANDS.REFRESH_MODELS);
                }
                else if (selection === 'Open Settings') {
                    vscode.commands.executeCommand(COMMANDS.OPEN_SETTINGS);
                }
            });
        }
    });
}
/**
 * Auto-starts services if configured
 */
async function autoStartServices() {
    try {
        logger.info('Auto-starting services');
        // Start periodic model discovery
        const discoveryDisposable = modelDiscovery.startPeriodicDiscovery(60000); // Every minute
        // Initial model refresh
        await modelDiscovery.refreshModels();
        logger.info('Services auto-started successfully');
    }
    catch (error) {
        logger.error('Failed to auto-start services', error);
    }
}
// This method is called when your extension is deactivated
function deactivate() {
    logger?.info('Deactivating Foundry Local extension');
    // Dispose services
    chatProviderFactory?.dispose();
    languageModelProviderFactory?.dispose();
    modelDiscovery?.dispose();
    logger?.dispose();
    console.log('Foundry Local extension deactivated');
}
//# sourceMappingURL=extension.js.map
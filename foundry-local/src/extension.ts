// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// Import our services and providers
import { Logger, LogLevel } from './utils/logger';
import { ConfigurationManager } from './services/configurationManager';
import { FoundryLocalService } from './services/foundryLocalService';
import { ModelDiscovery } from './providers/modelDiscovery';
import { FoundryLocalChatProviderFactory } from './providers/foundryLocalChatProvider';
import { COMMANDS } from './types/foundryLocal';

// Global instances
let logger: Logger;
let configManager: ConfigurationManager;
let foundryService: FoundryLocalService;
let modelDiscovery: ModelDiscovery;
let chatProviderFactory: FoundryLocalChatProviderFactory;
let languageModelProviderDisposables: vscode.Disposable[] = [];

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('Activating Foundry Local extension...');

	// Initialize logger
	logger = Logger.getInstance();
	logger.info('Foundry Local extension is being activated');

	// Initialize services
	configManager = ConfigurationManager.getInstance();
	foundryService = FoundryLocalService.getInstance();
	modelDiscovery = ModelDiscovery.getInstance();
	chatProviderFactory = FoundryLocalChatProviderFactory.getInstance();

	// Set up log level from configuration
	const logLevel = configManager.getLogLevel();
	switch (logLevel) {
		case 'debug':
			logger.setLogLevel(LogLevel.DEBUG);
			break;
		case 'warn':
			logger.setLogLevel(LogLevel.WARN);
			break;
		case 'error':
			logger.setLogLevel(LogLevel.ERROR);
			break;
		default:
			logger.setLogLevel(LogLevel.INFO);
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
	context.subscriptions.push(
		logger,
		configManager,
		modelDiscovery
	);

	// Add chat provider factory cleanup
	context.subscriptions.push({
		dispose: () => chatProviderFactory.dispose()
	});

	logger.info('Foundry Local extension activated successfully');
}

// This method is called when your extension is deactivated
export function deactivate() {
	logger?.info('Foundry Local extension is being deactivated');
	chatProviderFactory?.dispose();
}

/**
 * Registers all extension commands
 */
function registerCommands(context: vscode.ExtensionContext) {
	// Refresh models command
	const refreshModelsCommand = vscode.commands.registerCommand(
		COMMANDS.REFRESH_MODELS,
		async () => {
			try {
				await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: 'Refreshing Foundry Local models...',
						cancellable: false
					},
					async () => {
						await modelDiscovery.refreshModels();
						vscode.window.showInformationMessage('Models refreshed successfully');
					}
				);
			} catch (error) {
				logger.error('Failed to refresh models', error as Error);
				vscode.window.showErrorMessage(`Failed to refresh models: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}
	);

	// Select model command
	const selectModelCommand = vscode.commands.registerCommand(
		COMMANDS.SELECT_MODEL,
		async () => {
			try {
				const selectedModel = await modelDiscovery.showModelSelectionQuickPick({
					title: 'Select Default Model',
					onlyLoaded: true
				});

				if (selectedModel) {
					await modelDiscovery.setDefaultModel(selectedModel.id);
					vscode.window.showInformationMessage(`Default model set to: ${selectedModel.name}`);
				}
			} catch (error) {
				logger.error('Failed to select model', error as Error);
				vscode.window.showErrorMessage(`Failed to select model: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}
	);

	// Show status command
	const showStatusCommand = vscode.commands.registerCommand(
		COMMANDS.SHOW_STATUS,
		async () => {
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
						vscode.commands.executeCommand(COMMANDS.SHOW_STATUS);
					} else if (selection === 'View Logs') {
						logger.show();
					}
				});
			} catch (error) {
				logger.error('Failed to get status', error as Error);
				vscode.window.showErrorMessage(`Failed to get status: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}
	);

	// Open settings command
	const openSettingsCommand = vscode.commands.registerCommand(
		COMMANDS.OPEN_SETTINGS,
		async () => {
			await configManager.openSettings();
		}
	);

	// Debug command to test configuration and connection
	const debugCommand = vscode.commands.registerCommand(
		COMMANDS.DEBUG,
		async () => {
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
						
						// Try to register models
						logger.info('Attempting to register language model providers...');
						const disposables = chatProviderFactory.registerModelProviders();
						logger.info(`Registered ${disposables.length} language model providers`);
						
					} catch (modelError) {
						logger.error('Model discovery failed:', modelError as Error);
					}
				}
				
				logger.info('=== DEBUG INFO COMPLETE ===');
				
				// Show a summary to the user
				const message = `Debug complete. Check the Foundry Local logs for detailed information.
				
Configuration:
• Endpoint: ${config.endpoint}
• Port: ${config.port}
• API URL: ${apiUrl}
• Service Connected: ${status.isConnected}
• Models Available: ${status.isConnected ? 'Check logs' : 'N/A'}`;
				
				vscode.window.showInformationMessage(message, 'View Logs').then(selection => {
					if (selection === 'View Logs') {
						logger.show();
					}
				});
				
			} catch (error) {
				logger.error('Debug command failed', error as Error);
				vscode.window.showErrorMessage(`Debug failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}
	);

	// Add commands to context
	context.subscriptions.push(
		refreshModelsCommand,
		selectModelCommand,
		showStatusCommand,
		openSettingsCommand,
		debugCommand
	);

	logger.info('Registered all extension commands');
}

/**
 * Registers the chat provider if the API is available
 */
function registerChatProvider(context: vscode.ExtensionContext) {
	try {
		// Create and register the chat participant
		logger.info('Registering Foundry Local chat participant');
		
		const chatProvider = chatProviderFactory.getProvider();
		const participant = chatProvider.getParticipant();
		
		// Add the participant to the context subscriptions so it gets disposed properly
		context.subscriptions.push(participant);
		
		logger.info('Foundry Local chat participant registered successfully');
	} catch (error) {
		logger.error('Failed to register chat participant', error as Error);
	}
}

/**
 * Registers language model providers for discovered models
 */
function registerLanguageModelProviders(context: vscode.ExtensionContext) {
	try {
		logger.info('Registering Foundry Local language model providers');
		
		// Register current models
		const disposables = chatProviderFactory.registerModelProviders();
		
		// Add to context subscriptions
		context.subscriptions.push(...disposables);
		languageModelProviderDisposables.push(...disposables);
		
		logger.info('Foundry Local language model providers registered successfully');
	} catch (error) {
		logger.error('Failed to register language model providers', error as Error);
	}
}

/**
 * Refreshes language model providers when models change
 */
function refreshLanguageModelProviders(context: vscode.ExtensionContext) {
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
	} catch (error) {
		logger.error('Failed to refresh language model providers', error as Error);
	}
}
/**
 * Sets up event handlers for model discovery
 */
function setupModelDiscoveryEvents(context: vscode.ExtensionContext) {
	// Listen for model changes
	modelDiscovery.onModelsChanged(models => {
		logger.info(`Models updated: ${models.length} models available`);
		
		// Show notification if no models are loaded
		const loadedModels = models.filter(m => m.isLoaded);
		if (models.length > 0 && loadedModels.length === 0) {
			vscode.window.showWarningMessage(
				'No Foundry Local models are loaded. Load a model to enable chat functionality.',
				'Refresh Models',
				'Open Settings'
			).then(selection => {
				if (selection === 'Refresh Models') {
					vscode.commands.executeCommand(COMMANDS.REFRESH_MODELS);
				} else if (selection === 'Open Settings') {
					vscode.commands.executeCommand(COMMANDS.OPEN_SETTINGS);
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
		} else {
			logger.warn('Foundry Local service is not available for auto-start');
			logger.debug('Service status details:', { 
				isRunning: status.isRunning, 
				isConnected: status.isConnected, 
				error: status.error 
			});
		}
	} catch (error) {
		logger.error('Auto-start failed', error as Error);
	}
}

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
exports.FoundryLanguageModelChatProviderFactory = exports.FoundryLanguageModelChatProvider = void 0;
const vscode = __importStar(require("vscode"));
const foundryLocalService_1 = require("../services/foundryLocalService");
const modelDiscovery_1 = require("./modelDiscovery");
const tokenCounter_1 = require("../utils/tokenCounter");
const logger_1 = require("../utils/logger");
/**
 * Language Model Chat Provider for VS Code's Language Model API
 * This makes Foundry Local models appear in VS Code's "Manage Models" dropdown
 */
class FoundryLanguageModelChatProvider {
    logger = logger_1.Logger.getInstance();
    foundryService = foundryLocalService_1.FoundryLocalService.getInstance();
    modelDiscovery = modelDiscovery_1.ModelDiscovery.getInstance();
    // Event emitter for model changes
    onDidChangeEmitter = new vscode.EventEmitter();
    onDidChange = this.onDidChangeEmitter.event;
    constructor() {
        this.logger.info('Creating Foundry Language Model Chat Provider');
        // Listen for model changes and notify VS Code
        this.modelDiscovery.onModelsChanged(() => {
            this.logger.debug('Models changed, notifying VS Code');
            this.onDidChangeEmitter.fire();
        });
    }
    /**
     * Prepares language model chat by discovering available Foundry Local models
     * Called by VS Code to get the list of available models
     */
    async prepareLanguageModelChat(options, token) {
        this.logger.debug('Preparing language model chat', { silent: options.silent });
        try {
            // Refresh models from Foundry Local
            if (!options.silent) {
                await this.modelDiscovery.refreshModels();
            }
            // Get available models
            const foundryModels = this.modelDiscovery.getModels();
            // Convert to VS Code language model format
            const languageModels = foundryModels.map(model => ({
                id: `foundry-local:${model.id}`,
                name: model.name,
                family: model.family || 'foundry-local',
                vendor: model.vendor || 'Foundry Local',
                description: model.description || `Foundry Local model: ${model.name}`,
                cost: model.cost,
                version: model.version || '1.0.0',
                maxInputTokens: model.maxInputTokens || 4096,
                maxOutputTokens: model.maxOutputTokens || 2048,
                foundryModel: model
            }));
            this.logger.debug(`Prepared ${languageModels.length} language models for VS Code`);
            return languageModels;
        }
        catch (error) {
            this.logger.error('Failed to prepare language model chat', error);
            // Return empty array on error to avoid blocking VS Code
            return [];
        }
    }
    /**
     * Provides language model chat response
     * Called by VS Code when a user interacts with a Foundry Local model
     */
    async provideLanguageModelChatResponse(model, messages, options, progress, token) {
        this.logger.debug('Providing language model chat response', {
            modelId: model.id,
            messageCount: messages.length
        });
        try {
            const foundryModel = model.foundryModel;
            // Check if model is loaded
            if (!foundryModel.isLoaded) {
                throw new Error(`Model ${foundryModel.name} is not loaded. Please load the model first.`);
            }
            // Convert VS Code messages to Foundry messages
            const foundryMessages = messages.map(msg => ({
                role: msg.role,
                content: this.extractMessageContent(msg)
            }));
            // Stream the response using Foundry Local service
            return new Promise((resolve, reject) => {
                this.foundryService.streamChatRequest(foundryMessages, foundryModel, (chunk) => {
                    // Check for cancellation
                    if (token.isCancellationRequested) {
                        return;
                    }
                    // Report progress with text chunk
                    progress.report(new vscode.LanguageModelTextPart(chunk));
                }, (chatResponse) => {
                    this.logger.debug('Chat response completed', {
                        modelId: model.id,
                        usage: chatResponse.usage
                    });
                    resolve();
                }, (error) => {
                    this.logger.error('Error in language model chat response', error);
                    reject(error);
                });
            });
        }
        catch (error) {
            this.logger.error('Failed to provide language model chat response', error);
            throw error;
        }
    }
    /**
     * Provides token count for text or messages
     * Used by VS Code for token usage estimation
     */
    async provideTokenCount(model, text, token) {
        try {
            if (typeof text === 'string') {
                // Simple text token estimation
                return tokenCounter_1.TokenCounter.estimateTokens(text);
            }
            else {
                // Message token estimation
                const content = this.extractMessageContent(text);
                return tokenCounter_1.TokenCounter.estimateTokens(content);
            }
        }
        catch (error) {
            this.logger.error('Failed to provide token count', error);
            // Return a reasonable fallback
            return 0;
        }
    }
    /**
     * Extracts text content from a language model chat message
     */
    extractMessageContent(message) {
        if (typeof message.content === 'string') {
            return message.content;
        }
        // Handle array of message parts
        return message.content.map(part => {
            if (part instanceof vscode.LanguageModelTextPart) {
                return part.value;
            }
            // Handle other part types as needed
            return '';
        }).join('');
    }
    /**
     * Dispose the provider
     */
    dispose() {
        this.onDidChangeEmitter.dispose();
        this.logger.info('Disposed Foundry Language Model Chat Provider');
    }
}
exports.FoundryLanguageModelChatProvider = FoundryLanguageModelChatProvider;
/**
 * Factory for managing the Language Model Chat Provider
 */
class FoundryLanguageModelChatProviderFactory {
    static instance;
    logger = logger_1.Logger.getInstance();
    provider;
    registration;
    constructor() { }
    static getInstance() {
        if (!FoundryLanguageModelChatProviderFactory.instance) {
            FoundryLanguageModelChatProviderFactory.instance = new FoundryLanguageModelChatProviderFactory();
        }
        return FoundryLanguageModelChatProviderFactory.instance;
    }
    /**
     * Creates and registers the Language Model Chat Provider
     */
    async registerProvider() {
        if (this.registration) {
            this.logger.debug('Language Model Chat Provider already registered');
            return this.registration;
        }
        try {
            this.logger.info('Registering Foundry Language Model Chat Provider');
            // Create the provider
            this.provider = new FoundryLanguageModelChatProvider();
            // Define metadata for the provider
            const metadata = {
                vendor: 'Foundry Local',
                name: 'Foundry Local Models',
                family: 'foundry-local',
                description: 'Local language models served by Foundry Local',
                version: '1.0.0',
                maxInputTokens: 8192,
                maxOutputTokens: 4096,
                isUserSelectable: true,
                capabilities: {
                    vision: false,
                    toolCalling: false,
                    agentMode: false
                },
                category: {
                    label: 'Local Models',
                    order: 10
                }
            };
            // Register with VS Code's Language Model API
            this.registration = vscode.lm.registerChatModelProvider('foundry-local', this.provider, // Type assertion needed due to API version differences
            metadata);
            this.logger.info('Successfully registered Foundry Language Model Chat Provider');
            return this.registration;
        }
        catch (error) {
            this.logger.error('Failed to register Language Model Chat Provider', error);
            throw error;
        }
    }
    /**
     * Gets the provider instance
     */
    getProvider() {
        return this.provider;
    }
    /**
     * Dispose the provider and registration
     */
    dispose() {
        if (this.registration) {
            this.registration.dispose();
            this.registration = undefined;
        }
        if (this.provider) {
            this.provider.dispose();
            this.provider = undefined;
        }
        this.logger.info('Disposed Foundry Language Model Chat Provider Factory');
    }
}
exports.FoundryLanguageModelChatProviderFactory = FoundryLanguageModelChatProviderFactory;
//# sourceMappingURL=foundryLanguageModelChatProvider.js.map
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
exports.FoundryLocalChatProviderFactory = exports.FoundryLocalChatProvider = void 0;
const vscode = __importStar(require("vscode"));
const foundryLocalService_1 = require("../services/foundryLocalService");
const modelDiscovery_1 = require("./modelDiscovery");
const logger_1 = require("../utils/logger");
/**
 * A chat participant implementation for Foundry Local
 */
class FoundryLocalChatProvider {
    logger = logger_1.Logger.getInstance();
    foundryService = foundryLocalService_1.FoundryLocalService.getInstance();
    modelDiscovery = modelDiscovery_1.ModelDiscovery.getInstance();
    participant;
    constructor() {
        this.logger.info('Creating Foundry Local chat participant');
        // Create the chat participant
        this.participant = vscode.chat.createChatParticipant('foundry-local', this.handleChatRequest.bind(this));
        this.participant.iconPath = new vscode.ThemeIcon('robot');
    }
    /**
     * Handle chat requests from VS Code
     */
    async handleChatRequest(request, context, response, token) {
        this.logger.debug('Handling chat request', { prompt: request.prompt });
        try {
            // Get the default model or use the one specified
            const defaultModel = this.getDefaultModel();
            if (!defaultModel) {
                response.markdown('❌ No Foundry Local model is available. Please ensure Foundry Local is running and models are loaded.');
                return;
            }
            this.logger.debug(`Using model: ${defaultModel.name} (${defaultModel.id})`);
            // Check if model is loaded
            if (!defaultModel.isLoaded) {
                response.markdown(`❌ Model ${defaultModel.name} is not loaded. Please load the model first using the "Foundry Local: Select Model" command.`);
                return;
            }
            // Create messages for the language model
            const messages = this.createMessagesFromContext(request, context);
            // Send the chat request via Foundry Local
            await this.sendChatRequest(messages, response, token, defaultModel);
        }
        catch (error) {
            this.logger.error('Error handling chat request', error);
            response.markdown(`❌ Error: ${error.message}`);
        }
    }
    /**
     * Send chat request to Foundry Local and stream the response
     */
    async sendChatRequest(messages, response, token, model) {
        try {
            // Convert VS Code messages to Foundry Local format
            const foundryMessages = this.convertMessagesToFoundryFormat(messages);
            // Create the chat request
            const chatRequest = {
                model: model.id,
                messages: foundryMessages,
                stream: true,
                max_tokens: model.maxTokens
            };
            this.logger.debug('Sending streaming chat request to Foundry Local');
            // Get the streaming response
            const streamGenerator = this.foundryService.sendStreamingChatRequest(chatRequest);
            // Stream the response back to VS Code
            for await (const chunk of streamGenerator) {
                if (token.isCancellationRequested) {
                    this.logger.debug('Chat request cancelled');
                    return;
                }
                // Extract text content from the chunk
                if (chunk.choices && chunk.choices.length > 0) {
                    const choice = chunk.choices[0];
                    if (choice.delta && choice.delta.content) {
                        response.markdown(choice.delta.content);
                    }
                }
            }
            this.logger.debug('Streaming chat request completed');
        }
        catch (error) {
            this.logger.error('Error in streaming chat response', error);
            throw error;
        }
    }
    /**
     * Create messages from the chat context
     */
    createMessagesFromContext(request, context) {
        const messages = [];
        // Add conversation history
        for (const turn of context.history) {
            if (turn instanceof vscode.ChatRequestTurn) {
                messages.push(vscode.LanguageModelChatMessage.User(turn.prompt));
            }
            else if (turn instanceof vscode.ChatResponseTurn) {
                // Convert response to text
                const responseText = turn.response.map(part => {
                    if (part instanceof vscode.ChatResponseMarkdownPart) {
                        return part.value.value;
                    }
                    return '';
                }).join('');
                if (responseText.trim()) {
                    messages.push(vscode.LanguageModelChatMessage.Assistant(responseText));
                }
            }
        }
        // Add the current user message
        messages.push(vscode.LanguageModelChatMessage.User(request.prompt));
        return messages;
    }
    /**
     * Convert VS Code chat messages to Foundry Local format
     */
    convertMessagesToFoundryFormat(messages) {
        return messages.map(message => {
            // Extract text content from message content
            let content = '';
            if (Array.isArray(message.content)) {
                const textParts = message.content.filter(part => part instanceof vscode.LanguageModelTextPart);
                content = textParts.map(part => part.value).join('\n');
            }
            else {
                content = message.content;
            }
            return {
                role: message.role === vscode.LanguageModelChatMessageRole.User ? 'user' : 'assistant',
                content,
                name: message.name
            };
        });
    }
    /**
     * Get the default model to use for chat
     */
    getDefaultModel() {
        const models = this.modelDiscovery.getModels();
        this.logger.debug(`Chat provider found ${models.length} models:`, models.map(m => `${m.id} (loaded: ${m.isLoaded})`));
        // First try to get the configured default model
        const defaultModelId = vscode.workspace.getConfiguration('foundryLocal').get('defaultModel');
        if (defaultModelId) {
            const defaultModel = models.find(m => m.id === defaultModelId);
            if (defaultModel && defaultModel.isLoaded) {
                return defaultModel;
            }
        }
        // Fall back to the first loaded model
        const loadedModel = models.find(m => m.isLoaded);
        if (loadedModel) {
            return loadedModel;
        }
        // Return the first available model even if not loaded
        return models.length > 0 ? models[0] : undefined;
    }
    /**
     * Get the chat participant instance
     */
    getParticipant() {
        return this.participant;
    }
    /**
     * Dispose the chat participant
     */
    dispose() {
        this.participant.dispose();
        this.logger.info('Disposed Foundry Local chat participant');
    }
}
exports.FoundryLocalChatProvider = FoundryLocalChatProvider;
/**
 * Factory class for creating and managing the chat participant
 */
class FoundryLocalChatProviderFactory {
    static instance;
    logger = logger_1.Logger.getInstance();
    chatProvider;
    constructor() { }
    static getInstance() {
        if (!FoundryLocalChatProviderFactory.instance) {
            FoundryLocalChatProviderFactory.instance = new FoundryLocalChatProviderFactory();
        }
        return FoundryLocalChatProviderFactory.instance;
    }
    /**
     * Creates or gets the chat participant
     */
    getProvider() {
        if (!this.chatProvider) {
            this.chatProvider = new FoundryLocalChatProvider();
            this.logger.info('Created Foundry Local chat provider');
        }
        return this.chatProvider;
    }
    /**
     * Dispose the chat provider
     */
    dispose() {
        if (this.chatProvider) {
            this.chatProvider.dispose();
            this.chatProvider = undefined;
            this.logger.info('Disposed Foundry Local chat provider');
        }
    }
}
exports.FoundryLocalChatProviderFactory = FoundryLocalChatProviderFactory;
//# sourceMappingURL=foundryLocalChatProvider.js.map
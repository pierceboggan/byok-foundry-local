import * as vscode from 'vscode';
import { FoundryLocalModel, FoundryChatMessage } from '../types/foundryLocal';
import { FoundryLocalService } from '../services/foundryLocalService';
import { ModelDiscovery } from './modelDiscovery';
import { Logger } from '../utils/logger';

/**
 * A chat participant implementation for Foundry Local
 */
export class FoundryLocalChatProvider {
    private logger = Logger.getInstance();
    private foundryService = FoundryLocalService.getInstance();
    private modelDiscovery = ModelDiscovery.getInstance();
    private participant: vscode.ChatParticipant;

    constructor() {
        this.logger.info('Creating Foundry Local chat participant');
        
        // Create the chat participant
        this.participant = vscode.chat.createChatParticipant('foundry-local', this.handleChatRequest.bind(this));
        this.participant.iconPath = new vscode.ThemeIcon('robot');
    }

    /**
     * Gets the VS Code chat participant
     */
    public getParticipant(): vscode.ChatParticipant {
        return this.participant;
    }

    /**
     * Handle chat requests from VS Code
     */
    private async handleChatRequest(
        request: vscode.ChatRequest,
        context: vscode.ChatContext,
        response: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<vscode.ChatResult | void> {
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
                response.markdown(`❌ Model ${defaultModel.name} is not loaded. Please load the model first using the \"Foundry Local: Select Model\" command.`);
                return;
            }

            // Create messages for the language model
            const messages = this.createMessagesFromContext(request, context);

            // Send the chat request via Foundry Local
            await this.sendChatRequest(messages, response, token, defaultModel);

        } catch (error) {
            this.logger.error('Error handling chat request', error as Error);
            response.markdown(`❌ Error: ${(error as Error).message}`);
        }
    }

    /**
     * Get the default model to use for chat
     */
    private getDefaultModel(): FoundryLocalModel | undefined {
        const models = this.modelDiscovery.getModels();
        
        // First try to get the configured default model
        const defaultModelId = vscode.workspace.getConfiguration('foundryLocal').get<string>('defaultModel');
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
     * Create messages from the chat context
     */
    private createMessagesFromContext(
        request: vscode.ChatRequest,
        context: vscode.ChatContext
    ): vscode.LanguageModelChatMessage[] {
        const messages: vscode.LanguageModelChatMessage[] = [];

        // Add conversation history
        for (const turn of context.history) {
            if (turn instanceof vscode.ChatRequestTurn) {
                messages.push(vscode.LanguageModelChatMessage.User(turn.prompt));
            } else if (turn instanceof vscode.ChatResponseTurn) {
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
     * Send chat request to Foundry Local and stream the response
     */
    private async sendChatRequest(
        messages: vscode.LanguageModelChatMessage[],
        response: vscode.ChatResponseStream,
        token: vscode.CancellationToken,
        model: FoundryLocalModel
    ): Promise<void> {
        try {
            // Convert VS Code messages to Foundry messages
            const foundryMessages: FoundryChatMessage[] = messages.map(msg => ({
                role: msg.role as 'user' | 'assistant' | 'system',
                content: typeof msg.content === 'string' ? msg.content : msg.content.map(part => {
                    if (part instanceof vscode.LanguageModelTextPart) {
                        return part.value;
                    }
                    return '';
                }).join('')
            }));

            // Stream the response
            await this.foundryService.streamChatRequest(
                foundryMessages,
                model,
                (chunk: string) => {
                    // Check for cancellation
                    if (token.isCancellationRequested) {
                        return;
                    }
                    // Stream chunk to VS Code
                    response.markdown(chunk);
                },
                (chatResponse) => {
                    this.logger.debug('Chat request completed', {
                        model: model.id,
                        usage: chatResponse.usage
                    });
                },
                (error) => {
                    this.logger.error('Error in chat stream', error);
                    response.markdown(`\n\n❌ Error: ${error.message}`);
                }
            );
        } catch (error) {
            this.logger.error('Failed to send chat request', error as Error);
            response.markdown(`❌ Error: ${(error as Error).message}`);
        }
    }

    /**
     * Dispose the chat provider
     */
    public dispose(): void {
        this.participant.dispose();
        this.logger.info('Disposed Foundry Local chat provider');
    }
}

/**
 * Factory class for creating and managing the chat participant
 */
export class FoundryLocalChatProviderFactory {
    private static instance: FoundryLocalChatProviderFactory;
    private logger = Logger.getInstance();
    private chatProvider: FoundryLocalChatProvider | undefined;

    private constructor() {}

    public static getInstance(): FoundryLocalChatProviderFactory {
        if (!FoundryLocalChatProviderFactory.instance) {
            FoundryLocalChatProviderFactory.instance = new FoundryLocalChatProviderFactory();
        }
        return FoundryLocalChatProviderFactory.instance;
    }

    /**
     * Creates or gets the chat participant
     */
    public getProvider(): FoundryLocalChatProvider {
        if (!this.chatProvider) {
            this.chatProvider = new FoundryLocalChatProvider();
            this.logger.info('Created Foundry Local chat provider');
        }
        return this.chatProvider;
    }

    /**
     * Dispose the chat provider
     */
    public dispose(): void {
        if (this.chatProvider) {
            this.chatProvider.dispose();
            this.chatProvider = undefined;
            this.logger.info('Disposed Foundry Local chat provider');
        }
    }
}
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
                response.markdown(`❌ Model ${defaultModel.name} is not loaded. Please load the model first using the "Foundry Local: Select Model" command.`);
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
     * Send chat request to Foundry Local and stream the response
     */
    private async sendChatRequest(
        messages: vscode.LanguageModelChatMessage[],
        response: vscode.ChatResponseStream,
        token: vscode.CancellationToken,
        model: FoundryLocalModel
    ): Promise<void> {
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
        } catch (error) {
            this.logger.error('Error in streaming chat response', error as Error);
            throw error;
        }
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
     * Convert VS Code chat messages to Foundry Local format
     */
    private convertMessagesToFoundryFormat(messages: vscode.LanguageModelChatMessage[]): FoundryChatMessage[] {
        return messages.map(message => {
            // Extract text content from message content
            let content = '';
            
            if (Array.isArray(message.content)) {
                const textParts = message.content.filter(part => part instanceof vscode.LanguageModelTextPart) as vscode.LanguageModelTextPart[];
                content = textParts.map(part => part.value).join('\n');
            } else {
                content = message.content as string;
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
     * Get the chat participant instance
     */
    public getParticipant(): vscode.ChatParticipant {
        return this.participant;
    }

    /**
     * Dispose the chat participant
     */
    public dispose(): void {
        this.participant.dispose();
        this.logger.info('Disposed Foundry Local chat participant');
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
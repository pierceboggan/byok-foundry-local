import * as vscode from 'vscode';
import { FoundryLocalModel, FoundryChatMessage } from '../types/foundryLocal';
import { FoundryLocalService } from '../services/foundryLocalService';
import { ModelDiscovery } from './modelDiscovery';
import { Logger } from '../utils/logger';
import { TokenCounter } from '../utils/tokenCounter';

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
 * Language Model Chat Provider implementation for VS Code Chat Models Integration
 */
export class FoundryLocalLanguageModelProvider implements vscode.LanguageModelChatProvider {
    private logger = Logger.getInstance();
    private foundryService = FoundryLocalService.getInstance();
    private modelDiscovery = ModelDiscovery.getInstance();
    private modelId: string;

    constructor(modelId: string) {
        this.modelId = modelId;
        this.logger.info(`Creating Foundry Local language model provider for model: ${modelId}`);
    }

    /**
     * Provides language model response for a given set of messages
     */
    async provideLanguageModelResponse(
        messages: Array<vscode.LanguageModelChatMessage>,
        options: vscode.LanguageModelChatRequestOptions,
        extensionId: string,
        progress: vscode.Progress<vscode.ChatResponseFragment2>,
        token: vscode.CancellationToken
    ): Promise<any> {
        this.logger.debug('Providing language model response', { 
            messageCount: messages.length, 
            extensionId,
            modelId: this.modelId
        });

        try {
            // Find the specified model
            const model = this.modelDiscovery.getModel(this.modelId);
            if (!model) {
                throw new Error(`Model ${this.modelId} not found`);
            }

            if (!model.isLoaded) {
                throw new Error(`Model ${model.name} is not loaded`);
            }

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
            let index = 0;
            for await (const chunk of streamGenerator) {
                if (token.isCancellationRequested) {
                    this.logger.debug('Language model request cancelled');
                    return;
                }

                // Extract text content from the chunk
                if (chunk.choices && chunk.choices.length > 0) {
                    const choice = chunk.choices[0];
                    if (choice.delta && choice.delta.content) {
                        progress.report({
                            index: index++,
                            part: new vscode.LanguageModelTextPart(choice.delta.content)
                        });
                    }
                }
            }

            this.logger.debug('Language model response completed');
        } catch (error) {
            this.logger.error('Error in language model response', error as Error);
            throw error;
        }
    }

    /**
     * Provides token count for text or message
     */
    async provideTokenCount(
        text: string | vscode.LanguageModelChatMessage,
        token: vscode.CancellationToken
    ): Promise<number> {
        if (typeof text === 'string') {
            return TokenCounter.estimateTokens(text);
        } else {
            // Handle LanguageModelChatMessage
            let content = '';
            if (Array.isArray(text.content)) {
                const textParts = text.content.filter(part => part instanceof vscode.LanguageModelTextPart) as vscode.LanguageModelTextPart[];
                content = textParts.map(part => part.value).join('\n');
            } else {
                content = text.content as string;
            }
            return TokenCounter.estimateTokens(content);
        }
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
}

/**
 * Factory class for creating and managing the chat participant and language model provider
 */
export class FoundryLocalChatProviderFactory {
    private static instance: FoundryLocalChatProviderFactory;
    private logger = Logger.getInstance();
    private chatProvider: FoundryLocalChatProvider | undefined;
    private modelDiscovery = ModelDiscovery.getInstance();
    private registeredModels = new Map<string, { provider: FoundryLocalLanguageModelProvider, disposable: vscode.Disposable }>();

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
     * Register all available models as language model providers
     */
    public registerModelProviders(): vscode.Disposable[] {
        const disposables: vscode.Disposable[] = [];
        const models = this.modelDiscovery.getModels();
        
        this.logger.debug(`Attempting to register ${models.length} models as language model providers`);
        
        for (const model of models) {
            const disposable = this.registerModelProvider(model);
            if (disposable) {
                disposables.push(disposable);
            }
        }

        this.logger.info(`Registered ${disposables.length} language model providers`);
        return disposables;
    }

    /**
     * Register a single model as a language model provider
     */
    private registerModelProvider(model: FoundryLocalModel): vscode.Disposable | undefined {
        try {
            this.logger.debug(`Attempting to register model: ${model.name} (${model.id})`);
            
            // Skip if already registered
            if (this.registeredModels.has(model.id)) {
                this.logger.debug(`Model ${model.id} already registered, skipping`);
                return undefined;
            }

            // Create a new provider instance for this model
            const provider = new FoundryLocalLanguageModelProvider(model.id);
            
            // Create metadata for this specific model
            const metadata: vscode.ChatResponseProviderMetadata = {
                vendor: 'Foundry Local',
                name: model.name,
                family: model.provider || 'foundry-local',
                description: model.description || `Local AI model: ${model.name}`,
                version: '1.0.0',
                maxInputTokens: model.contextLength || model.maxTokens || 4096,
                maxOutputTokens: model.maxTokens || 2048,
                isUserSelectable: true,
                capabilities: {
                    vision: model.capabilities.vision,
                    toolCalling: model.capabilities.toolCalling
                },
                category: {
                    label: 'Foundry Local',
                    order: 100
                }
            };

            this.logger.debug(`Registering model ${model.id} with metadata:`, metadata);

            // Register with VS Code
            const disposable = vscode.lm.registerChatModelProvider(
                model.id,
                provider,
                metadata
            );

            this.registeredModels.set(model.id, { provider, disposable });
            this.logger.debug(`Successfully registered language model provider for model: ${model.name} (${model.id})`);
            
            return disposable;
        } catch (error) {
            this.logger.error(`Failed to register language model provider for model ${model.name}`, error as Error);
            return undefined;
        }
    }

    /**
     * Unregister a model provider
     */
    public unregisterModelProvider(modelId: string): void {
        const entry = this.registeredModels.get(modelId);
        if (entry) {
            entry.disposable.dispose();
            this.registeredModels.delete(modelId);
            this.logger.debug(`Unregistered language model provider for model: ${modelId}`);
        }
    }

    /**
     * Refresh model providers based on current models
     */
    public refreshModelProviders(): vscode.Disposable[] {
        // Unregister all existing providers
        this.disposeModelProviders();
        
        // Register current models
        return this.registerModelProviders();
    }

    /**
     * Dispose all model providers
     */
    private disposeModelProviders(): void {
        for (const [modelId, entry] of this.registeredModels.entries()) {
            entry.disposable.dispose();
        }
        this.registeredModels.clear();
        this.logger.debug('Disposed all language model providers');
    }

    /**
     * Dispose the chat provider and language model providers
     */
    public dispose(): void {
        if (this.chatProvider) {
            this.chatProvider.dispose();
            this.chatProvider = undefined;
            this.logger.info('Disposed Foundry Local chat provider');
        }

        this.disposeModelProviders();
    }

    /**
     * Get the count of currently registered model providers
     */
    public getRegisteredModelsCount(): number {
        return this.registeredModels.size;
    }

    /**
     * Get the IDs of currently registered models
     */
    public getRegisteredModelIds(): string[] {
        return Array.from(this.registeredModels.keys());
    }
}
import * as vscode from 'vscode';
import { FoundryLocalModel, FoundryChatMessage } from '../types/foundryLocal';
import { FoundryLocalService } from '../services/foundryLocalService';
import { ModelDiscovery } from './modelDiscovery';
import { TokenCounter } from '../utils/tokenCounter';
import { Logger } from '../utils/logger';

/**
 * Type definitions for the proposed VS Code Language Model API
 * These may not be available in all VS Code versions
 */
interface LanguageModelTextPart {
    kind: 'text';
    text: string;
}

interface LanguageModelToolCallPart {
    kind: 'toolCall';
    callId: string;
    name: string;
    parameters: any;
}

interface LanguageModelToolResultPart {
    kind: 'toolResult';
    callId: string;
    content: string;
}

type LanguageModelChatMessagePart = LanguageModelTextPart | LanguageModelToolCallPart | LanguageModelToolResultPart;

interface LanguageModelChatMessage {
    role: 'user' | 'assistant';
    content: LanguageModelChatMessagePart[];
    name?: string;
}

interface LanguageModelChatRequest {
    messages: LanguageModelChatMessage[];
    options: LanguageModelChatRequestOptions;
}

interface LanguageModelChatRequestOptions {
    justification?: string;
}

interface LanguageModelChatResponse {
    text: AsyncIterable<string>;
}

interface LanguageModelCountTokensRequest {
    text: string;
}

interface LanguageModelCountTokensResponse {
    tokenCount: number;
}

/**
 * Interface for the proposed LanguageModelChatProvider2
 */
interface LanguageModelChatProvider2 {
    provideChatResponse(
        messages: LanguageModelChatMessage[],
        options: LanguageModelChatRequestOptions,
        token: vscode.CancellationToken
    ): Promise<LanguageModelChatResponse>;

    countTokens(
        request: LanguageModelCountTokensRequest,
        token: vscode.CancellationToken
    ): Promise<LanguageModelCountTokensResponse>;
}

export class FoundryLocalChatProvider implements LanguageModelChatProvider2 {
    private logger = Logger.getInstance();
    private foundryService = FoundryLocalService.getInstance();
    private modelDiscovery = ModelDiscovery.getInstance();

    constructor(private model: FoundryLocalModel) {
        this.logger.info(`Created chat provider for model: ${model.name} (${model.id})`);
    }

    /**
     * Provides chat response using Foundry Local
     */
    async provideChatResponse(
        messages: LanguageModelChatMessage[],
        options: LanguageModelChatRequestOptions,
        token: vscode.CancellationToken
    ): Promise<LanguageModelChatResponse> {
        this.logger.debug(`Providing chat response for model: ${this.model.id}`, {
            messageCount: messages.length,
            justification: options.justification
        });

        // Convert VS Code messages to Foundry Local format
        const foundryMessages = this.convertMessagesToFoundryFormat(messages);

        // Check if model is loaded
        if (!this.model.isLoaded) {
            throw new Error(`Model ${this.model.name} is not loaded. Please load the model first.`);
        }

        // Create the chat request
        const chatRequest = {
            model: this.model.id,
            messages: foundryMessages,
            stream: true,
            max_tokens: this.model.maxTokens
        };

        // Create an async iterable for the response text
        const textIterable = this.createTextIterable(chatRequest, token);

        return {
            text: textIterable
        };
    }

    /**
     * Counts tokens in the given text
     */
    async countTokens(
        request: LanguageModelCountTokensRequest,
        token: vscode.CancellationToken
    ): Promise<LanguageModelCountTokensResponse> {
        this.logger.debug(`Counting tokens for model: ${this.model.id}`);

        // Use our token counter utility for estimation
        const tokenCount = TokenCounter.estimateTokens(request.text);

        return {
            tokenCount
        };
    }

    /**
     * Converts VS Code chat messages to Foundry Local format
     */
    private convertMessagesToFoundryFormat(messages: LanguageModelChatMessage[]): FoundryChatMessage[] {
        return messages.map(message => {
            // Extract text content from message parts
            const textParts = message.content.filter(part => part.kind === 'text') as LanguageModelTextPart[];
            const content = textParts.map(part => part.text).join('\n');

            return {
                role: message.role,
                content,
                name: message.name
            };
        });
    }

    /**
     * Creates an async iterable for streaming chat responses
     */
    private async* createTextIterable(
        chatRequest: any,
        token: vscode.CancellationToken
    ): AsyncGenerator<string, void, unknown> {
        try {
            this.logger.debug('Starting streaming chat request');

            const streamGenerator = this.foundryService.sendStreamingChatRequest(chatRequest);

            for await (const chunk of streamGenerator) {
                // Check for cancellation
                if (token.isCancellationRequested) {
                    this.logger.debug('Chat request cancelled');
                    return;
                }

                // Extract text content from the chunk
                if (chunk.choices && chunk.choices.length > 0) {
                    const choice = chunk.choices[0];
                    if (choice.delta && choice.delta.content) {
                        yield choice.delta.content;
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
     * Gets the model information
     */
    public getModel(): FoundryLocalModel {
        return this.model;
    }

    /**
     * Updates the model information
     */
    public updateModel(model: FoundryLocalModel): void {
        this.model = model;
        this.logger.debug(`Updated model information: ${model.name} (${model.id})`);
    }
}

/**
 * Factory class for creating and managing chat providers
 */
export class FoundryLocalChatProviderFactory {
    private static instance: FoundryLocalChatProviderFactory;
    private logger = Logger.getInstance();
    private modelDiscovery = ModelDiscovery.getInstance();
    private providers = new Map<string, FoundryLocalChatProvider>();

    private constructor() {}

    public static getInstance(): FoundryLocalChatProviderFactory {
        if (!FoundryLocalChatProviderFactory.instance) {
            FoundryLocalChatProviderFactory.instance = new FoundryLocalChatProviderFactory();
        }
        return FoundryLocalChatProviderFactory.instance;
    }

    /**
     * Creates or gets a chat provider for the specified model
     */
    public getProvider(modelId: string): FoundryLocalChatProvider | undefined {
        const model = this.modelDiscovery.getModel(modelId);
        if (!model) {
            this.logger.warn(`Model not found: ${modelId}`);
            return undefined;
        }

        // Check if we already have a provider for this model
        let provider = this.providers.get(modelId);
        if (provider) {
            // Update the provider with the latest model information
            provider.updateModel(model);
            return provider;
        }

        // Create a new provider
        provider = new FoundryLocalChatProvider(model);
        this.providers.set(modelId, provider);

        this.logger.info(`Created new chat provider for model: ${modelId}`);
        return provider;
    }

    /**
     * Gets all available providers
     */
    public getAllProviders(): FoundryLocalChatProvider[] {
        return Array.from(this.providers.values());
    }

    /**
     * Removes a provider
     */
    public removeProvider(modelId: string): void {
        if (this.providers.delete(modelId)) {
            this.logger.info(`Removed chat provider for model: ${modelId}`);
        }
    }

    /**
     * Updates all providers with latest model information
     */
    public updateAllProviders(): void {
        const models = this.modelDiscovery.getModels();
        const modelMap = new Map(models.map(model => [model.id, model]));

        // Update existing providers
        for (const [modelId, provider] of this.providers) {
            const updatedModel = modelMap.get(modelId);
            if (updatedModel) {
                provider.updateModel(updatedModel);
            } else {
                // Model no longer exists, remove the provider
                this.removeProvider(modelId);
            }
        }
    }

    /**
     * Clears all providers
     */
    public clearProviders(): void {
        this.providers.clear();
        this.logger.info('Cleared all chat providers');
    }
}
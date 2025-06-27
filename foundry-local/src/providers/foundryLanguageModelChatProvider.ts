import * as vscode from 'vscode';
import { FoundryLocalModel, FoundryLanguageModelChatInformation, FoundryChatMessage } from '../types/foundryLocal';
import { FoundryLocalService } from '../services/foundryLocalService';
import { ModelDiscovery } from './modelDiscovery';
import { TokenCounter } from '../utils/tokenCounter';
import { Logger } from '../utils/logger';

/**
 * Language Model Chat Provider for VS Code's Language Model API
 * This makes Foundry Local models appear in VS Code's "Manage Models" dropdown
 */
export class FoundryLanguageModelChatProvider implements vscode.LanguageModelChatProvider2<FoundryLanguageModelChatInformation> {
    private logger = Logger.getInstance();
    private foundryService = FoundryLocalService.getInstance();
    private modelDiscovery = ModelDiscovery.getInstance();

    // Event emitter for model changes
    private onDidChangeEmitter = new vscode.EventEmitter<void>();
    public readonly onDidChange = this.onDidChangeEmitter.event;

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
    public async prepareLanguageModelChat(
        options: { silent: boolean },
        token: vscode.CancellationToken
    ): Promise<FoundryLanguageModelChatInformation[]> {
        this.logger.debug('Preparing language model chat', { silent: options.silent });

        try {
            // Refresh models from Foundry Local
            if (!options.silent) {
                await this.modelDiscovery.refreshModels();
            }

            // Get available models
            const foundryModels = this.modelDiscovery.getModels();
            
            // Convert to VS Code language model format
            const languageModels: FoundryLanguageModelChatInformation[] = foundryModels.map(model => ({
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
        } catch (error) {
            this.logger.error('Failed to prepare language model chat', error as Error);
            // Return empty array on error to avoid blocking VS Code
            return [];
        }
    }

    /**
     * Provides language model chat response
     * Called by VS Code when a user interacts with a Foundry Local model
     */
    public async provideLanguageModelChatResponse(
        model: FoundryLanguageModelChatInformation,
        messages: Array<vscode.LanguageModelChatMessage>,
        options: vscode.LanguageModelChatRequestHandleOptions,
        progress: vscode.Progress<vscode.LanguageModelTextPart | vscode.LanguageModelToolCallPart>,
        token: vscode.CancellationToken
    ): Promise<any> {
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
            const foundryMessages: FoundryChatMessage[] = messages.map(msg => ({
                role: msg.role as 'user' | 'assistant' | 'system',
                content: this.extractMessageContent(msg)
            }));

            // Stream the response using Foundry Local service
            return new Promise<void>((resolve, reject) => {
                this.foundryService.streamChatRequest(
                    foundryMessages,
                    foundryModel,
                    (chunk: string) => {
                        // Check for cancellation
                        if (token.isCancellationRequested) {
                            return;
                        }
                        
                        // Report progress with text chunk
                        progress.report(new vscode.LanguageModelTextPart(chunk));
                    },
                    (chatResponse) => {
                        this.logger.debug('Chat response completed', {
                            modelId: model.id,
                            usage: chatResponse.usage
                        });
                        resolve();
                    },
                    (error) => {
                        this.logger.error('Error in language model chat response', error);
                        reject(error);
                    }
                );
            });
        } catch (error) {
            this.logger.error('Failed to provide language model chat response', error as Error);
            throw error;
        }
    }

    /**
     * Provides token count for text or messages
     * Used by VS Code for token usage estimation
     */
    public async provideTokenCount(
        model: FoundryLanguageModelChatInformation,
        text: string | vscode.LanguageModelChatMessage,
        token: vscode.CancellationToken
    ): Promise<number> {
        try {
            if (typeof text === 'string') {
                // Simple text token estimation
                return TokenCounter.estimateTokens(text);
            } else {
                // Message token estimation
                const content = this.extractMessageContent(text);
                return TokenCounter.estimateTokens(content);
            }
        } catch (error) {
            this.logger.error('Failed to provide token count', error as Error);
            // Return a reasonable fallback
            return 0;
        }
    }

    /**
     * Extracts text content from a language model chat message
     */
    private extractMessageContent(message: vscode.LanguageModelChatMessage): string {
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
    public dispose(): void {
        this.onDidChangeEmitter.dispose();
        this.logger.info('Disposed Foundry Language Model Chat Provider');
    }
}

/**
 * Factory for managing the Language Model Chat Provider
 */
export class FoundryLanguageModelChatProviderFactory {
    private static instance: FoundryLanguageModelChatProviderFactory;
    private logger = Logger.getInstance();
    private provider: FoundryLanguageModelChatProvider | undefined;
    private registration: vscode.Disposable | undefined;

    private constructor() {}

    public static getInstance(): FoundryLanguageModelChatProviderFactory {
        if (!FoundryLanguageModelChatProviderFactory.instance) {
            FoundryLanguageModelChatProviderFactory.instance = new FoundryLanguageModelChatProviderFactory();
        }
        return FoundryLanguageModelChatProviderFactory.instance;
    }

    /**
     * Creates and registers the Language Model Chat Provider
     */
    public async registerProvider(): Promise<vscode.Disposable> {
        if (this.registration) {
            this.logger.debug('Language Model Chat Provider already registered');
            return this.registration;
        }

        try {
            this.logger.info('Registering Foundry Language Model Chat Provider');
            
            // Create the provider
            this.provider = new FoundryLanguageModelChatProvider();

            // Define metadata for the provider
            const metadata: vscode.ChatResponseProviderMetadata = {
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
            this.registration = vscode.lm.registerChatModelProvider(
                'foundry-local',
                this.provider as any, // Type assertion needed due to API version differences
                metadata
            );

            this.logger.info('Successfully registered Foundry Language Model Chat Provider');
            return this.registration;
        } catch (error) {
            this.logger.error('Failed to register Language Model Chat Provider', error as Error);
            throw error;
        }
    }

    /**
     * Gets the provider instance
     */
    public getProvider(): FoundryLanguageModelChatProvider | undefined {
        return this.provider;
    }

    /**
     * Dispose the provider and registration
     */
    public dispose(): void {
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
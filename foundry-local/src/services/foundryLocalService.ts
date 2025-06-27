import * as vscode from 'vscode';
import { FoundryLocalManager, FoundryModelInfo } from 'foundry-local-sdk';
import { OpenAI } from 'openai';
import { 
    FoundryLocalConfig, 
    FoundryLocalModel, 
    FoundryLocalServiceStatus,
    FoundryChatRequest,
    FoundryChatResponse,
    FoundryChatStreamChunk
} from '../types/foundryLocal';
import { ConfigurationManager } from './configurationManager';
import { Logger } from '../utils/logger';

export class FoundryLocalService {
    private static instance: FoundryLocalService;
    private logger = Logger.getInstance();
    private configManager = ConfigurationManager.getInstance();
    private foundryManager: FoundryLocalManager;
    private openaiClient: OpenAI | null = null;
    private status: FoundryLocalServiceStatus;

    private constructor() {
        this.status = {
            isRunning: false,
            isConnected: false,
            modelsLoaded: 0,
            lastChecked: new Date()
        };

        this.foundryManager = this.createFoundryManager();
        this.updateOpenAI().catch(error => {
            this.logger.warn('Failed to initialize OpenAI client during construction:', error);
        });
    }

    public static getInstance(): FoundryLocalService {
        if (!FoundryLocalService.instance) {
            FoundryLocalService.instance = new FoundryLocalService();
        }
        return FoundryLocalService.instance;
    }

    /**
     * Creates and configures the Foundry Local Manager
     */
    private createFoundryManager(): FoundryLocalManager {
        return new FoundryLocalManager();
    }

    /**
     * Creates and configures the OpenAI client for chat completions
     */
    private updateOpenAI(): Promise<void> {
        return new Promise((resolve) => {
            try {
                const config = this.configManager.getConfiguration();
                let baseURL: string;
                
                // Try to use SDK endpoint if available, otherwise fall back to configuration
                try {
                    baseURL = this.foundryManager.endpoint;
                } catch {
                    // SDK not initialized yet, use configuration
                    baseURL = `${config.endpoint}:${config.port}/v1`;
                }
                
                let apiKey: string;
                try {
                    apiKey = this.foundryManager.apiKey;
                } catch {
                    // SDK not initialized yet, use configuration
                    apiKey = config.apiKey || 'sk-no-key-required';
                }
                
                this.openaiClient = new OpenAI({
                    baseURL: baseURL,
                    apiKey: apiKey,
                });
                
                this.logger.debug('OpenAI client initialized', { baseURL });
                resolve();
            } catch (error) {
                this.logger.warn('Failed to initialize OpenAI client:', error);
                this.openaiClient = null;
                resolve();
            }
        });
    }

    /**
     * Updates the foundry manager and clients when configuration changes
     */
    public updateConfiguration(): void {
        this.foundryManager = this.createFoundryManager();
        this.updateOpenAI().catch(error => {
            this.logger.warn('Failed to update OpenAI client:', error);
        });
        this.logger.info('Foundry Local service configuration updated');
    }

    /**
     * Checks if the Foundry Local service is available
     */
    public async checkServiceStatus(): Promise<FoundryLocalServiceStatus> {
        try {
            this.logger.debug('Checking Foundry Local service status');
            
            const isRunning = await this.foundryManager.isServiceRunning();
            
            if (isRunning) {
                // Get loaded models count
                const loadedModels = await this.foundryManager.listLoadedModels();
                
                this.status = {
                    isRunning: true,
                    isConnected: true,
                    modelsLoaded: loadedModels.length,
                    lastChecked: new Date()
                };

                this.logger.info('Foundry Local service is available');
            } else {
                this.status = {
                    isRunning: false,
                    isConnected: false,
                    modelsLoaded: 0,
                    lastChecked: new Date(),
                    error: 'Service is not running'
                };
            }
        } catch (error) {
            this.logger.debug('Foundry Local service check failed:', error);
            
            this.status = {
                isRunning: false,
                isConnected: false,
                modelsLoaded: 0,
                lastChecked: new Date(),
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }

        return this.status;
    }

    /**
     * Ensures the OpenAI client is ready for use
     */
    private async ensureOpenAIClient(): Promise<void> {
        if (!this.openaiClient) {
            await this.updateOpenAI();
            if (!this.openaiClient) {
                throw new Error('OpenAI client could not be initialized. Check service configuration and ensure Foundry Local is running.');
            }
        }
    }

    /**
     * Gets the current service status
     */
    public getStatus(): FoundryLocalServiceStatus {
        return { ...this.status };
    }

    /**
     * Converts SDK FoundryModelInfo to our FoundryLocalModel interface
     */
    private convertToFoundryLocalModel(sdkModel: FoundryModelInfo, isLoaded: boolean = false): FoundryLocalModel {
        return {
            id: sdkModel.id,
            name: sdkModel.alias || sdkModel.id,
            alias: sdkModel.alias,
            description: `${sdkModel.task} model from ${sdkModel.publisher}`,
            provider: sdkModel.provider,
            publisher: sdkModel.publisher,
            version: sdkModel.version,
            capabilities: {
                chat: sdkModel.task.toLowerCase().includes('chat') || sdkModel.task.toLowerCase().includes('text'),
                completion: sdkModel.task.toLowerCase().includes('text') || sdkModel.task.toLowerCase().includes('generation'),
                vision: sdkModel.task.toLowerCase().includes('vision') || sdkModel.task.toLowerCase().includes('image'),
                toolCalling: false, // Would need to check model capabilities from SDK
                streaming: true // Most models support streaming
            },
            maxTokens: undefined, // SDK doesn't expose this directly
            contextLength: undefined, // SDK doesn't expose this directly
            modelSize: sdkModel.modelSize,
            task: sdkModel.task,
            license: sdkModel.license,
            uri: sdkModel.uri,
            promptTemplate: sdkModel.promptTemplate,
            isLoaded: isLoaded,
            isDefault: false
        };
    }

    /**
     * Discovers available models from Foundry Local
     */
    public async discoverModels(): Promise<FoundryLocalModel[]> {
        try {
            this.logger.debug('Discovering models from Foundry Local');
            
            // Get both catalog and loaded models
            const [catalogModels, loadedModels] = await Promise.all([
                this.foundryManager.listCatalogModels(),
                this.foundryManager.listLoadedModels()
            ]);

            // Create a set of loaded model IDs for quick lookup
            const loadedModelIds = new Set(loadedModels.map(m => m.id));

            // Convert catalog models and mark loaded ones
            const models: FoundryLocalModel[] = catalogModels.map(model => 
                this.convertToFoundryLocalModel(model, loadedModelIds.has(model.id))
            );

            this.logger.info(`Discovered ${models.length} models from Foundry Local (${loadedModels.length} loaded)`);
            return models;
        } catch (error) {
            this.logger.error('Failed to discover models', error as Error);
            throw new Error(`Failed to discover models: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Sends a chat completion request to Foundry Local via OpenAI client
     */
    public async sendChatRequest(request: FoundryChatRequest): Promise<FoundryChatResponse> {
        try {
            this.logger.debug('Sending chat request to Foundry Local', { model: request.model, messageCount: request.messages.length });
            
            await this.ensureOpenAIClient();

            const response = await this.openaiClient!.chat.completions.create({
                model: request.model,
                messages: request.messages as any,
                max_tokens: request.max_tokens,
                temperature: request.temperature,
                top_p: request.top_p,
                stop: request.stop,
                stream: false
            });
            
            this.logger.debug('Received chat response from Foundry Local');
            
            // Convert OpenAI response to our format
            return {
                id: response.id,
                object: response.object,
                created: response.created,
                model: response.model,
                choices: response.choices.map(choice => ({
                    index: choice.index,
                    message: choice.message as any,
                    finish_reason: choice.finish_reason
                })),
                usage: response.usage ? {
                    prompt_tokens: response.usage.prompt_tokens,
                    completion_tokens: response.usage.completion_tokens,
                    total_tokens: response.usage.total_tokens
                } : undefined
            };
        } catch (error) {
            this.logger.error('Chat request failed', error as Error);
            
            if (error && typeof error === 'object' && 'status' in error) {
                const apiError = error as any;
                if (apiError.status === 404) {
                    throw new Error(`Model '${request.model}' not found`);
                } else if (apiError.status === 400) {
                    throw new Error(`Invalid request: ${apiError.message}`);
                }
            }
            
            throw new Error(`Chat request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Sends a streaming chat completion request to Foundry Local via OpenAI client
     */
    public async* sendStreamingChatRequest(request: FoundryChatRequest): AsyncGenerator<FoundryChatStreamChunk, void, unknown> {
        try {
            this.logger.debug('Sending streaming chat request to Foundry Local', { model: request.model });
            
            await this.ensureOpenAIClient();

            const stream = await this.openaiClient!.chat.completions.create({
                model: request.model,
                messages: request.messages as any,
                max_tokens: request.max_tokens,
                temperature: request.temperature,
                top_p: request.top_p,
                stop: request.stop,
                stream: true
            });

            for await (const chunk of stream) {
                // Convert OpenAI streaming format to our format
                const foundryChunk: FoundryChatStreamChunk = {
                    id: chunk.id,
                    object: chunk.object,
                    created: chunk.created,
                    model: chunk.model,
                    choices: chunk.choices.map(choice => ({
                        index: choice.index,
                        delta: {
                            role: choice.delta.role || undefined,
                            content: choice.delta.content || undefined
                        },
                        finish_reason: choice.finish_reason
                    }))
                };
                
                yield foundryChunk;
            }
        } catch (error) {
            this.logger.error('Streaming chat request failed', error as Error);
            throw new Error(`Streaming chat request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Loads a specific model in Foundry Local
     */
    public async loadModel(modelId: string): Promise<void> {
        try {
            this.logger.info(`Loading model: ${modelId}`);
            
            await this.foundryManager.loadModel(modelId);
            
            this.logger.info(`Model loaded successfully: ${modelId}`);
        } catch (error) {
            this.logger.error(`Failed to load model: ${modelId}`, error as Error);
            throw new Error(`Failed to load model: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Unloads a specific model in Foundry Local
     */
    public async unloadModel(modelId: string): Promise<void> {
        try {
            this.logger.info(`Unloading model: ${modelId}`);
            
            await this.foundryManager.unloadModel(modelId);
            
            this.logger.info(`Model unloaded successfully: ${modelId}`);
        } catch (error) {
            this.logger.error(`Failed to unload model: ${modelId}`, error as Error);
            throw new Error(`Failed to unload model: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
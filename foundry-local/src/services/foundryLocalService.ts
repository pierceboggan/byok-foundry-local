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
        const manager = new FoundryLocalManager();
        this.logger.debug('Created FoundryLocalManager');
        
        // Log the endpoint being used
        try {
            this.logger.debug(`SDK using endpoint: ${manager.endpoint}`);
        } catch (error) {
            this.logger.debug('SDK endpoint not yet available');
        }
        
        return manager;
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
            
            // Try to ping the models endpoint since health might not exist
            const response = await this.axiosInstance.get('/v1/models', { timeout: 5000 });
            
            const modelsCount = response.data?.data?.length || 0;
            
            this.status = {
                isRunning: true,
                isConnected: response.status === 200,
                version: response.data?.version,
                modelsLoaded: modelsCount,
                lastChecked: new Date()
            };

            this.logger.debug('Foundry Local service status check successful:', this.status);
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
            this.logger.info('Discovering models from Foundry Local');
            
            const response = await this.axiosInstance.get('/v1/models');
            const modelsData = response.data;
            
            this.logger.debug('Raw models response:', modelsData);

            if (!modelsData?.data || !Array.isArray(modelsData.data)) {
                throw new Error('Invalid response format from models endpoint');
            }
            
            // Get both catalog and loaded models
            this.logger.info('Calling SDK listCatalogModels()...');
            const catalogModels = await this.foundryManager.listCatalogModels();
            this.logger.info(`SDK listCatalogModels() returned ${catalogModels.length} models`);
            
            this.logger.info('Calling SDK listLoadedModels()...');
            const loadedModels = await this.foundryManager.listLoadedModels();
            this.logger.info(`SDK listLoadedModels() returned ${loadedModels.length} models`);

            const models: FoundryLocalModel[] = modelsData.data.map((model: any) => {
                this.logger.debug('Processing model:', model);
                
                return {
                    id: model.id,
                    name: model.display_name || model.id,
                    description: model.description,
                    provider: model.owned_by || 'foundry-local',
                    capabilities: {
                        chat: true, // Assume chat capability for all models
                        completion: true, // Assume completion capability for all models
                        vision: model.vision === true,
                        toolCalling: model.toolCalling === true,
                        streaming: true // Assume streaming capability for all models
                    },
                    maxTokens: model.maxOutputTokens || 2048,
                    contextLength: model.maxInputTokens || 4096,
                    isLoaded: true, // If model is in the list, assume it's loaded
                    isDefault: false
                };
            });

            this.logger.info(`Discovered ${models.length} models from Foundry Local:`, models.map(m => ({ id: m.id, name: m.name })));
          
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

    /**
     * Debug method to test direct HTTP connection to Foundry Local
     */
    public async debugDirectConnection(): Promise<void> {
        try {
            const config = this.configManager.getConfiguration();
            this.logger.info(`Config: endpoint=${config.endpoint}, port=${config.port}`);
            const baseUrl = `${config.endpoint}:${config.port}`;
            
            this.logger.info(`Testing direct connection to ${baseUrl}`);
            
            // Test if we can reach the service directly
            const response = await fetch(`${baseUrl}/v1/models`);
            if (response.ok) {
                const data = await response.json();
                this.logger.info('Direct HTTP call to /v1/models successful:', data);
            } else {
                this.logger.info(`Direct HTTP call failed with status: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            this.logger.info('Direct HTTP connection test failed:', error);
        }
    }
}
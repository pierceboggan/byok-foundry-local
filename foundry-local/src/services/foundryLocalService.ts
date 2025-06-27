import * as vscode from 'vscode';
import axios from 'axios';
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

// Define axios types locally since they may not be exported properly
interface AxiosInstance {
    get(url: string, config?: any): Promise<any>;
    post(url: string, data?: any, config?: any): Promise<any>;
}

interface AxiosError extends Error {
    response?: {
        status: number;
        data: any;
    };
    code?: string;
}

export class FoundryLocalService {
    private static instance: FoundryLocalService;
    private logger = Logger.getInstance();
    private configManager = ConfigurationManager.getInstance();
    private axiosInstance: any;
    private status: FoundryLocalServiceStatus;

    private constructor() {
        this.status = {
            isRunning: false,
            isConnected: false,
            modelsLoaded: 0,
            lastChecked: new Date()
        };

        this.axiosInstance = this.createAxiosInstance();
    }

    public static getInstance(): FoundryLocalService {
        if (!FoundryLocalService.instance) {
            FoundryLocalService.instance = new FoundryLocalService();
        }
        return FoundryLocalService.instance;
    }

    /**
     * Creates and configures the axios instance
     */
    private createAxiosInstance(): any {
        const config = this.configManager.getConfiguration();
        
        return axios.create({
            baseURL: this.configManager.getApiUrl(),
            timeout: config.timeout,
            headers: {
                'Content-Type': 'application/json',
                ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
            }
        });
    }

    /**
     * Updates the axios instance when configuration changes
     */
    public updateConfiguration(): void {
        this.axiosInstance = this.createAxiosInstance();
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
     * Gets the current service status
     */
    public getStatus(): FoundryLocalServiceStatus {
        return { ...this.status };
    }

    /**
     * Discovers available models from Foundry Local
     */
    public async discoverModels(): Promise<FoundryLocalModel[]> {
        try {
            this.logger.debug('Discovering models from Foundry Local');
            
            const response = await this.axiosInstance.get('/v1/models');
            const modelsData = response.data;
            
            this.logger.debug('Raw models response:', modelsData);

            if (!modelsData?.data || !Array.isArray(modelsData.data)) {
                throw new Error('Invalid response format from models endpoint');
            }

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
     * Sends a chat completion request to Foundry Local
     */
    public async sendChatRequest(request: FoundryChatRequest): Promise<FoundryChatResponse> {
        try {
            this.logger.debug('Sending chat request to Foundry Local', { model: request.model, messageCount: request.messages.length });
            
            const response = await this.axiosInstance.post('/v1/chat/completions', request);
            
            this.logger.debug('Received chat response from Foundry Local');
            return response.data;
        } catch (error) {
            this.logger.error('Chat request failed', error as Error);
            
            if (error && typeof error === 'object' && 'isAxiosError' in error) {
                const axiosError = error as any;
                if (axiosError.response?.status === 404) {
                    throw new Error(`Model '${request.model}' not found`);
                } else if (axiosError.response?.status === 400) {
                    throw new Error(`Invalid request: ${axiosError.response.data}`);
                } else if (axiosError.code === 'ECONNREFUSED') {
                    throw new Error('Cannot connect to Foundry Local service. Is it running?');
                }
            }
            
            throw new Error(`Chat request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Sends a streaming chat completion request to Foundry Local
     */
    public async* sendStreamingChatRequest(request: FoundryChatRequest): AsyncGenerator<FoundryChatStreamChunk, void, unknown> {
        try {
            this.logger.debug('Sending streaming chat request to Foundry Local', { model: request.model });
            
            const streamRequest = { ...request, stream: true };
            
            const response = await this.axiosInstance.post('/v1/chat/completions', streamRequest, {
                responseType: 'stream'
            });

            let buffer = '';
            
            for await (const chunk of response.data) {
                buffer += chunk.toString();
                
                // Split by newlines to handle multiple SSE events in one chunk
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep the incomplete line in buffer
                
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    
                    // Skip empty lines and comments
                    if (!trimmedLine || trimmedLine.startsWith(':')) {
                        continue;
                    }
                    
                    // Parse SSE data
                    if (trimmedLine.startsWith('data: ')) {
                        const data = trimmedLine.slice(6);
                        
                        // Check for end of stream
                        if (data === '[DONE]') {
                            return;
                        }
                        
                        try {
                            const parsedData = JSON.parse(data);
                            yield parsedData as FoundryChatStreamChunk;
                        } catch (parseError) {
                            this.logger.warn('Failed to parse streaming response chunk:', parseError);
                        }
                    }
                }
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
            
            await this.axiosInstance.post('/v1/models/load', { model: modelId });
            
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
            
            await this.axiosInstance.post('/v1/models/unload', { model: modelId });
            
            this.logger.info(`Model unloaded successfully: ${modelId}`);
        } catch (error) {
            this.logger.error(`Failed to unload model: ${modelId}`, error as Error);
            throw new Error(`Failed to unload model: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
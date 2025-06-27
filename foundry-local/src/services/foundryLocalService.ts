import * as vscode from 'vscode';
import { FoundryLocalModel, FoundryChatMessage, FoundryChatResponse, FoundryLocalStatus } from '../types/foundryLocal';
import { ConfigurationManager } from './configurationManager';
import { Logger } from '../utils/logger';

/**
 * Service for interacting with Foundry Local
 */
export class FoundryLocalService {
    private static instance: FoundryLocalService;
    private logger = Logger.getInstance();
    private configManager = ConfigurationManager.getInstance();

    private constructor() {}

    public static getInstance(): FoundryLocalService {
        if (!FoundryLocalService.instance) {
            FoundryLocalService.instance = new FoundryLocalService();
        }
        return FoundryLocalService.instance;
    }

    /**
     * Checks if Foundry Local service is available
     */
    public async checkStatus(): Promise<FoundryLocalStatus> {
        const config = this.configManager.getConfiguration();
        const endpoint = this.configManager.getEndpointUrl();
        
        try {
            this.logger.debug(`Checking Foundry Local status at ${endpoint}`);
            
            // Make a simple health check request
            const response = await this.makeRequest('/health', {
                method: 'GET',
                timeout: config.timeout
            });

            if (response.ok) {
                const data = await response.json();
                return {
                    isRunning: true,
                    isReachable: true,
                    loadedModels: data.loadedModels || 0,
                    totalModels: data.totalModels || 0,
                    version: data.version,
                    lastCheck: new Date()
                };
            } else {
                return {
                    isRunning: false,
                    isReachable: false,
                    loadedModels: 0,
                    totalModels: 0,
                    lastCheck: new Date()
                };
            }
        } catch (error) {
            this.logger.debug('Foundry Local is not reachable', error as Error);
            return {
                isRunning: false,
                isReachable: false,
                loadedModels: 0,
                totalModels: 0,
                lastCheck: new Date()
            };
        }
    }

    /**
     * Fetches available models from Foundry Local
     */
    public async getModels(): Promise<FoundryLocalModel[]> {
        try {
            this.logger.debug('Fetching models from Foundry Local');
            
            const response = await this.makeRequest('/models');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            const models: FoundryLocalModel[] = [];

            if (data.models && Array.isArray(data.models)) {
                for (const modelData of data.models) {
                    models.push(this.parseModelData(modelData));
                }
            }

            this.logger.debug(`Retrieved ${models.length} models from Foundry Local`);
            return models;
        } catch (error) {
            this.logger.error('Failed to fetch models from Foundry Local', error as Error);
            return [];
        }
    }

    /**
     * Loads a specific model
     */
    public async loadModel(modelId: string): Promise<boolean> {
        try {
            this.logger.info(`Loading model: ${modelId}`);
            
            const response = await this.makeRequest('/models/load', {
                method: 'POST',
                body: JSON.stringify({ modelId }),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this.logger.info(`Successfully loaded model: ${modelId}`);
                return true;
            } else {
                const errorText = await response.text();
                this.logger.error(`Failed to load model ${modelId}: ${errorText}`);
                return false;
            }
        } catch (error) {
            this.logger.error(`Error loading model ${modelId}`, error as Error);
            return false;
        }
    }

    /**
     * Unloads a specific model
     */
    public async unloadModel(modelId: string): Promise<boolean> {
        try {
            this.logger.info(`Unloading model: ${modelId}`);
            
            const response = await this.makeRequest('/models/unload', {
                method: 'POST',
                body: JSON.stringify({ modelId }),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this.logger.info(`Successfully unloaded model: ${modelId}`);
                return true;
            } else {
                const errorText = await response.text();
                this.logger.error(`Failed to unload model ${modelId}: ${errorText}`);
                return false;
            }
        } catch (error) {
            this.logger.error(`Error unloading model ${modelId}`, error as Error);
            return false;
        }
    }

    /**
     * Sends a chat request to Foundry Local
     */
    public async sendChatRequest(
        messages: FoundryChatMessage[],
        model: FoundryLocalModel,
        stream?: boolean
    ): Promise<FoundryChatResponse> {
        try {
            this.logger.debug(`Sending chat request to model: ${model.name}`, { messages });

            const requestBody = {
                model: model.id,
                messages: messages.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                stream: stream || false
            };

            const response = await this.makeRequest('/chat/completions', {
                method: 'POST',
                body: JSON.stringify(requestBody),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            return this.parseChatResponse(data);
        } catch (error) {
            this.logger.error('Failed to send chat request', error as Error);
            throw error;
        }
    }

    /**
     * Streams a chat request to Foundry Local
     */
    public async streamChatRequest(
        messages: FoundryChatMessage[],
        model: FoundryLocalModel,
        onChunk: (chunk: string) => void,
        onComplete: (response: FoundryChatResponse) => void,
        onError: (error: Error) => void
    ): Promise<void> {
        try {
            this.logger.debug(`Streaming chat request to model: ${model.name}`);

            const requestBody = {
                model: model.id,
                messages: messages.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                stream: true
            };

            const response = await this.makeRequest('/chat/completions', {
                method: 'POST',
                body: JSON.stringify(requestBody),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            // Handle streaming response
            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('Failed to get response reader');
            }

            const decoder = new TextDecoder();
            let buffer = '';
            let fullContent = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') {
                                break;
                            }

                            try {
                                const parsed = JSON.parse(data);
                                const content = parsed.choices?.[0]?.delta?.content;
                                if (content) {
                                    fullContent += content;
                                    onChunk(content);
                                }
                            } catch (parseError) {
                                // Ignore parse errors for individual chunks
                            }
                        }
                    }
                }

                onComplete({
                    content: fullContent,
                    model: model.id,
                    finishReason: 'stop'
                });
            } finally {
                reader.releaseLock();
            }
        } catch (error) {
            this.logger.error('Failed to stream chat request', error as Error);
            onError(error as Error);
        }
    }

    /**
     * Makes an HTTP request to Foundry Local
     */
    private async makeRequest(path: string, options?: RequestInit): Promise<Response> {
        const config = this.configManager.getConfiguration();
        const endpoint = this.configManager.getEndpointUrl();
        const url = `${endpoint}${path}`;

        const defaultOptions: RequestInit = {
            timeout: config.timeout,
            ...options
        };

        // Add retry logic
        let lastError: Error | null = null;
        for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
            try {
                const response = await fetch(url, defaultOptions);
                return response;
            } catch (error) {
                lastError = error as Error;
                if (attempt < config.maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                    this.logger.debug(`Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${config.maxRetries + 1})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError || new Error('Request failed');
    }

    /**
     * Parses model data from Foundry Local response
     */
    private parseModelData(data: any): FoundryLocalModel {
        return {
            id: data.id || data.name,
            name: data.name || data.id,
            family: data.family || 'foundry-local',
            description: data.description,
            isLoaded: data.isLoaded || false,
            isDefault: data.isDefault || false,
            size: data.size,
            parameters: data.parameters,
            capabilities: {
                textGeneration: data.capabilities?.textGeneration ?? true,
                chat: data.capabilities?.chat ?? true,
                vision: data.capabilities?.vision ?? false,
                toolCalling: data.capabilities?.toolCalling ?? false
            },
            maxInputTokens: data.maxInputTokens || 4096,
            maxOutputTokens: data.maxOutputTokens || 2048,
            version: data.version || '1.0.0',
            vendor: data.vendor || 'Foundry Local',
            cost: data.cost
        };
    }

    /**
     * Parses chat response from Foundry Local
     */
    private parseChatResponse(data: any): FoundryChatResponse {
        const choice = data.choices?.[0];
        return {
            content: choice?.message?.content || choice?.text || '',
            usage: data.usage ? {
                inputTokens: data.usage.prompt_tokens || 0,
                outputTokens: data.usage.completion_tokens || 0,
                totalTokens: data.usage.total_tokens || 0
            } : undefined,
            model: data.model || '',
            truncated: choice?.finish_reason === 'length',
            finishReason: choice?.finish_reason || 'stop'
        };
    }
}
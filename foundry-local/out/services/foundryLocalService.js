"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FoundryLocalService = void 0;
const configurationManager_1 = require("./configurationManager");
const logger_1 = require("../utils/logger");
/**
 * Service for interacting with Foundry Local
 */
class FoundryLocalService {
    static instance;
    logger = logger_1.Logger.getInstance();
    configManager = configurationManager_1.ConfigurationManager.getInstance();
    constructor() { }
    static getInstance() {
        if (!FoundryLocalService.instance) {
            FoundryLocalService.instance = new FoundryLocalService();
        }
        return FoundryLocalService.instance;
    }
    /**
     * Checks if Foundry Local service is available
     */
    async checkStatus() {
        const config = this.configManager.getConfiguration();
        const endpoint = this.configManager.getEndpointUrl();
        try {
            this.logger.debug(`Checking Foundry Local status at ${endpoint}`);
            // Make a simple health check request
            const response = await this.makeRequest('/health', {
                method: 'GET'
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
            }
            else {
                return {
                    isRunning: false,
                    isReachable: false,
                    loadedModels: 0,
                    totalModels: 0,
                    lastCheck: new Date()
                };
            }
        }
        catch (error) {
            this.logger.debug('Foundry Local is not reachable', error);
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
    async getModels() {
        try {
            this.logger.debug('Fetching models from Foundry Local');
            const response = await this.makeRequest('/models');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            const models = [];
            if (data.models && Array.isArray(data.models)) {
                for (const modelData of data.models) {
                    models.push(this.parseModelData(modelData));
                }
            }
            this.logger.debug(`Retrieved ${models.length} models from Foundry Local`);
            return models;
        }
        catch (error) {
            this.logger.error('Failed to fetch models from Foundry Local', error);
            return [];
        }
    }
    /**
     * Loads a specific model
     */
    async loadModel(modelId) {
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
            }
            else {
                const errorText = await response.text();
                this.logger.error(`Failed to load model ${modelId}: ${errorText}`);
                return false;
            }
        }
        catch (error) {
            this.logger.error(`Error loading model ${modelId}`, error);
            return false;
        }
    }
    /**
     * Unloads a specific model
     */
    async unloadModel(modelId) {
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
            }
            else {
                const errorText = await response.text();
                this.logger.error(`Failed to unload model ${modelId}: ${errorText}`);
                return false;
            }
        }
        catch (error) {
            this.logger.error(`Error unloading model ${modelId}`, error);
            return false;
        }
    }
    /**
     * Sends a chat request to Foundry Local
     */
    async sendChatRequest(messages, model, stream) {
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
        }
        catch (error) {
            this.logger.error('Failed to send chat request', error);
            throw error;
        }
    }
    /**
     * Streams a chat request to Foundry Local
     */
    async streamChatRequest(messages, model, onChunk, onComplete, onError) {
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
                    if (done) {
                        break;
                    }
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
                            }
                            catch (parseError) {
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
            }
            finally {
                reader.releaseLock();
            }
        }
        catch (error) {
            this.logger.error('Failed to stream chat request', error);
            onError(error);
        }
    }
    /**
     * Makes an HTTP request to Foundry Local
     */
    async makeRequest(path, options) {
        const config = this.configManager.getConfiguration();
        const endpoint = this.configManager.getEndpointUrl();
        const url = `${endpoint}${path}`;
        const defaultOptions = {
            ...options
        };
        // Add retry logic
        let lastError = null;
        for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
            try {
                // Implement timeout using AbortController
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), config.timeout);
                const response = await fetch(url, {
                    ...defaultOptions,
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                return response;
            }
            catch (error) {
                lastError = error;
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
    parseModelData(data) {
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
    parseChatResponse(data) {
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
exports.FoundryLocalService = FoundryLocalService;
//# sourceMappingURL=foundryLocalService.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FoundryLocalService = void 0;
const foundry_local_sdk_1 = require("foundry-local-sdk");
const openai_1 = require("openai");
const configurationManager_1 = require("./configurationManager");
const logger_1 = require("../utils/logger");
class FoundryLocalService {
    static instance;
    logger = logger_1.Logger.getInstance();
    configManager = configurationManager_1.ConfigurationManager.getInstance();
    foundryManager;
    openaiClient = null;
    status;
    constructor() {
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
    static getInstance() {
        if (!FoundryLocalService.instance) {
            FoundryLocalService.instance = new FoundryLocalService();
        }
        return FoundryLocalService.instance;
    }
    /**
     * Creates and configures the Foundry Local Manager
     */
    createFoundryManager() {
        const manager = new foundry_local_sdk_1.FoundryLocalManager();
        this.logger.debug('Created FoundryLocalManager');
        // Log the endpoint being used
        try {
            this.logger.debug(`SDK using endpoint: ${manager.endpoint}`);
        }
        catch (error) {
            this.logger.debug('SDK endpoint not yet available');
        }
        return manager;
    }
    /**
     * Creates and configures the OpenAI client for chat completions
     */
    updateOpenAI() {
        return new Promise((resolve) => {
            try {
                const config = this.configManager.getConfiguration();
                let baseURL;
                // Try to use SDK endpoint if available, otherwise fall back to configuration
                try {
                    baseURL = this.foundryManager.endpoint;
                }
                catch {
                    // SDK not initialized yet, use configuration
                    baseURL = `${config.endpoint}:${config.port}/v1`;
                }
                let apiKey;
                try {
                    apiKey = this.foundryManager.apiKey;
                }
                catch {
                    // SDK not initialized yet, use configuration
                    apiKey = config.apiKey || 'sk-no-key-required';
                }
                this.openaiClient = new openai_1.OpenAI({
                    baseURL: baseURL,
                    apiKey: apiKey,
                });
                this.logger.debug('OpenAI client initialized', { baseURL });
                resolve();
            }
            catch (error) {
                this.logger.warn('Failed to initialize OpenAI client:', error);
                this.openaiClient = null;
                resolve();
            }
        });
    }
    /**
     * Updates the foundry manager and clients when configuration changes
     */
    updateConfiguration() {
        this.foundryManager = this.createFoundryManager();
        this.updateOpenAI().catch(error => {
            this.logger.warn('Failed to update OpenAI client:', error);
        });
        this.logger.info('Foundry Local service configuration updated');
    }
    /**
     * Checks if the Foundry Local service is available
     */
    async checkServiceStatus() {
        try {
            this.logger.debug('Checking Foundry Local service status');
            const isRunning = await this.foundryManager.isServiceRunning();
            this.logger.debug(`SDK reports service running: ${isRunning}`);
            if (isRunning) {
                // Get loaded models count
                const loadedModels = await this.foundryManager.listLoadedModels();
                this.logger.debug(`SDK reports ${loadedModels.length} loaded models`);
                this.status = {
                    isRunning: true,
                    isConnected: true,
                    modelsLoaded: loadedModels.length,
                    lastChecked: new Date()
                };
                this.logger.info('Foundry Local service is available');
            }
            else {
                this.status = {
                    isRunning: false,
                    isConnected: false,
                    modelsLoaded: 0,
                    lastChecked: new Date(),
                    error: 'Service is not running'
                };
            }
        }
        catch (error) {
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
    async ensureOpenAIClient() {
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
    getStatus() {
        return { ...this.status };
    }
    /**
     * Converts SDK FoundryModelInfo to our FoundryLocalModel interface
     */
    convertToFoundryLocalModel(sdkModel, isLoaded = false) {
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
    async discoverModels() {
        try {
            this.logger.info('Discovering models from Foundry Local');
            // Test direct connection first
            await this.debugDirectConnection();
            // Log the SDK configuration details
            try {
                this.logger.info(`SDK endpoint: ${this.foundryManager.endpoint}`);
                this.logger.info(`SDK API key: ${this.foundryManager.apiKey ? '[REDACTED]' : 'NOT SET'}`);
            }
            catch (error) {
                this.logger.info('Failed to get SDK configuration:', error);
            }
            // Get both catalog and loaded models
            this.logger.info('Calling SDK listCatalogModels()...');
            const catalogModels = await this.foundryManager.listCatalogModels();
            this.logger.info(`SDK listCatalogModels() returned ${catalogModels.length} models`);
            this.logger.info('Calling SDK listLoadedModels()...');
            const loadedModels = await this.foundryManager.listLoadedModels();
            this.logger.info(`SDK listLoadedModels() returned ${loadedModels.length} models`);
            this.logger.info(`SDK catalog models:`, catalogModels.map(m => ({ id: m.id, alias: m.alias })));
            this.logger.info(`SDK loaded models:`, loadedModels.map(m => ({ id: m.id, alias: m.alias })));
            // Create a set of loaded model IDs for quick lookup
            const loadedModelIds = new Set(loadedModels.map(m => m.id));
            // Convert catalog models and mark loaded ones
            const models = catalogModels.map(model => this.convertToFoundryLocalModel(model, loadedModelIds.has(model.id)));
            this.logger.info(`Discovered ${models.length} models from Foundry Local (${loadedModels.length} loaded)`);
            this.logger.info('Final converted models:', models.map(m => `${m.id} (loaded: ${m.isLoaded})`));
            return models;
        }
        catch (error) {
            this.logger.error('Failed to discover models', error);
            throw new Error(`Failed to discover models: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Sends a chat completion request to Foundry Local via OpenAI client
     */
    async sendChatRequest(request) {
        try {
            this.logger.debug('Sending chat request to Foundry Local', { model: request.model, messageCount: request.messages.length });
            await this.ensureOpenAIClient();
            const response = await this.openaiClient.chat.completions.create({
                model: request.model,
                messages: request.messages,
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
                    message: choice.message,
                    finish_reason: choice.finish_reason
                })),
                usage: response.usage ? {
                    prompt_tokens: response.usage.prompt_tokens,
                    completion_tokens: response.usage.completion_tokens,
                    total_tokens: response.usage.total_tokens
                } : undefined
            };
        }
        catch (error) {
            this.logger.error('Chat request failed', error);
            if (error && typeof error === 'object' && 'status' in error) {
                const apiError = error;
                if (apiError.status === 404) {
                    throw new Error(`Model '${request.model}' not found`);
                }
                else if (apiError.status === 400) {
                    throw new Error(`Invalid request: ${apiError.message}`);
                }
            }
            throw new Error(`Chat request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Sends a streaming chat completion request to Foundry Local via OpenAI client
     */
    async *sendStreamingChatRequest(request) {
        try {
            this.logger.debug('Sending streaming chat request to Foundry Local', { model: request.model });
            await this.ensureOpenAIClient();
            const stream = await this.openaiClient.chat.completions.create({
                model: request.model,
                messages: request.messages,
                max_tokens: request.max_tokens,
                temperature: request.temperature,
                top_p: request.top_p,
                stop: request.stop,
                stream: true
            });
            for await (const chunk of stream) {
                // Convert OpenAI streaming format to our format
                const foundryChunk = {
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
        }
        catch (error) {
            this.logger.error('Streaming chat request failed', error);
            throw new Error(`Streaming chat request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Loads a specific model in Foundry Local
     */
    async loadModel(modelId) {
        try {
            this.logger.info(`Loading model: ${modelId}`);
            await this.foundryManager.loadModel(modelId);
            this.logger.info(`Model loaded successfully: ${modelId}`);
        }
        catch (error) {
            this.logger.error(`Failed to load model: ${modelId}`, error);
            throw new Error(`Failed to load model: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Unloads a specific model in Foundry Local
     */
    async unloadModel(modelId) {
        try {
            this.logger.info(`Unloading model: ${modelId}`);
            await this.foundryManager.unloadModel(modelId);
            this.logger.info(`Model unloaded successfully: ${modelId}`);
        }
        catch (error) {
            this.logger.error(`Failed to unload model: ${modelId}`, error);
            throw new Error(`Failed to unload model: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Debug method to test direct HTTP connection to Foundry Local
     */
    async debugDirectConnection() {
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
            }
            else {
                this.logger.info(`Direct HTTP call failed with status: ${response.status} ${response.statusText}`);
            }
        }
        catch (error) {
            this.logger.info('Direct HTTP connection test failed:', error);
        }
    }
}
exports.FoundryLocalService = FoundryLocalService;
//# sourceMappingURL=foundryLocalService.js.map
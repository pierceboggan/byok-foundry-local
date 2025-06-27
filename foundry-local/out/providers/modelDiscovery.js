"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelDiscovery = void 0;
const vscode = __importStar(require("vscode"));
const foundryLocalService_1 = require("../services/foundryLocalService");
const configurationManager_1 = require("../services/configurationManager");
const logger_1 = require("../utils/logger");
class ModelDiscovery {
    static instance;
    logger = logger_1.Logger.getInstance();
    foundryService = foundryLocalService_1.FoundryLocalService.getInstance();
    configManager = configurationManager_1.ConfigurationManager.getInstance();
    models = [];
    lastRefresh;
    refreshInProgress = false;
    // Event emitter for model changes
    onModelsChangedEmitter = new vscode.EventEmitter();
    onModelsChanged = this.onModelsChangedEmitter.event;
    constructor() { }
    static getInstance() {
        if (!ModelDiscovery.instance) {
            ModelDiscovery.instance = new ModelDiscovery();
        }
        return ModelDiscovery.instance;
    }
    /**
     * Gets the currently cached models
     */
    getModels() {
        this.logger.debug(`ModelDiscovery returning ${this.models.length} cached models:`, this.models.map(m => `${m.id} (loaded: ${m.isLoaded})`));
        return [...this.models];
    }
    /**
     * Gets a specific model by ID
     */
    getModel(modelId) {
        return this.models.find(model => model.id === modelId);
    }
    /**
     * Gets the default model
     */
    getDefaultModel() {
        const defaultModelId = this.configManager.getDefaultModel();
        if (defaultModelId) {
            const model = this.getModel(defaultModelId);
            if (model) {
                return model;
            }
        }
        // If no configured default or model not found, return the first available model
        const availableModels = this.models.filter(model => model.isLoaded);
        return availableModels.length > 0 ? availableModels[0] : undefined;
    }
    /**
     * Gets models filtered by capabilities
     */
    getModelsByCapability(capability) {
        return this.models.filter(model => model.capabilities[capability]);
    }
    /**
     * Gets loaded models only
     */
    getLoadedModels() {
        return this.models.filter(model => model.isLoaded);
    }
    /**
     * Refreshes the models list from Foundry Local
     */
    async refreshModels() {
        this.logger.debug(`refreshModels called, refreshInProgress: ${this.refreshInProgress}`);
        if (this.refreshInProgress) {
            this.logger.debug('Model refresh already in progress, skipping');
            return this.models;
        }
        this.refreshInProgress = true;
        this.logger.debug('Starting model refresh...');
        try {
            this.logger.info('Refreshing models from Foundry Local');
            // Check service status first
            const status = await this.foundryService.checkServiceStatus();
            if (!status.isConnected) {
                throw new Error('Foundry Local service is not available');
            }
            // Discover models
            const discoveredModels = await this.foundryService.discoverModels();
            // Update the models list
            this.models = discoveredModels;
            this.lastRefresh = new Date();
            this.logger.info(`Refreshed ${this.models.length} models`);
            this.logger.debug('Cached models after refresh:', this.models.map(m => `${m.id} (loaded: ${m.isLoaded})`));
            // Notify listeners
            this.onModelsChangedEmitter.fire(this.models);
            return this.models;
        }
        catch (error) {
            this.logger.error('Failed to refresh models', error);
            throw error;
        }
        finally {
            this.refreshInProgress = false;
        }
    }
    /**
     * Loads a model in Foundry Local
     */
    async loadModel(modelId) {
        try {
            this.logger.info(`Loading model: ${modelId}`);
            await this.foundryService.loadModel(modelId);
            // Update the model status in our cache
            const model = this.models.find(m => m.id === modelId);
            if (model) {
                model.isLoaded = true;
                this.onModelsChangedEmitter.fire(this.models);
            }
            this.logger.info(`Model loaded: ${modelId}`);
        }
        catch (error) {
            this.logger.error(`Failed to load model: ${modelId}`, error);
            throw error;
        }
    }
    /**
     * Unloads a model in Foundry Local
     */
    async unloadModel(modelId) {
        try {
            this.logger.info(`Unloading model: ${modelId}`);
            await this.foundryService.unloadModel(modelId);
            // Update the model status in our cache
            const model = this.models.find(m => m.id === modelId);
            if (model) {
                model.isLoaded = false;
                this.onModelsChangedEmitter.fire(this.models);
            }
            this.logger.info(`Model unloaded: ${modelId}`);
        }
        catch (error) {
            this.logger.error(`Failed to unload model: ${modelId}`, error);
            throw error;
        }
    }
    /**
     * Sets the default model
     */
    async setDefaultModel(modelId) {
        const model = this.getModel(modelId);
        if (!model) {
            throw new Error(`Model not found: ${modelId}`);
        }
        // Update configuration
        await this.configManager.setDefaultModel(modelId);
        // Update model flags
        this.models.forEach(m => {
            m.isDefault = m.id === modelId;
        });
        this.onModelsChangedEmitter.fire(this.models);
        this.logger.info(`Default model set to: ${modelId}`);
    }
    /**
     * Shows a model selection quick pick
     */
    async showModelSelectionQuickPick(options) {
        let availableModels = this.models;
        // Filter by loaded status
        if (options?.onlyLoaded) {
            availableModels = availableModels.filter(model => model.isLoaded);
        }
        // Filter by capability
        if (options?.onlyWithCapability) {
            availableModels = availableModels.filter(model => model.capabilities[options.onlyWithCapability]);
        }
        if (availableModels.length === 0) {
            vscode.window.showInformationMessage('No models available. Please ensure Foundry Local is running and models are loaded.');
            return undefined;
        }
        const items = availableModels.map(model => ({
            label: model.name,
            description: model.id,
            detail: `${model.provider} • ${model.isLoaded ? 'Loaded' : 'Not loaded'}${model.isDefault ? ' • Default' : ''}`,
            model
        }));
        const selection = await vscode.window.showQuickPick(items, {
            title: options?.title || 'Select a model',
            placeHolder: 'Choose a Foundry Local model'
        });
        return selection?.model;
    }
    /**
     * Gets the time since last refresh
     */
    getTimeSinceLastRefresh() {
        return this.lastRefresh ? Date.now() - this.lastRefresh.getTime() : undefined;
    }
    /**
     * Checks if models need to be refreshed
     */
    needsRefresh() {
        if (!this.lastRefresh) {
            return true;
        }
        // Refresh if older than 5 minutes
        const maxAge = 5 * 60 * 1000; // 5 minutes in milliseconds
        return Date.now() - this.lastRefresh.getTime() > maxAge;
    }
    /**
     * Auto-refreshes models if needed
     */
    async autoRefreshIfNeeded() {
        if (this.needsRefresh() && !this.refreshInProgress) {
            try {
                await this.refreshModels();
            }
            catch (error) {
                this.logger.debug('Auto-refresh failed, will retry later', error);
            }
        }
    }
    dispose() {
        this.onModelsChangedEmitter.dispose();
    }
}
exports.ModelDiscovery = ModelDiscovery;
//# sourceMappingURL=modelDiscovery.js.map
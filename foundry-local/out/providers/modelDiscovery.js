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
        // First try to find the model marked as default
        const defaultModel = this.models.find(model => model.isDefault);
        if (defaultModel) {
            return defaultModel;
        }
        // Fall back to configured default model
        const config = this.configManager.getConfiguration();
        if (config.defaultModel) {
            const configuredDefault = this.models.find(model => model.id === config.defaultModel);
            if (configuredDefault) {
                return configuredDefault;
            }
        }
        // Fall back to first loaded model
        const loadedModel = this.models.find(model => model.isLoaded);
        if (loadedModel) {
            return loadedModel;
        }
        // Fall back to first available model
        return this.models.length > 0 ? this.models[0] : undefined;
    }
    /**
     * Gets models filtered by capabilities
     */
    getModelsWithCapabilities(capabilities) {
        return this.models.filter(model => {
            if (!model.capabilities) {
                return false;
            }
            return capabilities.every(capability => {
                switch (capability) {
                    case 'chat':
                        return model.capabilities?.chat;
                    case 'textGeneration':
                        return model.capabilities?.textGeneration;
                    case 'vision':
                        return model.capabilities?.vision;
                    case 'toolCalling':
                        return model.capabilities?.toolCalling;
                    default:
                        return false;
                }
            });
        });
    }
    /**
     * Gets only loaded models
     */
    getLoadedModels() {
        return this.models.filter(model => model.isLoaded);
    }
    /**
     * Refreshes the model list from Foundry Local
     */
    async refreshModels(force = false) {
        // Prevent concurrent refreshes
        if (this.refreshInProgress && !force) {
            this.logger.debug('Model refresh already in progress, skipping');
            return this.models;
        }
        // Check if refresh is needed
        if (!force && this.lastRefresh) {
            const timeSinceLastRefresh = Date.now() - this.lastRefresh.getTime();
            const refreshInterval = 30000; // 30 seconds
            if (timeSinceLastRefresh < refreshInterval) {
                this.logger.debug('Models refreshed recently, using cached data');
                return this.models;
            }
        }
        this.refreshInProgress = true;
        try {
            this.logger.info('Refreshing model list from Foundry Local');
            // Check if Foundry Local is available
            const status = await this.foundryService.checkStatus();
            if (!status.isReachable) {
                this.logger.warn('Foundry Local is not reachable, cannot refresh models');
                return this.models;
            }
            // Fetch models from Foundry Local
            const fetchedModels = await this.foundryService.getModels();
            // Update the cached models
            this.updateModels(fetchedModels);
            this.lastRefresh = new Date();
            this.logger.info(`Model refresh completed. Found ${this.models.length} models`);
            // Emit change event
            this.onModelsChangedEmitter.fire(this.models);
            return this.models;
        }
        catch (error) {
            this.logger.error('Failed to refresh models', error);
            return this.models;
        }
        finally {
            this.refreshInProgress = false;
        }
    }
    /**
     * Loads a specific model
     */
    async loadModel(modelId) {
        this.logger.info(`Loading model: ${modelId}`);
        const model = this.getModel(modelId);
        if (!model) {
            throw new Error(`Model not found: ${modelId}`);
        }
        if (model.isLoaded) {
            this.logger.info(`Model ${modelId} is already loaded`);
            return true;
        }
        const success = await this.foundryService.loadModel(modelId);
        if (success) {
            // Update the model state
            model.isLoaded = true;
            this.onModelsChangedEmitter.fire(this.models);
            this.logger.info(`Successfully loaded model: ${modelId}`);
        }
        return success;
    }
    /**
     * Unloads a specific model
     */
    async unloadModel(modelId) {
        this.logger.info(`Unloading model: ${modelId}`);
        const model = this.getModel(modelId);
        if (!model) {
            throw new Error(`Model not found: ${modelId}`);
        }
        if (!model.isLoaded) {
            this.logger.info(`Model ${modelId} is not loaded`);
            return true;
        }
        const success = await this.foundryService.unloadModel(modelId);
        if (success) {
            // Update the model state
            model.isLoaded = false;
            this.onModelsChangedEmitter.fire(this.models);
            this.logger.info(`Successfully unloaded model: ${modelId}`);
        }
        return success;
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
     * Starts periodic model discovery
     */
    startPeriodicDiscovery(intervalMs = 60000) {
        this.logger.info(`Starting periodic model discovery (interval: ${intervalMs}ms)`);
        // Initial refresh
        this.refreshModels();
        const timer = setInterval(() => {
            this.refreshModels();
        }, intervalMs);
        return new vscode.Disposable(() => {
            clearInterval(timer);
            this.logger.info('Stopped periodic model discovery');
        });
    }
    /**
     * Clears the cached models
     */
    clearCache() {
        this.models = [];
        this.lastRefresh = undefined;
        this.onModelsChangedEmitter.fire(this.models);
        this.logger.info('Model cache cleared');
    }
    /**
     * Gets the last refresh timestamp
     */
    getLastRefresh() {
        return this.lastRefresh;
    }
    /**
     * Checks if a refresh is in progress
     */
    isRefreshInProgress() {
        return this.refreshInProgress;
    }
    /**
     * Updates the cached models
     */
    updateModels(newModels) {
        // Preserve state from existing models
        const existingModelsMap = new Map(this.models.map(model => [model.id, model]));
        this.models = newModels.map(newModel => {
            const existingModel = existingModelsMap.get(newModel.id);
            if (existingModel) {
                // Preserve certain state from existing model
                return {
                    ...newModel,
                    isDefault: existingModel.isDefault // Preserve default state
                };
            }
            return newModel;
        });
        this.logger.debug(`Updated ${this.models.length} models in cache`);
    }
    /**
     * Disposes the model discovery service
     */
    dispose() {
        this.onModelsChangedEmitter.dispose();
    }
}
exports.ModelDiscovery = ModelDiscovery;
//# sourceMappingURL=modelDiscovery.js.map
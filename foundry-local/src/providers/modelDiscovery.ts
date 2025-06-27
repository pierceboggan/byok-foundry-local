import * as vscode from 'vscode';
import { FoundryLocalModel } from '../types/foundryLocal';
import { FoundryLocalService } from '../services/foundryLocalService';
import { ConfigurationManager } from '../services/configurationManager';
import { Logger } from '../utils/logger';

export class ModelDiscovery {
    private static instance: ModelDiscovery;
    private logger = Logger.getInstance();
    private foundryService = FoundryLocalService.getInstance();
    private configManager = ConfigurationManager.getInstance();
    private models: FoundryLocalModel[] = [];
    private lastRefresh: Date | undefined;
    private refreshInProgress = false;

    // Event emitter for model changes
    private onModelsChangedEmitter = new vscode.EventEmitter<FoundryLocalModel[]>();
    public readonly onModelsChanged = this.onModelsChangedEmitter.event;

    private constructor() {}

    public static getInstance(): ModelDiscovery {
        if (!ModelDiscovery.instance) {
            ModelDiscovery.instance = new ModelDiscovery();
        }
        return ModelDiscovery.instance;
    }

    /**
     * Gets the currently cached models
     */
    public getModels(): FoundryLocalModel[] {
        return [...this.models];
    }

    /**
     * Gets a specific model by ID
     */
    public getModel(modelId: string): FoundryLocalModel | undefined {
        return this.models.find(model => model.id === modelId);
    }

    /**
     * Gets the default model
     */
    public getDefaultModel(): FoundryLocalModel | undefined {
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
    public getModelsWithCapabilities(capabilities: string[]): FoundryLocalModel[] {
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
    public getLoadedModels(): FoundryLocalModel[] {
        return this.models.filter(model => model.isLoaded);
    }

    /**
     * Refreshes the model list from Foundry Local
     */
    public async refreshModels(force = false): Promise<FoundryLocalModel[]> {
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
        } catch (error) {
            this.logger.error('Failed to refresh models', error as Error);
            return this.models;
        } finally {
            this.refreshInProgress = false;
        }
    }

    /**
     * Loads a specific model
     */
    public async loadModel(modelId: string): Promise<boolean> {
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
    public async unloadModel(modelId: string): Promise<boolean> {
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
    public async setDefaultModel(modelId: string): Promise<void> {
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
    public startPeriodicDiscovery(intervalMs = 60000): vscode.Disposable {
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
    public clearCache(): void {
        this.models = [];
        this.lastRefresh = undefined;
        this.onModelsChangedEmitter.fire(this.models);
        this.logger.info('Model cache cleared');
    }

    /**
     * Gets the last refresh timestamp
     */
    public getLastRefresh(): Date | undefined {
        return this.lastRefresh;
    }

    /**
     * Checks if a refresh is in progress
     */
    public isRefreshInProgress(): boolean {
        return this.refreshInProgress;
    }

    /**
     * Updates the cached models
     */
    private updateModels(newModels: FoundryLocalModel[]): void {
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
    public dispose(): void {
        this.onModelsChangedEmitter.dispose();
    }
}
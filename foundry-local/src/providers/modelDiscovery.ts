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
    public getModelsByCapability(capability: keyof FoundryLocalModel['capabilities']): FoundryLocalModel[] {
        return this.models.filter(model => model.capabilities[capability]);
    }

    /**
     * Gets loaded models only
     */
    public getLoadedModels(): FoundryLocalModel[] {
        return this.models.filter(model => model.isLoaded);
    }

    /**
     * Refreshes the models list from Foundry Local
     */
    public async refreshModels(): Promise<FoundryLocalModel[]> {
        if (this.refreshInProgress) {
            this.logger.debug('Model refresh already in progress, skipping');
            return this.models;
        }

        this.refreshInProgress = true;

        try {
            this.logger.info('Refreshing models from Foundry Local');

            // Check service status first
            const status = await this.foundryService.checkServiceStatus();
            this.logger.debug('Service status check result:', status);
            
            if (!status.isConnected) {
                throw new Error('Foundry Local service is not available');
            }

            // Discover models
            const discoveredModels = await this.foundryService.discoverModels();
            this.logger.debug('Discovered models:', discoveredModels);
            
            // Update the models list
            this.models = discoveredModels;
            this.lastRefresh = new Date();

            this.logger.info(`Refreshed ${this.models.length} models`);

            // Notify listeners
            this.onModelsChangedEmitter.fire(this.models);

            return this.models;
        } catch (error) {
            this.logger.error('Failed to refresh models', error as Error);
            throw error;
        } finally {
            this.refreshInProgress = false;
        }
    }

    /**
     * Loads a model in Foundry Local
     */
    public async loadModel(modelId: string): Promise<void> {
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
        } catch (error) {
            this.logger.error(`Failed to load model: ${modelId}`, error as Error);
            throw error;
        }
    }

    /**
     * Unloads a model in Foundry Local
     */
    public async unloadModel(modelId: string): Promise<void> {
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
        } catch (error) {
            this.logger.error(`Failed to unload model: ${modelId}`, error as Error);
            throw error;
        }
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
     * Shows a model selection quick pick
     */
    public async showModelSelectionQuickPick(options?: {
        title?: string;
        onlyLoaded?: boolean;
        onlyWithCapability?: keyof FoundryLocalModel['capabilities'];
    }): Promise<FoundryLocalModel | undefined> {
        let availableModels = this.models;

        // Filter by loaded status
        if (options?.onlyLoaded) {
            availableModels = availableModels.filter(model => model.isLoaded);
        }

        // Filter by capability
        if (options?.onlyWithCapability) {
            availableModels = availableModels.filter(model => model.capabilities[options.onlyWithCapability!]);
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
    public getTimeSinceLastRefresh(): number | undefined {
        return this.lastRefresh ? Date.now() - this.lastRefresh.getTime() : undefined;
    }

    /**
     * Checks if models need to be refreshed
     */
    public needsRefresh(): boolean {
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
    public async autoRefreshIfNeeded(): Promise<void> {
        if (this.needsRefresh() && !this.refreshInProgress) {
            try {
                await this.refreshModels();
            } catch (error) {
                this.logger.debug('Auto-refresh failed, will retry later', error as Error);
            }
        }
    }

    public dispose(): void {
        this.onModelsChangedEmitter.dispose();
    }
}
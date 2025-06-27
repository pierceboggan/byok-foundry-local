import * as vscode from 'vscode';
import { FoundryLocalConfig, CONFIG_KEYS, DEFAULT_CONFIG } from '../types/foundryLocal';
import { Logger } from '../utils/logger';

export class ConfigurationManager {
    private static instance: ConfigurationManager;
    private logger = Logger.getInstance();
    private disposables: vscode.Disposable[] = [];

    private constructor() {
        // Listen for configuration changes
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration((event) => {
                if (event.affectsConfiguration('foundryLocal')) {
                    this.logger.info('Foundry Local configuration changed');
                    this.onConfigurationChanged();
                }
            })
        );
    }

    public static getInstance(): ConfigurationManager {
        if (!ConfigurationManager.instance) {
            ConfigurationManager.instance = new ConfigurationManager();
        }
        return ConfigurationManager.instance;
    }

    /**
     * Gets the current Foundry Local configuration
     */
    public getConfiguration(): FoundryLocalConfig {
        const config = vscode.workspace.getConfiguration();
        
        return {
            endpoint: config.get<string>(CONFIG_KEYS.ENDPOINT) || DEFAULT_CONFIG.endpoint,
            port: config.get<number>(CONFIG_KEYS.PORT) || DEFAULT_CONFIG.port,
            apiKey: config.get<string>(CONFIG_KEYS.API_KEY),
            timeout: config.get<number>(CONFIG_KEYS.TIMEOUT) || DEFAULT_CONFIG.timeout,
            maxRetries: config.get<number>(CONFIG_KEYS.MAX_RETRIES) || DEFAULT_CONFIG.maxRetries
        };
    }

    /**
     * Gets the full API URL for Foundry Local
     */
    public getApiUrl(): string {
        const config = this.getConfiguration();
        return `${config.endpoint}:${config.port}`;
    }

    /**
     * Gets the default model ID from configuration
     */
    public getDefaultModel(): string | undefined {
        const config = vscode.workspace.getConfiguration();
        return config.get<string>(CONFIG_KEYS.DEFAULT_MODEL);
    }

    /**
     * Sets the default model ID in configuration
     */
    public async setDefaultModel(modelId: string): Promise<void> {
        const config = vscode.workspace.getConfiguration();
        await config.update(CONFIG_KEYS.DEFAULT_MODEL, modelId, vscode.ConfigurationTarget.Global);
        this.logger.info(`Default model set to: ${modelId}`);
    }

    /**
     * Gets the auto-start setting
     */
    public getAutoStart(): boolean {
        const config = vscode.workspace.getConfiguration();
        return config.get<boolean>(CONFIG_KEYS.AUTO_START) || false;
    }

    /**
     * Gets the log level setting
     */
    public getLogLevel(): string {
        const config = vscode.workspace.getConfiguration();
        return config.get<string>(CONFIG_KEYS.LOG_LEVEL) || 'info';
    }

    /**
     * Validates the current configuration
     */
    public validateConfiguration(): { isValid: boolean; errors: string[] } {
        const config = this.getConfiguration();
        const errors: string[] = [];

        // Validate endpoint
        if (!config.endpoint) {
            errors.push('Endpoint is required');
        } else {
            try {
                new URL(config.endpoint);
            } catch {
                errors.push('Invalid endpoint URL format');
            }
        }

        // Validate port
        if (!config.port || config.port < 1 || config.port > 65535) {
            errors.push('Port must be between 1 and 65535');
        }

        // Validate timeout
        if (config.timeout < 1000) {
            errors.push('Timeout must be at least 1000ms');
        }

        // Validate max retries
        if (config.maxRetries < 0 || config.maxRetries > 10) {
            errors.push('Max retries must be between 0 and 10');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Opens the settings UI for Foundry Local
     */
    public async openSettings(): Promise<void> {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'foundryLocal');
    }

    /**
     * Resets configuration to defaults
     */
    public async resetToDefaults(): Promise<void> {
        const config = vscode.workspace.getConfiguration();
        
        await Promise.all([
            config.update(CONFIG_KEYS.ENDPOINT, undefined, vscode.ConfigurationTarget.Global),
            config.update(CONFIG_KEYS.PORT, undefined, vscode.ConfigurationTarget.Global),
            config.update(CONFIG_KEYS.API_KEY, undefined, vscode.ConfigurationTarget.Global),
            config.update(CONFIG_KEYS.TIMEOUT, undefined, vscode.ConfigurationTarget.Global),
            config.update(CONFIG_KEYS.MAX_RETRIES, undefined, vscode.ConfigurationTarget.Global),
            config.update(CONFIG_KEYS.DEFAULT_MODEL, undefined, vscode.ConfigurationTarget.Global),
            config.update(CONFIG_KEYS.AUTO_START, undefined, vscode.ConfigurationTarget.Global),
            config.update(CONFIG_KEYS.LOG_LEVEL, undefined, vscode.ConfigurationTarget.Global)
        ]);

        this.logger.info('Configuration reset to defaults');
    }

    /**
     * Called when configuration changes
     */
    private onConfigurationChanged(): void {
        const validation = this.validateConfiguration();
        if (!validation.isValid) {
            this.logger.warn('Invalid configuration detected:', validation.errors);
            vscode.window.showWarningMessage(
                `Foundry Local configuration issues: ${validation.errors.join(', ')}`,
                'Open Settings'
            ).then((selection) => {
                if (selection === 'Open Settings') {
                    this.openSettings();
                }
            });
        }
    }

    public dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}
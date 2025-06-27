import * as vscode from 'vscode';
import { FoundryLocalConfiguration, ConfigurationValidation } from '../types/foundryLocal';
import { Logger } from '../utils/logger';

/**
 * Manages extension configuration
 */
export class ConfigurationManager {
    private static instance: ConfigurationManager;
    private logger = Logger.getInstance();

    private constructor() {}

    public static getInstance(): ConfigurationManager {
        if (!ConfigurationManager.instance) {
            ConfigurationManager.instance = new ConfigurationManager();
        }
        return ConfigurationManager.instance;
    }

    /**
     * Gets the current configuration
     */
    public getConfiguration(): FoundryLocalConfiguration {
        const config = vscode.workspace.getConfiguration('foundryLocal');
        
        return {
            endpoint: config.get<string>('endpoint', 'http://localhost'),
            port: config.get<number>('port', 8080),
            timeout: config.get<number>('timeout', 30000),
            maxRetries: config.get<number>('maxRetries', 3),
            defaultModel: config.get<string>('defaultModel'),
            debug: config.get<boolean>('debug', false),
            logLevel: config.get<'debug' | 'info' | 'warn' | 'error'>('logLevel', 'info')
        };
    }

    /**
     * Gets the log level from configuration
     */
    public getLogLevel(): string {
        const config = vscode.workspace.getConfiguration('foundryLocal');
        return config.get<string>('logLevel', 'info');
    }

    /**
     * Sets the default model
     */
    public async setDefaultModel(modelId: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('foundryLocal');
        await config.update('defaultModel', modelId, vscode.ConfigurationTarget.Global);
        this.logger.info(`Default model set to: ${modelId}`);
    }

    /**
     * Gets the Foundry Local endpoint URL
     */
    public getEndpointUrl(): string {
        const config = this.getConfiguration();
        return `${config.endpoint}:${config.port}`;
    }

    /**
     * Validates the current configuration
     */
    public validateConfiguration(): ConfigurationValidation {
        const config = this.getConfiguration();
        const errors: string[] = [];
        const warnings: string[] = [];

        // Validate endpoint
        if (!config.endpoint) {
            errors.push('Endpoint URL is required');
        } else {
            try {
                new URL(`${config.endpoint}:${config.port}`);
            } catch (error) {
                errors.push('Invalid endpoint URL format');
            }
        }

        // Validate port
        if (!config.port || config.port < 1 || config.port > 65535) {
            errors.push('Port must be between 1 and 65535');
        }

        // Validate timeout
        if (config.timeout < 1000) {
            warnings.push('Timeout is very low (< 1 second)');
        } else if (config.timeout > 300000) {
            warnings.push('Timeout is very high (> 5 minutes)');
        }

        // Validate max retries
        if (config.maxRetries < 0) {
            errors.push('Max retries cannot be negative');
        } else if (config.maxRetries > 10) {
            warnings.push('Max retries is very high (> 10)');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Updates a configuration value
     */
    public async updateConfiguration(key: keyof FoundryLocalConfiguration, value: any): Promise<void> {
        const config = vscode.workspace.getConfiguration('foundryLocal');
        await config.update(key, value, vscode.ConfigurationTarget.Global);
        this.logger.info(`Configuration updated: ${key} = ${value}`);
    }

    /**
     * Resets configuration to defaults
     */
    public async resetConfiguration(): Promise<void> {
        const config = vscode.workspace.getConfiguration('foundryLocal');
        const keys: (keyof FoundryLocalConfiguration)[] = [
            'endpoint', 'port', 'timeout', 'maxRetries', 'defaultModel', 'debug', 'logLevel'
        ];

        for (const key of keys) {
            await config.update(key, undefined, vscode.ConfigurationTarget.Global);
        }

        this.logger.info('Configuration reset to defaults');
    }

    /**
     * Watches for configuration changes
     */
    public onConfigurationChanged(callback: (config: FoundryLocalConfiguration) => void): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('foundryLocal')) {
                this.logger.debug('Configuration changed');
                callback(this.getConfiguration());
            }
        });
    }
}
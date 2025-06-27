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
exports.ConfigurationManager = void 0;
const vscode = __importStar(require("vscode"));
const foundryLocal_1 = require("../types/foundryLocal");
const logger_1 = require("../utils/logger");
class ConfigurationManager {
    static instance;
    logger = logger_1.Logger.getInstance();
    disposables = [];
    constructor() {
        // Listen for configuration changes
        this.disposables.push(vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('foundryLocal')) {
                this.logger.info('Foundry Local configuration changed');
                this.onConfigurationChanged();
            }
        }));
    }
    static getInstance() {
        if (!ConfigurationManager.instance) {
            ConfigurationManager.instance = new ConfigurationManager();
        }
        return ConfigurationManager.instance;
    }
    /**
     * Gets the current Foundry Local configuration
     */
    getConfiguration() {
        const config = vscode.workspace.getConfiguration();
        return {
            endpoint: config.get(foundryLocal_1.CONFIG_KEYS.ENDPOINT) || foundryLocal_1.DEFAULT_CONFIG.endpoint,
            port: config.get(foundryLocal_1.CONFIG_KEYS.PORT) || foundryLocal_1.DEFAULT_CONFIG.port,
            apiKey: config.get(foundryLocal_1.CONFIG_KEYS.API_KEY),
            timeout: config.get(foundryLocal_1.CONFIG_KEYS.TIMEOUT) || foundryLocal_1.DEFAULT_CONFIG.timeout,
            maxRetries: config.get(foundryLocal_1.CONFIG_KEYS.MAX_RETRIES) || foundryLocal_1.DEFAULT_CONFIG.maxRetries
        };
    }
    /**
     * Gets the full API URL for Foundry Local
     */
    getApiUrl() {
        const config = this.getConfiguration();
        return `${config.endpoint}:${config.port}`;
    }
    /**
     * Gets the default model ID from configuration
     */
    getDefaultModel() {
        const config = vscode.workspace.getConfiguration();
        return config.get(foundryLocal_1.CONFIG_KEYS.DEFAULT_MODEL);
    }
    /**
     * Sets the default model ID in configuration
     */
    async setDefaultModel(modelId) {
        const config = vscode.workspace.getConfiguration();
        await config.update(foundryLocal_1.CONFIG_KEYS.DEFAULT_MODEL, modelId, vscode.ConfigurationTarget.Global);
        this.logger.info(`Default model set to: ${modelId}`);
    }
    /**
     * Gets the auto-start setting
     */
    getAutoStart() {
        const config = vscode.workspace.getConfiguration();
        return config.get(foundryLocal_1.CONFIG_KEYS.AUTO_START) || false;
    }
    /**
     * Gets the log level setting
     */
    getLogLevel() {
        const config = vscode.workspace.getConfiguration();
        return config.get(foundryLocal_1.CONFIG_KEYS.LOG_LEVEL) || 'info';
    }
    /**
     * Validates the current configuration
     */
    validateConfiguration() {
        const config = this.getConfiguration();
        const errors = [];
        // Validate endpoint
        if (!config.endpoint) {
            errors.push('Endpoint is required');
        }
        else {
            try {
                new URL(config.endpoint);
            }
            catch {
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
    async openSettings() {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'foundryLocal');
    }
    /**
     * Resets configuration to defaults
     */
    async resetToDefaults() {
        const config = vscode.workspace.getConfiguration();
        await Promise.all([
            config.update(foundryLocal_1.CONFIG_KEYS.ENDPOINT, undefined, vscode.ConfigurationTarget.Global),
            config.update(foundryLocal_1.CONFIG_KEYS.PORT, undefined, vscode.ConfigurationTarget.Global),
            config.update(foundryLocal_1.CONFIG_KEYS.API_KEY, undefined, vscode.ConfigurationTarget.Global),
            config.update(foundryLocal_1.CONFIG_KEYS.TIMEOUT, undefined, vscode.ConfigurationTarget.Global),
            config.update(foundryLocal_1.CONFIG_KEYS.MAX_RETRIES, undefined, vscode.ConfigurationTarget.Global),
            config.update(foundryLocal_1.CONFIG_KEYS.DEFAULT_MODEL, undefined, vscode.ConfigurationTarget.Global),
            config.update(foundryLocal_1.CONFIG_KEYS.AUTO_START, undefined, vscode.ConfigurationTarget.Global),
            config.update(foundryLocal_1.CONFIG_KEYS.LOG_LEVEL, undefined, vscode.ConfigurationTarget.Global)
        ]);
        this.logger.info('Configuration reset to defaults');
    }
    /**
     * Called when configuration changes
     */
    onConfigurationChanged() {
        const validation = this.validateConfiguration();
        if (!validation.isValid) {
            this.logger.warn('Invalid configuration detected:', validation.errors);
            vscode.window.showWarningMessage(`Foundry Local configuration issues: ${validation.errors.join(', ')}`, 'Open Settings').then((selection) => {
                if (selection === 'Open Settings') {
                    this.openSettings();
                }
            });
        }
    }
    dispose() {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}
exports.ConfigurationManager = ConfigurationManager;
//# sourceMappingURL=configurationManager.js.map
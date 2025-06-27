"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMMANDS = exports.DEFAULT_CONFIG = exports.CONFIG_KEYS = void 0;
/**
 * Configuration keys for VS Code settings
 */
exports.CONFIG_KEYS = {
    ENDPOINT: 'foundryLocal.endpoint',
    PORT: 'foundryLocal.port',
    API_KEY: 'foundryLocal.apiKey',
    TIMEOUT: 'foundryLocal.timeout',
    MAX_RETRIES: 'foundryLocal.maxRetries',
    DEFAULT_MODEL: 'foundryLocal.defaultModel',
    AUTO_START: 'foundryLocal.autoStart',
    LOG_LEVEL: 'foundryLocal.logLevel'
};
/**
 * Default configuration values
 */
exports.DEFAULT_CONFIG = {
    endpoint: 'http://localhost',
    port: 8000,
    timeout: 30000,
    maxRetries: 3
};
/**
 * Command identifiers for the extension
 */
exports.COMMANDS = {
    REFRESH_MODELS: 'foundry-local.refreshModels',
    SELECT_MODEL: 'foundry-local.selectModel',
    START_SERVICE: 'foundry-local.startService',
    STOP_SERVICE: 'foundry-local.stopService',
    SHOW_STATUS: 'foundry-local.showStatus',
    OPEN_SETTINGS: 'foundry-local.openSettings'
};
//# sourceMappingURL=foundryLocal.js.map
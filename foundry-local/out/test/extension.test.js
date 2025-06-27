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
const assert = __importStar(require("assert"));
const vscode = __importStar(require("vscode"));
const tokenCounter_1 = require("../utils/tokenCounter");
const configurationManager_1 = require("../services/configurationManager");
const foundryLocalService_1 = require("../services/foundryLocalService");
const logger_1 = require("../utils/logger");
suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');
    test('TokenCounter estimates tokens correctly', () => {
        const text = 'Hello world, this is a test message.';
        const tokens = tokenCounter_1.TokenCounter.estimateTokens(text);
        // Should estimate roughly text.length / 4 tokens
        assert.ok(tokens > 0, 'Token count should be greater than 0');
        assert.ok(tokens < text.length, 'Token count should be less than character count');
    });
    test('TokenCounter formats token counts correctly', () => {
        assert.strictEqual(tokenCounter_1.TokenCounter.formatTokenCount(500), '500 tokens');
        assert.strictEqual(tokenCounter_1.TokenCounter.formatTokenCount(1500), '1.5K tokens');
        assert.strictEqual(tokenCounter_1.TokenCounter.formatTokenCount(1500000), '1.5M tokens');
    });
    test('TokenCounter checks token limits correctly', () => {
        const shortText = 'Hello';
        const longText = 'This is a much longer text that would exceed token limits';
        assert.ok(tokenCounter_1.TokenCounter.isWithinLimit(shortText, 100), 'Short text should be within limit');
        assert.ok(!tokenCounter_1.TokenCounter.isWithinLimit(longText, 2), 'Long text should exceed small limit');
    });
    test('Logger singleton works correctly', () => {
        const logger1 = logger_1.Logger.getInstance();
        const logger2 = logger_1.Logger.getInstance();
        assert.strictEqual(logger1, logger2, 'Logger should be a singleton');
    });
    test('Logger levels work correctly', () => {
        const logger = logger_1.Logger.getInstance();
        // Test setting different log levels
        logger.setLogLevel(logger_1.LogLevel.DEBUG);
        logger.setLogLevel(logger_1.LogLevel.INFO);
        logger.setLogLevel(logger_1.LogLevel.WARN);
        logger.setLogLevel(logger_1.LogLevel.ERROR);
        // If we get here without errors, the log levels are working
        assert.ok(true, 'Log levels should be settable');
    });
    test('ConfigurationManager singleton works correctly', () => {
        const config1 = configurationManager_1.ConfigurationManager.getInstance();
        const config2 = configurationManager_1.ConfigurationManager.getInstance();
        assert.strictEqual(config1, config2, 'ConfigurationManager should be a singleton');
    });
    test('ConfigurationManager validates configuration', () => {
        const configManager = configurationManager_1.ConfigurationManager.getInstance();
        const validation = configManager.validateConfiguration();
        // Should have a validation result with isValid and errors properties
        assert.ok(typeof validation.isValid === 'boolean', 'Validation should return isValid boolean');
        assert.ok(Array.isArray(validation.errors), 'Validation should return errors array');
    });
    test('Default configuration values are reasonable', () => {
        const configManager = configurationManager_1.ConfigurationManager.getInstance();
        const config = configManager.getConfiguration();
        assert.ok(config.endpoint, 'Should have a default endpoint');
        assert.ok(config.port > 0, 'Should have a valid port number');
        assert.ok(config.timeout > 0, 'Should have a positive timeout');
        assert.ok(config.maxRetries >= 0, 'Should have non-negative max retries');
    });
    test('FoundryLocalService singleton works correctly', () => {
        const service1 = foundryLocalService_1.FoundryLocalService.getInstance();
        const service2 = foundryLocalService_1.FoundryLocalService.getInstance();
        assert.strictEqual(service1, service2, 'FoundryLocalService should be a singleton');
    });
    test('FoundryLocalService initializes without errors', () => {
        const service = foundryLocalService_1.FoundryLocalService.getInstance();
        // Should be able to get status without throwing
        const status = service.getStatus();
        assert.ok(typeof status.isRunning === 'boolean', 'Status should have isRunning boolean');
        assert.ok(typeof status.isConnected === 'boolean', 'Status should have isConnected boolean');
        assert.ok(typeof status.modelsLoaded === 'number', 'Status should have modelsLoaded number');
        assert.ok(status.lastChecked instanceof Date, 'Status should have lastChecked Date');
    });
    test('FoundryLocalService updateConfiguration works', () => {
        const service = foundryLocalService_1.FoundryLocalService.getInstance();
        // Should be able to update configuration without throwing
        assert.doesNotThrow(() => {
            service.updateConfiguration();
        }, 'updateConfiguration should not throw');
    });
});
//# sourceMappingURL=extension.test.js.map
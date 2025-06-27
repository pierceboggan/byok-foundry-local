import * as assert from 'assert';
import * as vscode from 'vscode';
import { TokenCounter } from '../utils/tokenCounter';
import { ConfigurationManager } from '../services/configurationManager';
import { FoundryLocalService } from '../services/foundryLocalService';
import { Logger, LogLevel } from '../utils/logger';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('TokenCounter estimates tokens correctly', () => {
		const text = 'Hello world, this is a test message.';
		const tokens = TokenCounter.estimateTokens(text);
		
		// Should estimate roughly text.length / 4 tokens
		assert.ok(tokens > 0, 'Token count should be greater than 0');
		assert.ok(tokens < text.length, 'Token count should be less than character count');
	});

	test('TokenCounter formats token counts correctly', () => {
		assert.strictEqual(TokenCounter.formatTokenCount(500), '500 tokens');
		assert.strictEqual(TokenCounter.formatTokenCount(1500), '1.5K tokens');
		assert.strictEqual(TokenCounter.formatTokenCount(1500000), '1.5M tokens');
	});

	test('TokenCounter checks token limits correctly', () => {
		const shortText = 'Hello';
		const longText = 'This is a much longer text that would exceed token limits';
		
		assert.ok(TokenCounter.isWithinLimit(shortText, 100), 'Short text should be within limit');
		assert.ok(!TokenCounter.isWithinLimit(longText, 2), 'Long text should exceed small limit');
	});

	test('Logger singleton works correctly', () => {
		const logger1 = Logger.getInstance();
		const logger2 = Logger.getInstance();
		
		assert.strictEqual(logger1, logger2, 'Logger should be a singleton');
	});

	test('Logger levels work correctly', () => {
		const logger = Logger.getInstance();
		
		// Test setting different log levels
		logger.setLogLevel(LogLevel.DEBUG);
		logger.setLogLevel(LogLevel.INFO);
		logger.setLogLevel(LogLevel.WARN);
		logger.setLogLevel(LogLevel.ERROR);
		
		// If we get here without errors, the log levels are working
		assert.ok(true, 'Log levels should be settable');
	});

	test('ConfigurationManager singleton works correctly', () => {
		const config1 = ConfigurationManager.getInstance();
		const config2 = ConfigurationManager.getInstance();
		
		assert.strictEqual(config1, config2, 'ConfigurationManager should be a singleton');
	});

	test('ConfigurationManager validates configuration', () => {
		const configManager = ConfigurationManager.getInstance();
		const validation = configManager.validateConfiguration();
		
		// Should have a validation result with isValid and errors properties
		assert.ok(typeof validation.isValid === 'boolean', 'Validation should return isValid boolean');
		assert.ok(Array.isArray(validation.errors), 'Validation should return errors array');
	});

	test('Default configuration values are reasonable', () => {
		const configManager = ConfigurationManager.getInstance();
		const config = configManager.getConfiguration();
		
		assert.ok(config.endpoint, 'Should have a default endpoint');
		assert.ok(config.port > 0, 'Should have a valid port number');
		assert.ok(config.timeout > 0, 'Should have a positive timeout');
		assert.ok(config.maxRetries >= 0, 'Should have non-negative max retries');
	});

	test('FoundryLocalService singleton works correctly', () => {
		const service1 = FoundryLocalService.getInstance();
		const service2 = FoundryLocalService.getInstance();
		
		assert.strictEqual(service1, service2, 'FoundryLocalService should be a singleton');
	});

	test('FoundryLocalService initializes without errors', () => {
		const service = FoundryLocalService.getInstance();
		
		// Should be able to get status without throwing
		const status = service.getStatus();
		assert.ok(typeof status.isRunning === 'boolean', 'Status should have isRunning boolean');
		assert.ok(typeof status.isConnected === 'boolean', 'Status should have isConnected boolean');
		assert.ok(typeof status.modelsLoaded === 'number', 'Status should have modelsLoaded number');
		assert.ok(status.lastChecked instanceof Date, 'Status should have lastChecked Date');
	});

	test('FoundryLocalService updateConfiguration works', () => {
		const service = FoundryLocalService.getInstance();
		
		// Should be able to update configuration without throwing
		assert.doesNotThrow(() => {
			service.updateConfiguration();
		}, 'updateConfiguration should not throw');
	});
});

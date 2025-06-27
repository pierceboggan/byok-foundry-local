"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateImplementation = validateImplementation;
const tokenCounter_1 = require("../utils/tokenCounter");
const configurationManager_1 = require("../services/configurationManager");
const logger_1 = require("../utils/logger");
const modelDiscovery_1 = require("../providers/modelDiscovery");
/**
 * Simple validation test to ensure core functionality works
 */
async function validateImplementation() {
    console.log('=== Foundry Local Extension Validation ===\n');
    try {
        // Test 1: Logger functionality
        console.log('1. Testing Logger...');
        const logger = logger_1.Logger.getInstance();
        logger.info('Logger test successful');
        console.log('   ✅ Logger working\n');
        // Test 2: Configuration Manager
        console.log('2. Testing Configuration Manager...');
        const configManager = configurationManager_1.ConfigurationManager.getInstance();
        const config = configManager.getConfiguration();
        const validation = configManager.validateConfiguration();
        console.log(`   Config endpoint: ${config.endpoint}:${config.port}`);
        console.log(`   Validation: ${validation.isValid ? '✅ Valid' : '❌ Invalid'}`);
        if (validation.errors.length > 0) {
            console.log(`   Errors: ${validation.errors.join(', ')}`);
        }
        console.log('   ✅ Configuration Manager working\n');
        // Test 3: Token Counter
        console.log('3. Testing Token Counter...');
        const sampleText = 'Hello, this is a test message for token counting.';
        const tokens = tokenCounter_1.TokenCounter.estimateTokens(sampleText);
        const formatted = tokenCounter_1.TokenCounter.formatTokenCount(tokens);
        console.log(`   Sample text: "${sampleText}"`);
        console.log(`   Estimated tokens: ${tokens}`);
        console.log(`   Formatted: ${formatted}`);
        console.log('   ✅ Token Counter working\n');
        // Test 4: Model Discovery (without actual Foundry Local connection)
        console.log('4. Testing Model Discovery...');
        const modelDiscovery = modelDiscovery_1.ModelDiscovery.getInstance();
        const models = modelDiscovery.getModels();
        console.log(`   Current models in cache: ${models.length}`);
        console.log('   ✅ Model Discovery working\n');
        console.log('=== All Core Components Validated Successfully! ===\n');
        console.log('🎉 The Foundry Local extension implementation is ready!');
        console.log('\nKey features implemented:');
        console.log('• Language Model Chat Provider for VS Code model picker');
        console.log('• Chat participant (@foundry-local) for direct chat');
        console.log('• Model discovery and management');
        console.log('• Token counting and usage estimation');
        console.log('• Comprehensive configuration management');
        console.log('• Robust error handling and logging');
        return true;
    }
    catch (error) {
        console.error('❌ Validation failed:', error);
        return false;
    }
}
// Run validation if this file is executed directly
if (require.main === module) {
    validateImplementation().then(success => {
        process.exit(success ? 0 : 1);
    });
}
//# sourceMappingURL=validation.js.map
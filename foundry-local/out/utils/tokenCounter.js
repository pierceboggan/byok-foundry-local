"use strict";
/**
 * Simple token counter utility for approximating token usage
 * This provides a basic estimation since we don't have access to the exact tokenizer
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenCounter = void 0;
class TokenCounter {
    /**
     * Estimates token count for a given text
     * Uses a simple heuristic: ~4 characters per token for most models
     */
    static estimateTokens(text) {
        if (!text) {
            return 0;
        }
        // Basic estimation: ~4 characters per token
        // This is an approximation and may vary by model
        const charactersPerToken = 4;
        return Math.ceil(text.length / charactersPerToken);
    }
    /**
     * Estimates token count for an array of messages
     */
    static estimateTokensForMessages(messages) {
        let totalTokens = 0;
        for (const message of messages) {
            // Add tokens for the content
            totalTokens += this.estimateTokens(message.content);
            // Add a small overhead for message structure (role, formatting, etc.)
            totalTokens += 4; // Approximate overhead per message
        }
        return totalTokens;
    }
    /**
     * Checks if the estimated token count is within the model's limits
     */
    static isWithinLimit(text, maxTokens) {
        const estimatedTokens = this.estimateTokens(text);
        return estimatedTokens <= maxTokens;
    }
    /**
     * Truncates text to fit within a token limit
     */
    static truncateToTokenLimit(text, maxTokens) {
        const estimatedTokens = this.estimateTokens(text);
        if (estimatedTokens <= maxTokens) {
            return text;
        }
        // Calculate approximate character limit
        const charactersPerToken = 4;
        const maxCharacters = maxTokens * charactersPerToken;
        // Truncate with some buffer for safety
        const safeCharacterLimit = Math.floor(maxCharacters * 0.9);
        return text.substring(0, safeCharacterLimit) + '...';
    }
    /**
     * Formats token count for display
     */
    static formatTokenCount(tokens) {
        if (tokens < 1000) {
            return `${tokens} tokens`;
        }
        else if (tokens < 1000000) {
            return `${(tokens / 1000).toFixed(1)}K tokens`;
        }
        else {
            return `${(tokens / 1000000).toFixed(1)}M tokens`;
        }
    }
}
exports.TokenCounter = TokenCounter;
//# sourceMappingURL=tokenCounter.js.map
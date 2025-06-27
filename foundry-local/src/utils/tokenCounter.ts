/**
 * Simple token counter utility for approximating token usage
 * This provides a basic estimation since we don't have access to the exact tokenizer
 */

export class TokenCounter {
    /**
     * Estimates token count for a given text
     * Uses a simple heuristic: ~4 characters per token for most models
     */
    public static estimateTokens(text: string): number {
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
    public static estimateTokensForMessages(messages: Array<{ role: string; content: string }>): number {
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
    public static isWithinLimit(text: string, maxTokens: number): boolean {
        const estimatedTokens = this.estimateTokens(text);
        return estimatedTokens <= maxTokens;
    }

    /**
     * Truncates text to fit within a token limit
     */
    public static truncateToTokenLimit(text: string, maxTokens: number): string {
        if (this.isWithinLimit(text, maxTokens)) {
            return text;
        }

        // Estimate how many characters we can keep
        const charactersPerToken = 4;
        const maxCharacters = maxTokens * charactersPerToken;
        
        // Truncate with some buffer
        const truncated = text.substring(0, maxCharacters - 100);
        
        // Try to truncate at a word boundary
        const lastSpaceIndex = truncated.lastIndexOf(' ');
        if (lastSpaceIndex > 0) {
            return truncated.substring(0, lastSpaceIndex) + '...';
        }
        
        return truncated + '...';
    }

    /**
     * Formats token count for display
     */
    public static formatTokenCount(tokens: number): string {
        if (tokens < 1000) {
            return `${tokens} tokens`;
        } else if (tokens < 1000000) {
            return `${(tokens / 1000).toFixed(1)}K tokens`;
        } else {
            return `${(tokens / 1000000).toFixed(1)}M tokens`;
        }
    }
}
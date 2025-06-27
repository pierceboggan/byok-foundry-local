import * as vscode from 'vscode';

/**
 * Represents a Foundry Local model
 */
export interface FoundryLocalModel {
    /** Unique identifier for the model */
    id: string;
    
    /** Human-readable name */
    name: string;
    
    /** Model family/type */
    family: string;
    
    /** Description of the model */
    description?: string;
    
    /** Whether the model is currently loaded */
    isLoaded: boolean;
    
    /** Whether this is the default model */
    isDefault: boolean;
    
    /** Model size in bytes */
    size?: number;
    
    /** Model parameters */
    parameters?: string;
    
    /** Model capabilities */
    capabilities?: {
        /** Supports text generation */
        textGeneration?: boolean;
        /** Supports chat */
        chat?: boolean;
        /** Supports vision */
        vision?: boolean;
        /** Supports tool calling */
        toolCalling?: boolean;
    };
    
    /** Token limits */
    maxInputTokens?: number;
    maxOutputTokens?: number;
    
    /** Model version */
    version?: string;
    
    /** Model vendor */
    vendor?: string;
    
    /** Model cost information */
    cost?: string;
}

/**
 * Represents a chat message for Foundry Local
 */
export interface FoundryChatMessage {
    /** Message role */
    role: 'user' | 'assistant' | 'system';
    
    /** Message content */
    content: string;
    
    /** Optional message metadata */
    metadata?: {
        /** Token count for this message */
        tokenCount?: number;
        /** Timestamp */
        timestamp?: Date;
    };
}

/**
 * Represents a chat response from Foundry Local
 */
export interface FoundryChatResponse {
    /** Response content */
    content: string;
    
    /** Token usage information */
    usage?: {
        /** Input tokens used */
        inputTokens: number;
        /** Output tokens generated */
        outputTokens: number;
        /** Total tokens */
        totalTokens: number;
    };
    
    /** Model used for the response */
    model: string;
    
    /** Whether the response was truncated */
    truncated?: boolean;
    
    /** Finish reason */
    finishReason?: 'stop' | 'length' | 'error';
}

/**
 * Configuration for Foundry Local service
 */
export interface FoundryLocalConfiguration {
    /** Foundry Local endpoint URL */
    endpoint: string;
    
    /** Port number */
    port: number;
    
    /** Request timeout in milliseconds */
    timeout: number;
    
    /** Maximum number of retries */
    maxRetries: number;
    
    /** Default model to use */
    defaultModel?: string;
    
    /** Enable debug logging */
    debug: boolean;
    
    /** Log level */
    logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Validation result for configuration
 */
export interface ConfigurationValidation {
    /** Whether the configuration is valid */
    isValid: boolean;
    
    /** Array of validation errors */
    errors: string[];
    
    /** Array of validation warnings */
    warnings?: string[];
}

/**
 * Status of Foundry Local service
 */
export interface FoundryLocalStatus {
    /** Whether Foundry Local is running */
    isRunning: boolean;
    
    /** Whether the service is reachable */
    isReachable: boolean;
    
    /** Number of loaded models */
    loadedModels: number;
    
    /** Total number of available models */
    totalModels: number;
    
    /** Service version */
    version?: string;
    
    /** Last check timestamp */
    lastCheck: Date;
}

/**
 * Model loading result
 */
export interface ModelLoadResult {
    /** Whether the model was loaded successfully */
    success: boolean;
    
    /** Error message if loading failed */
    error?: string;
    
    /** Model information if loaded successfully */
    model?: FoundryLocalModel;
    
    /** Time taken to load the model */
    loadTime?: number;
}

/**
 * Language model chat information for VS Code integration
 */
export interface FoundryLanguageModelChatInformation extends vscode.LanguageModelChatInformation {
    /** Reference to the underlying Foundry Local model */
    foundryModel: FoundryLocalModel;
}
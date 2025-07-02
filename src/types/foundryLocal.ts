import * as vscode from 'vscode';

/**
 * Configuration interface for Foundry Local settings
 */
export interface FoundryLocalConfig {
    endpoint: string;
    port: number;
    apiKey?: string;
    timeout: number;
    maxRetries: number;
}

/**
 * Foundry Local model information
 * Extended from SDK's FoundryModelInfo with additional UI properties
 */
export interface FoundryLocalModel {
    id: string;
    name: string;
    alias: string;
    description?: string;
    provider: string;
    publisher: string;
    version: string;
    capabilities: ModelCapabilities;
    maxTokens?: number;
    contextLength?: number;
    modelSize: number;
    task: string;
    license: string;
    uri: string;
    promptTemplate: Record<string, string>;
    isLoaded: boolean;
    isDefault?: boolean;
}

/**
 * Model capabilities supported by Foundry Local models
 */
export interface ModelCapabilities {
    chat: boolean;
    completion: boolean;
    vision: boolean;
    toolCalling: boolean;
    streaming: boolean;
}

/**
 * Foundry Local service status
 */
export interface FoundryLocalServiceStatus {
    isRunning: boolean;
    isConnected: boolean;
    version?: string;
    modelsLoaded: number;
    lastChecked: Date;
    error?: string;
}

/**
 * Chat message for Foundry Local API
 */
export interface FoundryChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
    name?: string;
}

/**
 * Chat completion request for Foundry Local API
 */
export interface FoundryChatRequest {
    model: string;
    messages: FoundryChatMessage[];
    stream?: boolean;
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    stop?: string | string[];
}

/**
 * Chat completion response from Foundry Local API
 */
export interface FoundryChatResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: FoundryChatChoice[];
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

/**
 * Individual chat choice in the response
 */
export interface FoundryChatChoice {
    index: number;
    message: FoundryChatMessage;
    finish_reason: string | null;
}

/**
 * Streaming chat response chunk
 */
export interface FoundryChatStreamChunk {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: {
        index: number;
        delta: {
            role?: string;
            content?: string;
        };
        finish_reason: string | null;
    }[];
}

/**
 * Events emitted by the Foundry Local service
 */
export interface FoundryLocalServiceEvents {
    statusChanged: FoundryLocalServiceStatus;
    modelsUpdated: FoundryLocalModel[];
    modelLoaded: FoundryLocalModel;
    modelUnloaded: string;
    error: Error;
}

/**
 * Configuration keys for VS Code settings
 */
export const CONFIG_KEYS = {
    ENDPOINT: 'foundryLocal.endpoint',
    PORT: 'foundryLocal.port',
    API_KEY: 'foundryLocal.apiKey',
    TIMEOUT: 'foundryLocal.timeout',
    MAX_RETRIES: 'foundryLocal.maxRetries',
    DEFAULT_MODEL: 'foundryLocal.defaultModel',
    AUTO_START: 'foundryLocal.autoStart',
    LOG_LEVEL: 'foundryLocal.logLevel'
} as const;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: FoundryLocalConfig = {
    endpoint: 'http://localhost',
    port: 8000,
    timeout: 30000,
    maxRetries: 3
};

/**
 * Command identifiers for the extension
 */
export const COMMANDS = {
    REFRESH_MODELS: 'foundry-local.refreshModels',
    SELECT_MODEL: 'foundry-local.selectModel',
    START_SERVICE: 'foundry-local.startService',
    STOP_SERVICE: 'foundry-local.stopService',
    SHOW_STATUS: 'foundry-local.showStatus',
    OPEN_SETTINGS: 'foundry-local.openSettings'
} as const;
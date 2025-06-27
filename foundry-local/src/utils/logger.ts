import * as vscode from 'vscode';

/**
 * Log levels
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

/**
 * Singleton logger class for the extension
 */
export class Logger {
    private static instance: Logger;
    private outputChannel: vscode.OutputChannel;
    private logLevel: LogLevel = LogLevel.INFO;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Foundry Local');
    }

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    /**
     * Set the log level
     */
    public setLogLevel(level: LogLevel): void {
        this.logLevel = level;
    }

    /**
     * Get the current log level
     */
    public getLogLevel(): LogLevel {
        return this.logLevel;
    }

    /**
     * Log a debug message
     */
    public debug(message: string, ...args: any[]): void {
        if (this.logLevel <= LogLevel.DEBUG) {
            this.log('DEBUG', message, ...args);
        }
    }

    /**
     * Log an info message
     */
    public info(message: string, ...args: any[]): void {
        if (this.logLevel <= LogLevel.INFO) {
            this.log('INFO', message, ...args);
        }
    }

    /**
     * Log a warning message
     */
    public warn(message: string, ...args: any[]): void {
        if (this.logLevel <= LogLevel.WARN) {
            this.log('WARN', message, ...args);
        }
    }

    /**
     * Log an error message
     */
    public error(message: string, error?: Error, ...args: any[]): void {
        if (this.logLevel <= LogLevel.ERROR) {
            if (error) {
                this.log('ERROR', `${message}: ${error.message}`, error.stack, ...args);
            } else {
                this.log('ERROR', message, ...args);
            }
        }
    }

    /**
     * Show the output channel
     */
    public show(): void {
        this.outputChannel.show();
    }

    /**
     * Clear the output channel
     */
    public clear(): void {
        this.outputChannel.clear();
    }

    /**
     * Dispose the logger
     */
    public dispose(): void {
        this.outputChannel.dispose();
    }

    /**
     * Internal log method
     */
    private log(level: string, message: string, ...args: any[]): void {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level}] ${message}`;
        
        // Log to output channel
        this.outputChannel.appendLine(logMessage);
        
        // Log additional arguments if present
        if (args.length > 0) {
            for (const arg of args) {
                if (typeof arg === 'string') {
                    this.outputChannel.appendLine(`  ${arg}`);
                } else {
                    this.outputChannel.appendLine(`  ${JSON.stringify(arg, null, 2)}`);
                }
            }
        }

        // Also log to console for development
        if (level === 'ERROR') {
            console.error(logMessage, ...args);
        } else if (level === 'WARN') {
            console.warn(logMessage, ...args);
        } else if (level === 'DEBUG') {
            console.debug(logMessage, ...args);
        } else {
            console.log(logMessage, ...args);
        }
    }
}
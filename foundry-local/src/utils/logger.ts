import * as vscode from 'vscode';

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

export class Logger {
    private static instance: Logger;
    private outputChannel: vscode.OutputChannel;
    private logLevel: LogLevel = LogLevel.INFO;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Foundry Local', 'foundry-local');
    }

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    public setLogLevel(level: LogLevel): void {
        this.logLevel = level;
    }

    public debug(message: string, ...args: any[]): void {
        if (this.logLevel <= LogLevel.DEBUG) {
            this.log('DEBUG', message, ...args);
        }
    }

    public info(message: string, ...args: any[]): void {
        if (this.logLevel <= LogLevel.INFO) {
            this.log('INFO', message, ...args);
        }
    }

    public warn(message: string, ...args: any[]): void {
        if (this.logLevel <= LogLevel.WARN) {
            this.log('WARN', message, ...args);
        }
    }

    public error(message: string, error?: Error, ...args: any[]): void {
        if (this.logLevel <= LogLevel.ERROR) {
            const errorMsg = error ? `${message}: ${error.message}` : message;
            this.log('ERROR', errorMsg, ...args);
            if (error && error.stack) {
                this.outputChannel.appendLine(`Stack trace: ${error.stack}`);
            }
        }
    }

    public show(): void {
        this.outputChannel.show();
    }

    public dispose(): void {
        this.outputChannel.dispose();
    }

    private log(level: string, message: string, ...args: any[]): void {
        const timestamp = new Date().toISOString();
        const formattedMessage = args.length > 0 
            ? `${message} ${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')}`
            : message;
        
        this.outputChannel.appendLine(`[${timestamp}] [${level}] ${formattedMessage}`);
    }
}
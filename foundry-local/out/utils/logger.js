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
exports.Logger = exports.LogLevel = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Log levels
 */
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
/**
 * Singleton logger class for the extension
 */
class Logger {
    static instance;
    outputChannel;
    logLevel = LogLevel.INFO;
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Foundry Local');
    }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    /**
     * Set the log level
     */
    setLogLevel(level) {
        this.logLevel = level;
    }
    /**
     * Get the current log level
     */
    getLogLevel() {
        return this.logLevel;
    }
    /**
     * Log a debug message
     */
    debug(message, ...args) {
        if (this.logLevel <= LogLevel.DEBUG) {
            this.log('DEBUG', message, ...args);
        }
    }
    /**
     * Log an info message
     */
    info(message, ...args) {
        if (this.logLevel <= LogLevel.INFO) {
            this.log('INFO', message, ...args);
        }
    }
    /**
     * Log a warning message
     */
    warn(message, ...args) {
        if (this.logLevel <= LogLevel.WARN) {
            this.log('WARN', message, ...args);
        }
    }
    /**
     * Log an error message
     */
    error(message, error, ...args) {
        if (this.logLevel <= LogLevel.ERROR) {
            if (error) {
                this.log('ERROR', `${message}: ${error.message}`, error.stack, ...args);
            }
            else {
                this.log('ERROR', message, ...args);
            }
        }
    }
    /**
     * Show the output channel
     */
    show() {
        this.outputChannel.show();
    }
    /**
     * Clear the output channel
     */
    clear() {
        this.outputChannel.clear();
    }
    /**
     * Dispose the logger
     */
    dispose() {
        this.outputChannel.dispose();
    }
    /**
     * Internal log method
     */
    log(level, message, ...args) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level}] ${message}`;
        // Log to output channel
        this.outputChannel.appendLine(logMessage);
        // Log additional arguments if present
        if (args.length > 0) {
            for (const arg of args) {
                if (typeof arg === 'string') {
                    this.outputChannel.appendLine(`  ${arg}`);
                }
                else {
                    this.outputChannel.appendLine(`  ${JSON.stringify(arg, null, 2)}`);
                }
            }
        }
        // Also log to console for development
        if (level === 'ERROR') {
            console.error(logMessage, ...args);
        }
        else if (level === 'WARN') {
            console.warn(logMessage, ...args);
        }
        else if (level === 'DEBUG') {
            console.debug(logMessage, ...args);
        }
        else {
            console.log(logMessage, ...args);
        }
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map
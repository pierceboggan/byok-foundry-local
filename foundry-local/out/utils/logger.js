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
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    static instance;
    outputChannel;
    logLevel = LogLevel.INFO;
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Foundry Local', 'foundry-local');
    }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    setLogLevel(level) {
        this.logLevel = level;
    }
    debug(message, ...args) {
        if (this.logLevel <= LogLevel.DEBUG) {
            this.log('DEBUG', message, ...args);
        }
    }
    info(message, ...args) {
        if (this.logLevel <= LogLevel.INFO) {
            this.log('INFO', message, ...args);
        }
    }
    warn(message, ...args) {
        if (this.logLevel <= LogLevel.WARN) {
            this.log('WARN', message, ...args);
        }
    }
    error(message, error, ...args) {
        if (this.logLevel <= LogLevel.ERROR) {
            const errorMsg = error ? `${message}: ${error.message}` : message;
            this.log('ERROR', errorMsg, ...args);
            if (error && error.stack) {
                this.outputChannel.appendLine(`Stack trace: ${error.stack}`);
            }
        }
    }
    show() {
        this.outputChannel.show();
    }
    dispose() {
        this.outputChannel.dispose();
    }
    log(level, message, ...args) {
        const timestamp = new Date().toISOString();
        const formattedMessage = args.length > 0
            ? `${message} ${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')}`
            : message;
        this.outputChannel.appendLine(`[${timestamp}] [${level}] ${formattedMessage}`);
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map
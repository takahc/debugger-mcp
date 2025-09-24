import * as vscode from 'vscode';
import * as express from 'express';
import * as cors from 'cors';
import { Server } from 'http';
import { DapApiServer } from './dapApiServer';

let httpServer: Server | undefined;
let dapApiServer: DapApiServer | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Debugger MCP Extension is now active!');

    // Register commands
    let startServerCommand = vscode.commands.registerCommand('debuggerMcp.startServer', async () => {
        if (httpServer) {
            vscode.window.showWarningMessage('DAP API Server is already running');
            return;
        }

        const port = await vscode.window.showInputBox({
            prompt: 'Enter port number for DAP API server',
            value: '3001',
            validateInput: (value) => {
                const num = parseInt(value);
                if (isNaN(num) || num < 1 || num > 65535) {
                    return 'Please enter a valid port number (1-65535)';
                }
                return null;
            }
        });

        if (!port) {
            return;
        }

        try {
            await startDapApiServer(parseInt(port));
            vscode.window.showInformationMessage(`DAP API Server started on port ${port}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to start DAP API Server: ${error}`);
        }
    });

    let stopServerCommand = vscode.commands.registerCommand('debuggerMcp.stopServer', () => {
        if (!httpServer) {
            vscode.window.showWarningMessage('DAP API Server is not running');
            return;
        }

        stopDapApiServer();
        vscode.window.showInformationMessage('DAP API Server stopped');
    });

    context.subscriptions.push(startServerCommand, stopServerCommand);

    // Auto-start server if configured
    const config = vscode.workspace.getConfiguration('debuggerMcp');
    const autoStart = config.get<boolean>('autoStartServer', false);
    const defaultPort = config.get<number>('defaultPort', 3001);

    if (autoStart) {
        startDapApiServer(defaultPort).catch(error => {
            console.error('Failed to auto-start DAP API Server:', error);
        });
    }
}

export function deactivate() {
    if (httpServer) {
        stopDapApiServer();
    }
}

async function startDapApiServer(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const app = express();
        
        // Enable CORS and JSON parsing
        app.use(cors());
        app.use(express.json());

        // Initialize DAP API server
        dapApiServer = new DapApiServer();
        
        // Mount DAP API routes
        app.use('/api/dap', dapApiServer.getRouter());

        // Health check endpoint
        app.get('/health', (req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        // Start HTTP server
        httpServer = app.listen(port, (err?: Error) => {
            if (err) {
                reject(err);
            } else {
                console.log(`DAP API Server listening on port ${port}`);
                resolve();
            }
        });

        httpServer.on('error', (error) => {
            reject(error);
        });
    });
}

function stopDapApiServer(): void {
    if (httpServer) {
        httpServer.close();
        httpServer = undefined;
    }
    if (dapApiServer) {
        dapApiServer.dispose();
        dapApiServer = undefined;
    }
}
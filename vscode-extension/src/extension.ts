import * as vscode from 'vscode';
import express, { Request, Response } from 'express';
import { Server } from 'http';

let server: Server | undefined;
let app: express.Application;

export function activate(context: vscode.ExtensionContext) {
    console.log('Debugger MCP Extension is now active');

    // Create Express app
    app = express();
    app.use(express.json());

    // Register commands
    const startServerCommand = vscode.commands.registerCommand('debuggerMcp.startServer', startServer);
    const stopServerCommand = vscode.commands.registerCommand('debuggerMcp.stopServer', stopServer);

    context.subscriptions.push(startServerCommand, stopServerCommand);

    // Setup API routes
    setupRoutes();

    // Auto-start server
    startServer();
}

function setupRoutes() {
    // Health check
    app.get('/health', (req: Request, res: Response) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Get debug sessions
    app.get('/debug/sessions', async (req: Request, res: Response) => {
        try {
            const sessions = vscode.debug.activeDebugSession ? [vscode.debug.activeDebugSession] : [];
            res.json({
                sessions: sessions.map(session => ({
                    id: session.id,
                    name: session.name,
                    type: session.type,
                    workspaceFolder: session.workspaceFolder?.name
                }))
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to get debug sessions', details: String(error) });
        }
    });

    // Start debugging
    app.post('/debug/start', async (req: Request, res: Response) => {
        try {
            const { name, type, request, program, args } = req.body;
            
            const debugConfig: vscode.DebugConfiguration = {
                name: name || 'Debug Session',
                type: type || 'node',
                request: request || 'launch',
                program: program,
                args: args || []
            };

            const success = await vscode.debug.startDebugging(undefined, debugConfig);
            
            if (success) {
                res.json({ 
                    success: true, 
                    message: 'Debug session started',
                    sessionId: vscode.debug.activeDebugSession?.id 
                });
            } else {
                res.status(400).json({ error: 'Failed to start debug session' });
            }
        } catch (error) {
            res.status(500).json({ error: 'Failed to start debugging', details: String(error) });
        }
    });

    // Stop debugging
    app.post('/debug/stop', async (req: Request, res: Response) => {
        try {
            if (vscode.debug.activeDebugSession) {
                await vscode.debug.stopDebugging(vscode.debug.activeDebugSession);
                res.json({ success: true, message: 'Debug session stopped' });
            } else {
                res.status(400).json({ error: 'No active debug session' });
            }
        } catch (error) {
            res.status(500).json({ error: 'Failed to stop debugging', details: String(error) });
        }
    });

    // Set breakpoints
    app.post('/debug/breakpoints', async (req: Request, res: Response) => {
        try {
            const { file, lines } = req.body;
            
            if (!file || !lines || !Array.isArray(lines)) {
                return res.status(400).json({ error: 'Invalid request body. Required: file (string) and lines (array)' });
            }

            const uri = vscode.Uri.file(file);
            const breakpoints = lines.map((line: number) => new vscode.SourceBreakpoint(
                new vscode.Location(uri, new vscode.Position(line - 1, 0))
            ));

            vscode.debug.removeBreakpoints(vscode.debug.breakpoints.filter(bp => 
                bp instanceof vscode.SourceBreakpoint && bp.location.uri.fsPath === file
            ));
            
            vscode.debug.addBreakpoints(breakpoints);
            
            res.json({ 
                success: true, 
                message: `Set ${breakpoints.length} breakpoints in ${file}`,
                breakpoints: lines
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to set breakpoints', details: String(error) });
        }
    });

    // Debug actions (continue, step, etc.)
    app.post('/debug/action/:action', async (req: Request, res: Response) => {
        try {
            const { action } = req.params;
            const session = vscode.debug.activeDebugSession;

            if (!session) {
                return res.status(400).json({ error: 'No active debug session' });
            }

            let success = false;
            switch (action) {
                case 'continue':
                    await vscode.commands.executeCommand('workbench.action.debug.continue');
                    success = true;
                    break;
                case 'stepOver':
                    await vscode.commands.executeCommand('workbench.action.debug.stepOver');
                    success = true;
                    break;
                case 'stepInto':
                    await vscode.commands.executeCommand('workbench.action.debug.stepInto');
                    success = true;
                    break;
                case 'stepOut':
                    await vscode.commands.executeCommand('workbench.action.debug.stepOut');
                    success = true;
                    break;
                case 'pause':
                    await vscode.commands.executeCommand('workbench.action.debug.pause');
                    success = true;
                    break;
                default:
                    return res.status(400).json({ error: `Unknown action: ${action}` });
            }

            if (success) {
                res.json({ success: true, message: `Executed ${action}` });
            } else {
                res.status(500).json({ error: `Failed to execute ${action}` });
            }
        } catch (error) {
            res.status(500).json({ error: `Failed to execute debug action`, details: String(error) });
        }
    });

    // Get variables
    app.get('/debug/variables', async (req: Request, res: Response) => {
        try {
            if (!vscode.debug.activeDebugSession) {
                return res.status(400).json({ error: 'No active debug session' });
            }

            // This is a simplified implementation - in a real scenario,
            // you'd need to interact with the debug adapter protocol directly
            res.json({ 
                message: 'Variables endpoint - implementation depends on specific debugger',
                note: 'Use VSCode debug console or variables view for detailed variable inspection'
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to get variables', details: String(error) });
        }
    });
}

async function startServer() {
    if (server) {
        vscode.window.showWarningMessage('Server is already running');
        return;
    }

    const config = vscode.workspace.getConfiguration('debuggerMcp');
    const port = config.get<number>('serverPort', 3000);

    try {
        server = app.listen(port, () => {
            vscode.window.showInformationMessage(`Debugger MCP HTTP Server started on port ${port}`);
            console.log(`Server running on port ${port}`);
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to start server: ${error}`);
    }
}

async function stopServer() {
    if (!server) {
        vscode.window.showWarningMessage('Server is not running');
        return;
    }

    server.close(() => {
        server = undefined;
        vscode.window.showInformationMessage('Debugger MCP HTTP Server stopped');
        console.log('Server stopped');
    });
}

export function deactivate() {
    if (server) {
        server.close();
    }
}
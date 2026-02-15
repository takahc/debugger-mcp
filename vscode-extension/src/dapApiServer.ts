import * as vscode from 'vscode';
import { Router, Request, Response } from 'express';

interface DapSession {
    id: string;
    debugSession: vscode.DebugSession | null;
    configuration: vscode.DebugConfiguration | null;
    workspaceFolder: vscode.WorkspaceFolder | null;
}

export class DapApiServer {
    private router: Router;
    private sessions: Map<string, DapSession>;
    private nextSessionId: number = 1;

    constructor() {
        this.router = Router();
        this.sessions = new Map();
        this.setupRoutes();
    }

    getRouter(): Router {
        return this.router;
    }

    dispose(): void {
        // Stop all active debug sessions
        for (const session of this.sessions.values()) {
            if (session.debugSession) {
                vscode.debug.stopDebugging(session.debugSession);
            }
        }
        this.sessions.clear();
    }

    private setupRoutes(): void {
        // Session management
        this.router.post('/sessions', this.createSession.bind(this));
        this.router.get('/sessions', this.listSessions.bind(this));
        this.router.get('/sessions/:sessionId', this.getSession.bind(this));
        this.router.delete('/sessions/:sessionId', this.deleteSession.bind(this));

        // Debug operations
        this.router.post('/sessions/:sessionId/initialize', this.initialize.bind(this));
        this.router.post('/sessions/:sessionId/launch', this.launch.bind(this));
        this.router.post('/sessions/:sessionId/attach', this.attach.bind(this));
        this.router.post('/sessions/:sessionId/disconnect', this.disconnect.bind(this));
        this.router.post('/sessions/:sessionId/terminate', this.terminate.bind(this));

        // Execution control
        this.router.post('/sessions/:sessionId/continue', this.continue.bind(this));
        this.router.post('/sessions/:sessionId/pause', this.pause.bind(this));
        this.router.post('/sessions/:sessionId/next', this.next.bind(this));
        this.router.post('/sessions/:sessionId/stepIn', this.stepIn.bind(this));
        this.router.post('/sessions/:sessionId/stepOut', this.stepOut.bind(this));

        // Breakpoints
        this.router.post('/sessions/:sessionId/setBreakpoints', this.setBreakpoints.bind(this));
        this.router.post('/sessions/:sessionId/setFunctionBreakpoints', this.setFunctionBreakpoints.bind(this));
        this.router.post('/sessions/:sessionId/setExceptionBreakpoints', this.setExceptionBreakpoints.bind(this));

        // Variable inspection
        this.router.get('/sessions/:sessionId/threads', this.getThreads.bind(this));
        this.router.get('/sessions/:sessionId/stackTrace/:threadId', this.getStackTrace.bind(this));
        this.router.get('/sessions/:sessionId/scopes/:frameId', this.getScopes.bind(this));
        this.router.get('/sessions/:sessionId/variables/:variablesReference', this.getVariables.bind(this));

        // Evaluation
        this.router.post('/sessions/:sessionId/evaluate', this.evaluate.bind(this));

        // Debug console
        this.router.post('/sessions/:sessionId/output', this.sendOutput.bind(this));
    }

    private generateSessionId(): string {
        return `session-${this.nextSessionId++}`;
    }

    private getSessionById(sessionId: string): DapSession | null {
        return this.sessions.get(sessionId) || null;
    }

    // Session management endpoints
    private async createSession(req: Request, res: Response): Promise<void> {
        try {
            const { name, type, request, workspaceFolderUri } = req.body;
            
            const sessionId = this.generateSessionId();
            let workspaceFolder: vscode.WorkspaceFolder | null = null;

            if (workspaceFolderUri) {
                const uri = vscode.Uri.parse(workspaceFolderUri);
                workspaceFolder = vscode.workspace.getWorkspaceFolder(uri) || null;
            }

            const session: DapSession = {
                id: sessionId,
                debugSession: null,
                configuration: {
                    name: name || 'Debug Session',
                    type: type || 'node',
                    request: request || 'launch'
                },
                workspaceFolder
            };

            this.sessions.set(sessionId, session);

            res.json({
                sessionId,
                status: 'created',
                configuration: session.configuration
            });
        } catch (error) {
            res.status(500).json({ error: `Failed to create session: ${error}` });
        }
    }

    private async listSessions(req: Request, res: Response): Promise<void> {
        const sessionList = Array.from(this.sessions.entries()).map(([id, session]) => ({
            sessionId: id,
            configuration: session.configuration,
            active: session.debugSession !== null,
            workspaceFolderUri: session.workspaceFolder?.uri.toString()
        }));

        res.json({ sessions: sessionList });
    }

    private async getSession(req: Request, res: Response): Promise<void> {
        const { sessionId } = req.params;
        const session = this.getSessionById(sessionId);

        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        res.json({
            sessionId,
            configuration: session.configuration,
            active: session.debugSession !== null,
            workspaceFolderUri: session.workspaceFolder?.uri.toString()
        });
    }

    private async deleteSession(req: Request, res: Response): Promise<void> {
        const { sessionId } = req.params;
        const session = this.getSessionById(sessionId);

        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        // Stop debug session if active
        if (session.debugSession) {
            await vscode.debug.stopDebugging(session.debugSession);
        }

        this.sessions.delete(sessionId);
        res.json({ status: 'deleted' });
    }

    // Debug operations
    private async initialize(req: Request, res: Response): Promise<void> {
        const { sessionId } = req.params;
        const session = this.getSessionById(sessionId);

        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        // In VSCode, initialization happens automatically when starting debug session
        res.json({
            status: 'initialized',
            capabilities: {
                supportsConfigurationDoneRequest: true,
                supportsFunctionBreakpoints: true,
                supportsConditionalBreakpoints: true,
                supportsHitConditionalBreakpoints: true,
                supportsEvaluateForHovers: true,
                supportsStepBack: false,
                supportsSetVariable: true,
                supportsRestartFrame: false,
                supportsGotoTargetsRequest: false,
                supportsStepInTargetsRequest: false,
                supportsCompletionsRequest: true,
                supportsModulesRequest: false,
                supportsRestartRequest: true,
                supportsExceptionOptions: true,
                supportsValueFormattingOptions: true,
                supportsExceptionInfoRequest: true,
                supportTerminateDebuggee: true,
                supportSuspendDebuggee: true,
                supportsDelayedStackTraceLoading: true,
                supportsLoadedSourcesRequest: false,
                supportsLogPoints: true,
                supportsTerminateThreadsRequest: false,
                supportsSetExpression: false,
                supportsTerminateRequest: true,
                supportsDataBreakpoints: false,
                supportsReadMemoryRequest: false,
                supportsWriteMemoryRequest: false,
                supportsDisassembleRequest: false
            }
        });
    }

    private async launch(req: Request, res: Response): Promise<void> {
        const { sessionId } = req.params;
        const session = this.getSessionById(sessionId);

        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        try {
            const config = { ...session.configuration, ...req.body };
            config.request = 'launch';

            const started = await vscode.debug.startDebugging(
                session.workspaceFolder || undefined,
                config
            );

            if (started) {
                // Find the active debug session
                session.debugSession = vscode.debug.activeDebugSession || null;
                res.json({ status: 'launched' });
            } else {
                res.status(500).json({ error: 'Failed to start debug session' });
            }
        } catch (error) {
            res.status(500).json({ error: `Launch failed: ${error}` });
        }
    }

    private async attach(req: Request, res: Response): Promise<void> {
        const { sessionId } = req.params;
        const session = this.getSessionById(sessionId);

        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        try {
            const config = { ...session.configuration, ...req.body };
            config.request = 'attach';

            const started = await vscode.debug.startDebugging(
                session.workspaceFolder || undefined,
                config
            );

            if (started) {
                session.debugSession = vscode.debug.activeDebugSession || null;
                res.json({ status: 'attached' });
            } else {
                res.status(500).json({ error: 'Failed to attach to debug target' });
            }
        } catch (error) {
            res.status(500).json({ error: `Attach failed: ${error}` });
        }
    }

    private async disconnect(req: Request, res: Response): Promise<void> {
        const { sessionId } = req.params;
        const session = this.getSessionById(sessionId);

        if (!session || !session.debugSession) {
            res.status(404).json({ error: 'Session not found or not active' });
            return;
        }

        try {
            await vscode.debug.stopDebugging(session.debugSession);
            session.debugSession = null;
            res.json({ status: 'disconnected' });
        } catch (error) {
            res.status(500).json({ error: `Disconnect failed: ${error}` });
        }
    }

    private async terminate(req: Request, res: Response): Promise<void> {
        const { sessionId } = req.params;
        const session = this.getSessionById(sessionId);

        if (!session || !session.debugSession) {
            res.status(404).json({ error: 'Session not found or not active' });
            return;
        }

        try {
            await vscode.debug.stopDebugging(session.debugSession);
            session.debugSession = null;
            res.json({ status: 'terminated' });
        } catch (error) {
            res.status(500).json({ error: `Terminate failed: ${error}` });
        }
    }

    // Execution control endpoints
    private async continue(req: Request, res: Response): Promise<void> {
        const { sessionId } = req.params;
        const session = this.getSessionById(sessionId);

        if (!session || !session.debugSession) {
            res.status(404).json({ error: 'Session not found or not active' });
            return;
        }

        try {
            await vscode.commands.executeCommand('workbench.action.debug.continue');
            res.json({ status: 'continued' });
        } catch (error) {
            res.status(500).json({ error: `Continue failed: ${error}` });
        }
    }

    private async pause(req: Request, res: Response): Promise<void> {
        const { sessionId } = req.params;
        const session = this.getSessionById(sessionId);

        if (!session || !session.debugSession) {
            res.status(404).json({ error: 'Session not found or not active' });
            return;
        }

        try {
            await vscode.commands.executeCommand('workbench.action.debug.pause');
            res.json({ status: 'paused' });
        } catch (error) {
            res.status(500).json({ error: `Pause failed: ${error}` });
        }
    }

    private async next(req: Request, res: Response): Promise<void> {
        const { sessionId } = req.params;
        const session = this.getSessionById(sessionId);

        if (!session || !session.debugSession) {
            res.status(404).json({ error: 'Session not found or not active' });
            return;
        }

        try {
            await vscode.commands.executeCommand('workbench.action.debug.stepOver');
            res.json({ status: 'stepped' });
        } catch (error) {
            res.status(500).json({ error: `Step over failed: ${error}` });
        }
    }

    private async stepIn(req: Request, res: Response): Promise<void> {
        const { sessionId } = req.params;
        const session = this.getSessionById(sessionId);

        if (!session || !session.debugSession) {
            res.status(404).json({ error: 'Session not found or not active' });
            return;
        }

        try {
            await vscode.commands.executeCommand('workbench.action.debug.stepInto');
            res.json({ status: 'stepped' });
        } catch (error) {
            res.status(500).json({ error: `Step into failed: ${error}` });
        }
    }

    private async stepOut(req: Request, res: Response): Promise<void> {
        const { sessionId } = req.params;
        const session = this.getSessionById(sessionId);

        if (!session || !session.debugSession) {
            res.status(404).json({ error: 'Session not found or not active' });
            return;
        }

        try {
            await vscode.commands.executeCommand('workbench.action.debug.stepOut');
            res.json({ status: 'stepped' });
        } catch (error) {
            res.status(500).json({ error: `Step out failed: ${error}` });
        }
    }

    // Breakpoint endpoints
    private async setBreakpoints(req: Request, res: Response): Promise<void> {
        const { sessionId } = req.params;
        const session = this.getSessionById(sessionId);

        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        try {
            const { source, breakpoints = [] } = req.body;
            
            if (!source || !source.path) {
                res.status(400).json({ error: 'Source path is required' });
                return;
            }

            const uri = vscode.Uri.file(source.path);
            const vscodeBreakpoints = breakpoints.map((bp: any) => 
                new vscode.SourceBreakpoint(
                    new vscode.Location(uri, new vscode.Position(bp.line - 1, bp.column || 0)),
                    bp.condition,
                    bp.hitCondition,
                    bp.logMessage
                )
            );

            // Remove existing breakpoints for this file
            const existingBreakpoints = vscode.debug.breakpoints.filter(bp => 
                bp instanceof vscode.SourceBreakpoint && bp.location.uri.toString() === uri.toString()
            );
            vscode.debug.removeBreakpoints(existingBreakpoints);

            // Add new breakpoints
            vscode.debug.addBreakpoints(vscodeBreakpoints);

            res.json({
                breakpoints: vscodeBreakpoints.map((bp: vscode.SourceBreakpoint, index: number) => ({
                    id: index,
                    verified: true,
                    line: bp.location.range.start.line + 1,
                    column: bp.location.range.start.character,
                    source: { path: source.path }
                }))
            });
        } catch (error) {
            res.status(500).json({ error: `Set breakpoints failed: ${error}` });
        }
    }

    private async setFunctionBreakpoints(req: Request, res: Response): Promise<void> {
        const { sessionId } = req.params;
        const session = this.getSessionById(sessionId);

        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        try {
            const { breakpoints = [] } = req.body;
            
            const vscodeBreakpoints = breakpoints.map((bp: any) => 
                new vscode.FunctionBreakpoint(bp.name, bp.condition, bp.hitCondition)
            );

            // Remove existing function breakpoints
            const existingBreakpoints = vscode.debug.breakpoints.filter(bp => 
                bp instanceof vscode.FunctionBreakpoint
            );
            vscode.debug.removeBreakpoints(existingBreakpoints);

            // Add new function breakpoints
            vscode.debug.addBreakpoints(vscodeBreakpoints);

            res.json({
                breakpoints: vscodeBreakpoints.map((bp: vscode.FunctionBreakpoint, index: number) => ({
                    id: index,
                    verified: true,
                    name: bp.functionName
                }))
            });
        } catch (error) {
            res.status(500).json({ error: `Set function breakpoints failed: ${error}` });
        }
    }

    private async setExceptionBreakpoints(req: Request, res: Response): Promise<void> {
        const { sessionId } = req.params;
        const session = this.getSessionById(sessionId);

        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        // Exception breakpoints are typically handled by the debug adapter
        // VSCode doesn't expose direct API for this, so we'll return success
        res.json({ status: 'set' });
    }

    // Variable inspection endpoints
    private async getThreads(req: Request, res: Response): Promise<void> {
        const { sessionId } = req.params;
        const session = this.getSessionById(sessionId);

        if (!session || !session.debugSession) {
            res.status(404).json({ error: 'Session not found or not active' });
            return;
        }

        try {
            // Use DAP customRequest to get threads
            const response = await session.debugSession.customRequest('threads');
            res.json(response);
        } catch (error) {
            res.status(500).json({ error: `Get threads failed: ${error}` });
        }
    }

    private async getStackTrace(req: Request, res: Response): Promise<void> {
        const { sessionId, threadId } = req.params;
        const session = this.getSessionById(sessionId);

        if (!session || !session.debugSession) {
            res.status(404).json({ error: 'Session not found or not active' });
            return;
        }

        try {
            // Use DAP customRequest to get stack trace
            const response = await session.debugSession.customRequest('stackTrace', {
                threadId: parseInt(threadId),
                startFrame: 0,
                levels: 20
            });
            res.json(response);
        } catch (error) {
            res.status(500).json({ error: `Get stack trace failed: ${error}` });
        }
    }

    private async getScopes(req: Request, res: Response): Promise<void> {
        const { sessionId, frameId } = req.params;
        const session = this.getSessionById(sessionId);

        if (!session || !session.debugSession) {
            res.status(404).json({ error: 'Session not found or not active' });
            return;
        }

        try {
            // Use DAP customRequest to get scopes
            const response = await session.debugSession.customRequest('scopes', {
                frameId: parseInt(frameId)
            });
            res.json(response);
        } catch (error) {
            res.status(500).json({ error: `Get scopes failed: ${error}` });
        }
    }

    private async getVariables(req: Request, res: Response): Promise<void> {
        const { sessionId, variablesReference } = req.params;
        const session = this.getSessionById(sessionId);

        if (!session || !session.debugSession) {
            res.status(404).json({ error: 'Session not found or not active' });
            return;
        }

        try {
            // Use DAP customRequest to get variables
            const response = await session.debugSession.customRequest('variables', {
                variablesReference: parseInt(variablesReference)
            });
            res.json(response);
        } catch (error) {
            res.status(500).json({ error: `Get variables failed: ${error}` });
        }
    }

    private async evaluate(req: Request, res: Response): Promise<void> {
        const { sessionId } = req.params;
        const session = this.getSessionById(sessionId);

        if (!session || !session.debugSession) {
            res.status(404).json({ error: 'Session not found or not active' });
            return;
        }

        const { expression, frameId, context } = req.body;

        if (!expression) {
            res.status(400).json({ error: 'Expression is required' });
            return;
        }

        try {
            // Use DAP customRequest to evaluate expression
            const response = await session.debugSession.customRequest('evaluate', {
                expression,
                frameId: frameId ? parseInt(frameId) : undefined,
                context: context || 'watch'
            });
            res.json(response);
        } catch (error) {
            res.status(500).json({ error: `Evaluation failed: ${error}` });
        }
    }

    private async sendOutput(req: Request, res: Response): Promise<void> {
        const { sessionId } = req.params;
        const session = this.getSessionById(sessionId);

        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }

        const { output, category = 'console' } = req.body;

        if (!output) {
            res.status(400).json({ error: 'Output is required' });
            return;
        }

        try {
            // Send to debug console if session is active
            if (session.debugSession) {
                vscode.debug.activeDebugConsole.appendLine(output);
            }
            res.json({ status: 'sent' });
        } catch (error) {
            res.status(500).json({ error: `Send output failed: ${error}` });
        }
    }
}
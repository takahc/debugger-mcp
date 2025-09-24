#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

const API_BASE_URL = process.env.DEBUGGER_API_URL || 'http://localhost:3000';

class DebuggerMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'debugger-mcp-server',
        version: '0.0.1',
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'debug_start',
          description: 'Start a new debug session',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Debug session name' },
              type: { type: 'string', description: 'Debugger type (e.g., node, python)' },
              request: { type: 'string', description: 'Request type (launch/attach)', default: 'launch' },
              program: { type: 'string', description: 'Program to debug' },
              args: { type: 'array', items: { type: 'string' }, description: 'Program arguments' }
            },
            required: ['program']
          }
        },
        {
          name: 'debug_stop',
          description: 'Stop the current debug session',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'debug_continue',
          description: 'Continue execution in the debugger',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'debug_step_over',
          description: 'Step over the current line',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'debug_step_into',
          description: 'Step into the current function/method',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'debug_step_out',
          description: 'Step out of the current function/method',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'debug_pause',
          description: 'Pause execution in the debugger',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'debug_set_breakpoints',
          description: 'Set breakpoints in a file',
          inputSchema: {
            type: 'object',
            properties: {
              file: { type: 'string', description: 'File path' },
              lines: { type: 'array', items: { type: 'number' }, description: 'Line numbers for breakpoints' }
            },
            required: ['file', 'lines']
          }
        },
        {
          name: 'debug_get_sessions',
          description: 'Get information about active debug sessions',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'debug_get_variables',
          description: 'Get variables in the current debug context',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'debug_start':
            return await this.startDebugging(args);
          case 'debug_stop':
            return await this.stopDebugging();
          case 'debug_continue':
            return await this.debugAction('continue');
          case 'debug_step_over':
            return await this.debugAction('stepOver');
          case 'debug_step_into':
            return await this.debugAction('stepInto');
          case 'debug_step_out':
            return await this.debugAction('stepOut');
          case 'debug_pause':
            return await this.debugAction('pause');
          case 'debug_set_breakpoints':
            return await this.setBreakpoints(args);
          case 'debug_get_sessions':
            return await this.getSessions();
          case 'debug_get_variables':
            return await this.getVariables();
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${errorMessage}`
            }
          ]
        };
      }
    });
  }

  private async makeApiCall(method: string, endpoint: string, data?: any) {
    const url = `${API_BASE_URL}${endpoint}`;
    try {
      const response = await axios({
        method,
        url,
        data,
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('VSCode extension HTTP server is not running. Please start the extension first.');
        }
        throw new Error(`API call failed: ${error.response?.data?.error || error.message}`);
      }
      throw error;
    }
  }

  private async startDebugging(args: any) {
    const result = await this.makeApiCall('POST', '/debug/start', args);
    return {
      content: [
        {
          type: 'text',
          text: `Debug session started successfully. Session ID: ${result.sessionId || 'N/A'}`
        }
      ]
    };
  }

  private async stopDebugging() {
    const result = await this.makeApiCall('POST', '/debug/stop');
    return {
      content: [
        {
          type: 'text',
          text: 'Debug session stopped successfully'
        }
      ]
    };
  }

  private async debugAction(action: string) {
    const result = await this.makeApiCall('POST', `/debug/action/${action}`);
    return {
      content: [
        {
          type: 'text',
          text: `Debug action '${action}' executed successfully`
        }
      ]
    };
  }

  private async setBreakpoints(args: any) {
    const { file, lines } = args;
    const result = await this.makeApiCall('POST', '/debug/breakpoints', { file, lines });
    return {
      content: [
        {
          type: 'text',
          text: `Set ${lines.length} breakpoints in ${file} at lines: ${lines.join(', ')}`
        }
      ]
    };
  }

  private async getSessions() {
    const result = await this.makeApiCall('GET', '/debug/sessions');
    const sessionsText = result.sessions.length > 0 
      ? result.sessions.map((s: any) => `- ${s.name} (${s.type})`).join('\n')
      : 'No active debug sessions';
    
    return {
      content: [
        {
          type: 'text',
          text: `Active debug sessions:\n${sessionsText}`
        }
      ]
    };
  }

  private async getVariables() {
    const result = await this.makeApiCall('GET', '/debug/variables');
    return {
      content: [
        {
          type: 'text',
          text: result.message || 'Variables information retrieved'
        }
      ]
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Debugger MCP server running on stdio');
  }
}

const server = new DebuggerMCPServer();
server.run().catch(console.error);
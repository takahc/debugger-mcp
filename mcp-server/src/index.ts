#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  CallToolResult,
  TextContent,
  ImageContent,
  EmbeddedResource
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import axios from 'axios';

// Define the DAP API client
class DapApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/health`);
      return response.status === 200;
    } catch {
      return false;
    }
  }

  // Session management
  async createSession(config: any): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/api/dap/sessions`, config);
    return response.data;
  }

  async listSessions(): Promise<any> {
    const response = await axios.get(`${this.baseUrl}/api/dap/sessions`);
    return response.data;
  }

  async getSession(sessionId: string): Promise<any> {
    const response = await axios.get(`${this.baseUrl}/api/dap/sessions/${sessionId}`);
    return response.data;
  }

  async deleteSession(sessionId: string): Promise<any> {
    const response = await axios.delete(`${this.baseUrl}/api/dap/sessions/${sessionId}`);
    return response.data;
  }

  // Debug operations
  async initialize(sessionId: string): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/api/dap/sessions/${sessionId}/initialize`);
    return response.data;
  }

  async launch(sessionId: string, config: any): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/api/dap/sessions/${sessionId}/launch`, config);
    return response.data;
  }

  async attach(sessionId: string, config: any): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/api/dap/sessions/${sessionId}/attach`, config);
    return response.data;
  }

  async disconnect(sessionId: string): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/api/dap/sessions/${sessionId}/disconnect`);
    return response.data;
  }

  async terminate(sessionId: string): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/api/dap/sessions/${sessionId}/terminate`);
    return response.data;
  }

  // Execution control
  async continue(sessionId: string): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/api/dap/sessions/${sessionId}/continue`);
    return response.data;
  }

  async pause(sessionId: string): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/api/dap/sessions/${sessionId}/pause`);
    return response.data;
  }

  async next(sessionId: string): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/api/dap/sessions/${sessionId}/next`);
    return response.data;
  }

  async stepIn(sessionId: string): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/api/dap/sessions/${sessionId}/stepIn`);
    return response.data;
  }

  async stepOut(sessionId: string): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/api/dap/sessions/${sessionId}/stepOut`);
    return response.data;
  }

  // Breakpoints
  async setBreakpoints(sessionId: string, source: any, breakpoints: any[]): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/api/dap/sessions/${sessionId}/setBreakpoints`, {
      source,
      breakpoints
    });
    return response.data;
  }

  async setFunctionBreakpoints(sessionId: string, breakpoints: any[]): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/api/dap/sessions/${sessionId}/setFunctionBreakpoints`, {
      breakpoints
    });
    return response.data;
  }

  async setExceptionBreakpoints(sessionId: string, filters: string[]): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/api/dap/sessions/${sessionId}/setExceptionBreakpoints`, {
      filters
    });
    return response.data;
  }

  // Variable inspection
  async getThreads(sessionId: string): Promise<any> {
    const response = await axios.get(`${this.baseUrl}/api/dap/sessions/${sessionId}/threads`);
    return response.data;
  }

  async getStackTrace(sessionId: string, threadId: number): Promise<any> {
    const response = await axios.get(`${this.baseUrl}/api/dap/sessions/${sessionId}/stackTrace/${threadId}`);
    return response.data;
  }

  async getScopes(sessionId: string, frameId: number): Promise<any> {
    const response = await axios.get(`${this.baseUrl}/api/dap/sessions/${sessionId}/scopes/${frameId}`);
    return response.data;
  }

  async getVariables(sessionId: string, variablesReference: number): Promise<any> {
    const response = await axios.get(`${this.baseUrl}/api/dap/sessions/${sessionId}/variables/${variablesReference}`);
    return response.data;
  }

  async evaluate(sessionId: string, expression: string, frameId?: number, context?: string): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/api/dap/sessions/${sessionId}/evaluate`, {
      expression,
      frameId,
      context
    });
    return response.data;
  }

  async sendOutput(sessionId: string, output: string, category?: string): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/api/dap/sessions/${sessionId}/output`, {
      output,
      category
    });
    return response.data;
  }
}

// Input validation schemas
const SessionConfigSchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  request: z.string().optional(),
  workspaceFolderUri: z.string().optional()
});

const LaunchConfigSchema = z.object({
  sessionId: z.string(),
  program: z.string().optional(),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
  runtimeExecutable: z.string().optional(),
  runtimeArgs: z.array(z.string()).optional()
});

const BreakpointsSchema = z.object({
  sessionId: z.string(),
  source: z.object({
    path: z.string(),
    name: z.string().optional()
  }),
  breakpoints: z.array(z.object({
    line: z.number(),
    column: z.number().optional(),
    condition: z.string().optional(),
    hitCondition: z.string().optional(),
    logMessage: z.string().optional()
  }))
});

// Create MCP server
const server = new Server(
  {
    name: 'debugger-mcp-server',
    version: '0.1.0',
  }
);

// Initialize DAP API client
const dapClient = new DapApiClient();

// Define available tools
const tools: Tool[] = [
  // Session management tools
  {
    name: 'debug_create_session',
    description: 'Create a new debug session',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name for the debug session' },
        type: { type: 'string', description: 'Debug adapter type (e.g., node, python)' },
        request: { type: 'string', description: 'Request type: launch or attach' },
        workspaceFolderUri: { type: 'string', description: 'Workspace folder URI' }
      }
    }
  },
  {
    name: 'debug_list_sessions',
    description: 'List all debug sessions',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'debug_get_session',
    description: 'Get information about a specific debug session',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' }
      },
      required: ['sessionId']
    }
  },
  {
    name: 'debug_delete_session',
    description: 'Delete a debug session',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' }
      },
      required: ['sessionId']
    }
  },

  // Debug operations
  {
    name: 'debug_initialize',
    description: 'Initialize a debug session',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' }
      },
      required: ['sessionId']
    }
  },
  {
    name: 'debug_launch',
    description: 'Launch a debug session with specified configuration',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        program: { type: 'string', description: 'Program to debug' },
        args: { type: 'array', items: { type: 'string' }, description: 'Program arguments' },
        cwd: { type: 'string', description: 'Working directory' },
        env: { type: 'object', description: 'Environment variables' },
        runtimeExecutable: { type: 'string', description: 'Runtime executable' },
        runtimeArgs: { type: 'array', items: { type: 'string' }, description: 'Runtime arguments' }
      },
      required: ['sessionId']
    }
  },
  {
    name: 'debug_attach',
    description: 'Attach to a running process for debugging',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        processId: { type: 'number', description: 'Process ID to attach to' },
        port: { type: 'number', description: 'Port to attach to' },
        address: { type: 'string', description: 'Address to attach to' }
      },
      required: ['sessionId']
    }
  },
  {
    name: 'debug_disconnect',
    description: 'Disconnect from debug session',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' }
      },
      required: ['sessionId']
    }
  },
  {
    name: 'debug_terminate',
    description: 'Terminate debug session',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' }
      },
      required: ['sessionId']
    }
  },

  // Execution control
  {
    name: 'debug_continue',
    description: 'Continue execution',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' }
      },
      required: ['sessionId']
    }
  },
  {
    name: 'debug_pause',
    description: 'Pause execution',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' }
      },
      required: ['sessionId']
    }
  },
  {
    name: 'debug_step_over',
    description: 'Step over current line',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' }
      },
      required: ['sessionId']
    }
  },
  {
    name: 'debug_step_into',
    description: 'Step into function call',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' }
      },
      required: ['sessionId']
    }
  },
  {
    name: 'debug_step_out',
    description: 'Step out of current function',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' }
      },
      required: ['sessionId']
    }
  },

  // Breakpoints
  {
    name: 'debug_set_breakpoints',
    description: 'Set breakpoints in a source file',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        source: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Source file path' },
            name: { type: 'string', description: 'Source file name' }
          },
          required: ['path']
        },
        breakpoints: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              line: { type: 'number', description: 'Line number (1-based)' },
              column: { type: 'number', description: 'Column number (0-based)' },
              condition: { type: 'string', description: 'Breakpoint condition' },
              hitCondition: { type: 'string', description: 'Hit condition' },
              logMessage: { type: 'string', description: 'Log message' }
            },
            required: ['line']
          }
        }
      },
      required: ['sessionId', 'source', 'breakpoints']
    }
  },
  {
    name: 'debug_set_function_breakpoints',
    description: 'Set function breakpoints',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        breakpoints: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Function name' },
              condition: { type: 'string', description: 'Breakpoint condition' },
              hitCondition: { type: 'string', description: 'Hit condition' }
            },
            required: ['name']
          }
        }
      },
      required: ['sessionId', 'breakpoints']
    }
  },
  {
    name: 'debug_set_exception_breakpoints',
    description: 'Set exception breakpoints',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        filters: { type: 'array', items: { type: 'string' }, description: 'Exception filters' }
      },
      required: ['sessionId', 'filters']
    }
  },

  // Variable inspection
  {
    name: 'debug_get_threads',
    description: 'Get list of threads',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' }
      },
      required: ['sessionId']
    }
  },
  {
    name: 'debug_get_stack_trace',
    description: 'Get stack trace for a thread',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        threadId: { type: 'number', description: 'Thread ID' }
      },
      required: ['sessionId', 'threadId']
    }
  },
  {
    name: 'debug_get_scopes',
    description: 'Get scopes for a stack frame',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        frameId: { type: 'number', description: 'Frame ID' }
      },
      required: ['sessionId', 'frameId']
    }
  },
  {
    name: 'debug_get_variables',
    description: 'Get variables for a scope',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        variablesReference: { type: 'number', description: 'Variables reference' }
      },
      required: ['sessionId', 'variablesReference']
    }
  },
  {
    name: 'debug_evaluate',
    description: 'Evaluate expression in debug context',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        expression: { type: 'string', description: 'Expression to evaluate' },
        frameId: { type: 'number', description: 'Frame ID for context' },
        context: { type: 'string', description: 'Evaluation context' }
      },
      required: ['sessionId', 'expression']
    }
  },

  // Debug console
  {
    name: 'debug_send_output',
    description: 'Send output to debug console',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID' },
        output: { type: 'string', description: 'Output text' },
        category: { type: 'string', description: 'Output category (console, stdout, stderr)' }
      },
      required: ['sessionId', 'output']
    }
  },

  // Health check
  {
    name: 'debug_health_check',
    description: 'Check if DAP API server is running',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let result: any;

    switch (name) {
      // Session management
      case 'debug_create_session':
        result = await dapClient.createSession(args);
        break;

      case 'debug_list_sessions':
        result = await dapClient.listSessions();
        break;

      case 'debug_get_session':
        result = await dapClient.getSession(args.sessionId as string);
        break;

      case 'debug_delete_session':
        result = await dapClient.deleteSession(args.sessionId as string);
        break;

      // Debug operations
      case 'debug_initialize':
        result = await dapClient.initialize(args.sessionId as string);
        break;

      case 'debug_launch':
        result = await dapClient.launch(args.sessionId as string, args);
        break;

      case 'debug_attach':
        result = await dapClient.attach(args.sessionId as string, args);
        break;

      case 'debug_disconnect':
        result = await dapClient.disconnect(args.sessionId as string);
        break;

      case 'debug_terminate':
        result = await dapClient.terminate(args.sessionId as string);
        break;

      // Execution control
      case 'debug_continue':
        result = await dapClient.continue(args.sessionId as string);
        break;

      case 'debug_pause':
        result = await dapClient.pause(args.sessionId as string);
        break;

      case 'debug_step_over':
        result = await dapClient.next(args.sessionId as string);
        break;

      case 'debug_step_into':
        result = await dapClient.stepIn(args.sessionId as string);
        break;

      case 'debug_step_out':
        result = await dapClient.stepOut(args.sessionId as string);
        break;

      // Breakpoints
      case 'debug_set_breakpoints':
        result = await dapClient.setBreakpoints(args.sessionId as string, args.source, args.breakpoints as any[]);
        break;

      case 'debug_set_function_breakpoints':
        result = await dapClient.setFunctionBreakpoints(args.sessionId as string, args.breakpoints as any[]);
        break;

      case 'debug_set_exception_breakpoints':
        result = await dapClient.setExceptionBreakpoints(args.sessionId as string, args.filters as string[]);
        break;

      // Variable inspection
      case 'debug_get_threads':
        result = await dapClient.getThreads(args.sessionId as string);
        break;

      case 'debug_get_stack_trace':
        result = await dapClient.getStackTrace(args.sessionId as string, args.threadId as number);
        break;

      case 'debug_get_scopes':
        result = await dapClient.getScopes(args.sessionId as string, args.frameId as number);
        break;

      case 'debug_get_variables':
        result = await dapClient.getVariables(args.sessionId as string, args.variablesReference as number);
        break;

      case 'debug_evaluate':
        result = await dapClient.evaluate(args.sessionId as string, args.expression as string, args.frameId as number, args.context as string);
        break;

      // Debug console
      case 'debug_send_output':
        result = await dapClient.sendOutput(args.sessionId as string, args.output as string, args.category as string);
        break;

      // Health check
      case 'debug_health_check':
        const isHealthy = await dapClient.healthCheck();
        result = { healthy: isHealthy, message: isHealthy ? 'DAP API server is running' : 'DAP API server is not accessible' };
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        } as TextContent
      ]
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`
        } as TextContent
      ],
      isError: true
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Debugger MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
# debugger-mcp
VSCode Extension for debugging + MCP

A comprehensive debugging solution that combines VSCode Extension capabilities with Model Context Protocol (MCP) to provide AI-powered debugging tools. This project implements the Debug Adapter Protocol (DAP) specification through HTTP APIs, enabling AI assistants to perform debugging operations.

## Architecture

The project consists of two main components:

1. **VSCode Extension** (`vscode-extension/`): Provides HTTP API endpoints for DAP operations
2. **MCP Server** (`mcp-server/`): Implements MCP protocol and uses the HTTP API to provide debugging tools to AI

## Features

### VSCode Extension
- HTTP API server that exposes DAP operations
- Session management for multiple debug sessions
- Complete DAP specification implementation including:
  - Session initialization and lifecycle management
  - Launch and attach operations
  - Execution control (continue, pause, step operations)
  - Breakpoint management (source, function, exception breakpoints)
  - Variable inspection and evaluation
  - Debug console integration

### MCP Server
- Full MCP protocol implementation
- 21 debugging tools available to AI assistants:
  - Session management tools
  - Debug operations (launch, attach, disconnect, terminate)
  - Execution control tools (continue, pause, step over/into/out)
  - Breakpoint tools (source, function, exception breakpoints)
  - Variable inspection tools (threads, stack trace, scopes, variables)
  - Expression evaluation
  - Debug console output
  - Health checking

## Installation

### VSCode Extension

1. Navigate to the VSCode extension directory:
```bash
cd vscode-extension
```

2. Install dependencies:
```bash
npm install
```

3. Compile TypeScript:
```bash
npm run compile
```

4. Install the extension in VSCode:
   - Open VSCode
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
   - Type "Extensions: Install from VSIX"
   - Select the generated `.vsix` file (if available) or use Developer mode

### MCP Server

1. Navigate to the MCP server directory:
```bash
cd mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Build the server:
```bash
npm run build
```

## Usage

### Starting the VSCode Extension

1. Open VSCode
2. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
3. Run the command "Start Debugger MCP Server"
4. Enter the port number (default: 3001)

The HTTP API will be available at `http://localhost:3001/api/dap`

### Using with GitHub Copilot in VSCode

To enable GitHub Copilot to use this MCP server for debugging operations:

1. **Start the VSCode Extension** (as described above)
2. **Configure MCP in VSCode**: Create or update `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "debugger-mcp": {
      "command": "node",
      "args": [
        "./mcp-server/dist/index.js"
      ],
      "env": {
        "DAP_API_URL": "http://localhost:3001"
      }
    }
  }
}
```

3. **Restart VSCode** to load the MCP configuration
4. **GitHub Copilot** will now have access to 21 debugging tools including:
   - Session management (create, list, delete debug sessions)
   - Debug operations (launch, attach, disconnect, terminate)
   - Execution control (continue, pause, step over/into/out)
   - Breakpoint management (set source/function/exception breakpoints)
   - Variable inspection (get threads, stack traces, scopes, variables)
   - Expression evaluation and debug console output

### Using the MCP Server with Other AI Assistants

The MCP server can be used with any MCP-compatible AI assistant. Configure your AI assistant to use the MCP server:

```bash
./mcp-server/dist/index.js
```

### Available Tools

The following debugging tools are available to AI assistants:

#### Session Management
- `debug_create_session`: Create a new debug session
- `debug_list_sessions`: List all debug sessions
- `debug_get_session`: Get session information
- `debug_delete_session`: Delete a debug session

#### Debug Operations
- `debug_initialize`: Initialize debug session
- `debug_launch`: Launch debug session
- `debug_attach`: Attach to running process
- `debug_disconnect`: Disconnect from debug session
- `debug_terminate`: Terminate debug session

#### Execution Control
- `debug_continue`: Continue execution
- `debug_pause`: Pause execution
- `debug_step_over`: Step over current line
- `debug_step_into`: Step into function call
- `debug_step_out`: Step out of current function

#### Breakpoints
- `debug_set_breakpoints`: Set source breakpoints
- `debug_set_function_breakpoints`: Set function breakpoints
- `debug_set_exception_breakpoints`: Set exception breakpoints

#### Variable Inspection
- `debug_get_threads`: Get thread list
- `debug_get_stack_trace`: Get stack trace
- `debug_get_scopes`: Get variable scopes
- `debug_get_variables`: Get variables in scope
- `debug_evaluate`: Evaluate expressions

#### Debug Console
- `debug_send_output`: Send output to debug console

#### Health Check
- `debug_health_check`: Check if DAP API server is running

## API Reference

### HTTP API Endpoints

The VSCode extension provides the following HTTP API endpoints:

#### Session Management
- `POST /api/dap/sessions` - Create session
- `GET /api/dap/sessions` - List sessions
- `GET /api/dap/sessions/:sessionId` - Get session
- `DELETE /api/dap/sessions/:sessionId` - Delete session

#### Debug Operations
- `POST /api/dap/sessions/:sessionId/initialize` - Initialize
- `POST /api/dap/sessions/:sessionId/launch` - Launch
- `POST /api/dap/sessions/:sessionId/attach` - Attach
- `POST /api/dap/sessions/:sessionId/disconnect` - Disconnect
- `POST /api/dap/sessions/:sessionId/terminate` - Terminate

#### Execution Control
- `POST /api/dap/sessions/:sessionId/continue` - Continue
- `POST /api/dap/sessions/:sessionId/pause` - Pause
- `POST /api/dap/sessions/:sessionId/next` - Step over
- `POST /api/dap/sessions/:sessionId/stepIn` - Step into
- `POST /api/dap/sessions/:sessionId/stepOut` - Step out

#### Breakpoints
- `POST /api/dap/sessions/:sessionId/setBreakpoints` - Set breakpoints
- `POST /api/dap/sessions/:sessionId/setFunctionBreakpoints` - Set function breakpoints
- `POST /api/dap/sessions/:sessionId/setExceptionBreakpoints` - Set exception breakpoints

#### Variable Inspection
- `GET /api/dap/sessions/:sessionId/threads` - Get threads
- `GET /api/dap/sessions/:sessionId/stackTrace/:threadId` - Get stack trace
- `GET /api/dap/sessions/:sessionId/scopes/:frameId` - Get scopes
- `GET /api/dap/sessions/:sessionId/variables/:variablesReference` - Get variables

#### Evaluation and Console
- `POST /api/dap/sessions/:sessionId/evaluate` - Evaluate expression
- `POST /api/dap/sessions/:sessionId/output` - Send console output

## Development

### Building

To build both components:

```bash
# Build VSCode extension
cd vscode-extension
npm run compile

# Build MCP server
cd ../mcp-server
npm run build
```

### Testing

Start the VSCode extension and MCP server, then test the integration:

1. Start VSCode extension HTTP API server
2. Start MCP server
3. Use MCP client to test debugging operations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

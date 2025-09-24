# debugger-mcp
VSCode Extension for debugging + MCP

This project consists of two components that work together to provide AI assistants with debugging capabilities through the Model Context Protocol (MCP).

## Architecture

```
AI Assistant <--> MCP Server <--> HTTP API <--> VSCode Extension <--> DAP <--> Debugger
```

The VSCode extension acts as a bridge between the MCP server and the Debug Adapter Protocol, exposing debugging operations through a simple HTTP API.

## Components

### VSCode Extension (`vscode-extension/`)
- HTTP API server that exposes debugging operations
- Endpoints for starting/stopping debug sessions, setting breakpoints, stepping through code
- Auto-starts on extension activation
- Configurable port (default: 3000)

### MCP Server (`mcp-server/`)
- MCP tools that call the VSCode extension's HTTP API
- Tools for all major debugging operations (start, stop, continue, step, breakpoints)
- Proper error handling and user-friendly responses
- Uses stdio transport for MCP communication

## Quick Start

### 1. Build both components
```bash
npm run build
```

### 2. Start the VSCode Extension
1. Open the `vscode-extension` folder in VSCode
2. Press F5 to launch the extension in a new VSCode window
3. The HTTP API server will start automatically on port 3000

### 3. Use the MCP Server
```bash
cd mcp-server
npm start
```

### 4. Configure your MCP client
Use the configuration in `examples/mcp-client-config.json`:

```json
{
  "mcpServers": {
    "debugger-mcp": {
      "command": "node",
      "args": ["path/to/mcp-server/dist/index.js"],
      "env": {
        "DEBUGGER_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

## Available MCP Tools

- `debug_start` - Start a new debug session
- `debug_stop` - Stop the current debug session  
- `debug_continue` - Continue execution
- `debug_step_over` - Step over the current line
- `debug_step_into` - Step into function calls
- `debug_step_out` - Step out of current function
- `debug_pause` - Pause execution
- `debug_set_breakpoints` - Set breakpoints in a file
- `debug_get_sessions` - Get information about active sessions
- `debug_get_variables` - Get variable information

## Example Usage

1. **Start debugging a Node.js app:**
   ```json
   {
     "tool": "debug_start",
     "arguments": {
       "program": "/absolute/path/to/your/app.js",
       "type": "node",
       "name": "My Debug Session"
     }
   }
   ```

2. **Set breakpoints:**
   ```json
   {
     "tool": "debug_set_breakpoints",
     "arguments": {
       "file": "/absolute/path/to/your/app.js",
       "lines": [10, 15]
     }
   }
   ```

3. **Step through code:**
   ```json
   {
     "tool": "debug_continue"
   }
   ```
   ```json
   {
     "tool": "debug_step_over"
   }
   ```

## Testing

1. Test the HTTP API directly:
   ```bash
   node test-integration.js
   ```

2. Try the example app:
   ```bash
   # In one terminal, ensure the VSCode extension is running
   # In another terminal:
   cd examples
   # Use the MCP tools to debug test-app.js
   ```

## Project Structure

```
debugger-mcp/
├── vscode-extension/          # VSCode extension with HTTP API
│   ├── src/extension.ts       # Main extension code
│   ├── package.json          # Extension manifest
│   └── out/                  # Compiled JavaScript
├── mcp-server/               # MCP server
│   ├── src/index.ts         # Main MCP server code
│   ├── package.json         # MCP server dependencies
│   └── dist/                # Compiled JavaScript
├── examples/                # Usage examples and test files
├── package.json            # Root package.json for building
└── README.md              # This file
```

## Configuration

### VSCode Extension Settings
- `debuggerMcp.serverPort`: HTTP API port (default: 3000)

### MCP Server Environment
- `DEBUGGER_API_URL`: URL of the VSCode extension API (default: http://localhost:3000)

## Troubleshooting

- **Connection refused errors**: Make sure the VSCode extension is running and the HTTP server is started
- **Port conflicts**: Change the port in VSCode settings if 3000 is in use
- **File paths**: Always use absolute paths for program files and breakpoint files
- **Debug adapter not found**: Ensure you have the appropriate debugger extension installed in VSCode (e.g., Node.js debugger for JavaScript/TypeScript)

## Contributing

1. Make changes to the TypeScript source files
2. Run `npm run build` to compile both components
3. Test with the example applications
4. Submit a pull request

## License

MIT

# Debugger MCP VSCode Extension

This VSCode extension provides an HTTP API for debugging operations, allowing external tools (like MCP servers) to control VSCode's debugging features.

## Installation

1. Open this folder in VSCode
2. Run `npm install`
3. Press F5 to launch the extension in a new VSCode window

## Configuration

The extension can be configured through VSCode settings:

- `debuggerMcp.serverPort`: Port for the HTTP API server (default: 3000)

## Commands

- `Debugger MCP: Start HTTP Server` - Manually start the HTTP API server
- `Debugger MCP: Stop HTTP Server` - Stop the HTTP API server

## HTTP API Endpoints

### Health Check
- `GET /health` - Returns server status

### Debug Sessions
- `GET /debug/sessions` - Get active debug sessions
- `POST /debug/start` - Start a new debug session
- `POST /debug/stop` - Stop the current debug session

### Breakpoints
- `POST /debug/breakpoints` - Set breakpoints in a file

### Debug Actions
- `POST /debug/action/continue` - Continue execution
- `POST /debug/action/stepOver` - Step over current line
- `POST /debug/action/stepInto` - Step into function calls
- `POST /debug/action/stepOut` - Step out of current function
- `POST /debug/action/pause` - Pause execution

### Variables
- `GET /debug/variables` - Get variable information

## Example Usage

```bash
# Start debugging a Node.js application
curl -X POST http://localhost:3000/debug/start \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Debug Session",
    "type": "node",
    "request": "launch",
    "program": "/path/to/your/app.js"
  }'

# Set a breakpoint
curl -X POST http://localhost:3000/debug/breakpoints \
  -H "Content-Type: application/json" \
  -d '{
    "file": "/path/to/your/app.js",
    "lines": [10, 15]
  }'

# Continue execution
curl -X POST http://localhost:3000/debug/action/continue
```

## Security Note

This extension opens an HTTP server on localhost. Only use in trusted environments.
# Debugger MCP Server

This MCP server provides debugging tools that interface with a VSCode extension's HTTP API.

## Installation

```bash
npm install
npm run build
```

## Configuration

Set the `DEBUGGER_API_URL` environment variable to point to your VSCode extension's HTTP API:

```bash
export DEBUGGER_API_URL=http://localhost:3000
```

## Running

```bash
npm start
```

## Available Tools

- `debug_start` - Start debugging a program
- `debug_stop` - Stop the current debug session
- `debug_continue` - Continue execution
- `debug_step_over` - Step over current line
- `debug_step_into` - Step into function calls
- `debug_step_out` - Step out of current function
- `debug_pause` - Pause execution
- `debug_set_breakpoints` - Set breakpoints in a file
- `debug_get_sessions` - Get active debug sessions
- `debug_get_variables` - Get variable information

## Usage with MCP Clients

Configure your MCP client to use this server:

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
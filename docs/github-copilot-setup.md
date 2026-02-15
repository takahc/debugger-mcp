# GitHub Copilot Integration Setup

This guide explains how to configure GitHub Copilot in VSCode to use the debugger-mcp server for AI-powered debugging operations.

## Prerequisites

1. **VSCode** with GitHub Copilot extension installed
2. **Built MCP Server**: Run `npm run build` in the project root
3. **Node.js** version 16 or higher

## Setup Steps

### 1. Start the VSCode Extension

First, you need to start the DAP HTTP API server that the MCP server communicates with:

1. Open VSCode
2. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
3. Run the command **"Start Debugger MCP Server"**
4. Enter port number (default: 3001) when prompted
5. You should see a confirmation message: "DAP API Server started on port 3001"

### 2. Configure MCP in VSCode

Create the MCP configuration file in your workspace:

**File**: `.vscode/mcp.json`
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

### 3. Restart VSCode

Restart VSCode to load the new MCP configuration. The MCP server will be automatically started when GitHub Copilot needs to use debugging tools.

## Available Debugging Tools

Once configured, GitHub Copilot will have access to 21 debugging tools:

### Session Management
- `debug_create_session` - Create a new debug session
- `debug_list_sessions` - List all debug sessions  
- `debug_get_session` - Get session information
- `debug_delete_session` - Delete a debug session

### Debug Operations
- `debug_initialize` - Initialize debug session
- `debug_launch` - Launch debug session
- `debug_attach` - Attach to running process
- `debug_disconnect` - Disconnect from debug session
- `debug_terminate` - Terminate debug session

### Execution Control
- `debug_continue` - Continue execution
- `debug_pause` - Pause execution
- `debug_step_over` - Step over current line
- `debug_step_into` - Step into function call
- `debug_step_out` - Step out of current function

### Breakpoints
- `debug_set_breakpoints` - Set source breakpoints
- `debug_set_function_breakpoints` - Set function breakpoints
- `debug_set_exception_breakpoints` - Set exception breakpoints

### Variable Inspection
- `debug_get_threads` - Get thread list
- `debug_get_stack_trace` - Get stack trace
- `debug_get_scopes` - Get variable scopes
- `debug_get_variables` - Get variables in scope
- `debug_evaluate` - Evaluate expressions

### Debug Console & Health
- `debug_send_output` - Send output to debug console
- `debug_health_check` - Check if DAP API server is running

## Example Usage with GitHub Copilot

You can now ask GitHub Copilot to perform debugging operations such as:

- **"Set a breakpoint on line 25 of app.js"**
- **"Launch a debug session for my Node.js application"**
- **"Step through the code and show me the variable values"**
- **"Evaluate the expression 'user.name' in the current debug context"**
- **"Continue execution until the next breakpoint"**

## Troubleshooting

### MCP Server Not Starting
- Ensure the MCP server is built: `npm run build`
- Check that Node.js is in your PATH
- Verify the path in `mcp.json` is correct relative to your workspace

### DAP API Server Not Available
- Make sure you started the VSCode extension first
- Check the port number matches (default: 3001)
- Verify the server is running: check for "DAP API Server started" message

### GitHub Copilot Not Using Tools
- Restart VSCode after creating/updating `mcp.json`
- Check VSCode developer console for error messages
- Ensure GitHub Copilot extension is updated to the latest version

## Configuration Options

### Custom Port
If you need to use a different port for the DAP API server:

1. Start the VSCode extension with your custom port
2. Update the `DAP_API_URL` in `.vscode/mcp.json`:
   ```json
   {
     "servers": {
       "debugger-mcp": {
         "command": "node",
         "args": ["./mcp-server/dist/index.js"],
         "env": {
           "DAP_API_URL": "http://localhost:YOUR_PORT"
         }
       }
     }
   }
   ```

### Multiple Debug Configurations
You can create multiple MCP server instances for different debug configurations by adding more entries to the `servers` object in `mcp.json`.
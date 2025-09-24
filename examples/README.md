# Usage Examples

## Testing the Integration

### 1. Start the VSCode Extension
1. Open the `vscode-extension` folder in VSCode
2. Press F5 to launch the extension in a new VSCode window
3. The HTTP API server will start automatically on port 3000

### 2. Test the HTTP API directly
You can test the API endpoints directly with curl:

```bash
# Check server health
curl http://localhost:3000/health

# Get active debug sessions
curl http://localhost:3000/debug/sessions

# Start a debug session for the test app
curl -X POST http://localhost:3000/debug/start \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Debug Session",
    "type": "node",
    "request": "launch",
    "program": "/path/to/examples/test-app.js"
  }'

# Set breakpoints
curl -X POST http://localhost:3000/debug/breakpoints \
  -H "Content-Type: application/json" \
  -d '{
    "file": "/path/to/examples/test-app.js",
    "lines": [18]
  }'

# Continue execution
curl -X POST http://localhost:3000/debug/action/continue

# Step over
curl -X POST http://localhost:3000/debug/action/stepOver

# Stop debugging
curl -X POST http://localhost:3000/debug/stop
```

### 3. Use with MCP Client
1. Start the MCP server:
```bash
cd mcp-server
npm start
```

2. Configure your MCP client with the configuration in `mcp-client-config.json`

### 4. Available MCP Tools

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

## Example Debugging Session

1. Open `test-app.js` in VSCode
2. Use the MCP tool `debug_start` with:
   ```json
   {
     "program": "/absolute/path/to/examples/test-app.js",
     "type": "node"
   }
   ```
3. Set a breakpoint with `debug_set_breakpoints`:
   ```json
   {
     "file": "/absolute/path/to/examples/test-app.js",
     "lines": [18]
   }
   ```
4. Use `debug_continue` to start execution
5. When the breakpoint hits, use `debug_step_over` to step through the code
6. Use `debug_get_sessions` to see session information
7. Use `debug_stop` when finished

## Troubleshooting

- If you get connection refused errors, make sure the VSCode extension is running and the HTTP server is started
- Check that the port (default 3000) is not being used by another application
- Ensure absolute file paths are used for the program and breakpoint files
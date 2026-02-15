# Quick Reference - Debugger MCP Tools

This is a quick reference card for AI assistants using the debugger-mcp server. For detailed workflows, see `ai-usage-guide.md`.

## 🚀 Quick Start (3 Steps)

```
1. debug_health_check({})
2. debug_create_session({ name: "Session", type: "node", request: "launch" })
3. debug_launch({ sessionId: "session-1", program: "/path/to/app.js" })
```

## 📋 Tool Categories

### Session Management (6 tools)
- `debug_health_check` - Check server status
- `debug_create_session` - Create new session
- `debug_list_sessions` - List all sessions
- `debug_get_session` - Get session details
- `debug_delete_session` - Remove session
- `debug_list_launch_configurations` - List launch.json configs

### Debug Control (5 tools)
- `debug_initialize` - Initialize session
- `debug_launch` - Start program
- `debug_attach` - Attach to running process
- `debug_disconnect` - Disconnect debugger
- `debug_terminate` - Stop debugging

### Execution (5 tools)
- `debug_continue` - Resume execution
- `debug_pause` - Pause execution
- `debug_step_over` - Step to next line
- `debug_step_into` - Step into function
- `debug_step_out` - Step out of function

### Breakpoints (3 tools)
- `debug_set_breakpoints` - Line breakpoints
- `debug_set_function_breakpoints` - Function breakpoints
- `debug_set_exception_breakpoints` - Exception breakpoints

### Inspection (5 tools)
- `debug_get_threads` - List threads
- `debug_get_stack_trace` - Get call stack
- `debug_get_scopes` - Get variable scopes
- `debug_get_variables` - Get variable values
- `debug_evaluate` - Evaluate expression

### Output (1 tool)
- `debug_send_output` - Write to console

## 🎯 Common Workflows

### Basic Debug Session (Using launch.json)
```
1. debug_list_launch_configurations({})
   → See available configurations
2. debug_create_session({ name: "Debug", type: "node", request: "launch" })
   → Save sessionId
3. debug_set_breakpoints({ sessionId, source: { path }, breakpoints: [{ line: 10 }] })
4. debug_launch({ sessionId, configurationName: "Debug Node.js Program" })
5. debug_continue({ sessionId })
   → Hits breakpoint
6. debug_terminate({ sessionId })
```

### Basic Debug Session (Manual Configuration)
```
1. debug_create_session({ name: "Debug", type: "node", request: "launch" })
   → Save sessionId
2. debug_set_breakpoints({ sessionId, source: { path }, breakpoints: [{ line: 10 }] })
3. debug_launch({ sessionId, program: "/path/app.js" })
4. debug_continue({ sessionId })
   → Hits breakpoint
5. debug_terminate({ sessionId })
```

### Inspect Variable at Breakpoint
```
1. debug_get_threads({ sessionId }) → get threadId
2. debug_get_stack_trace({ sessionId, threadId }) → get frameId
3. debug_get_scopes({ sessionId, frameId }) → get variablesReference
4. debug_get_variables({ sessionId, variablesReference })
   → See all variables
```

### Evaluate Expression
```
debug_evaluate({
  sessionId: "session-1",
  expression: "myVar * 2",
  frameId: 1
})
```

### Step Through Code
```
1. debug_step_over({ sessionId })   // Step to next line
2. debug_step_into({ sessionId })   // Step into function
3. debug_step_out({ sessionId })    // Step out of function
4. debug_continue({ sessionId })     // Resume
```

## 💡 Common Parameters

### sessionId
- Format: `"session-1"`, `"session-2"`, etc.
- Obtained from `debug_create_session` response
- Required for almost all tools

### source
```json
{
  "path": "/absolute/path/to/file.js",
  "name": "file.js"  // optional
}
```

### breakpoint
```json
{
  "line": 10,                    // required
  "column": 5,                   // optional
  "condition": "x > 5",          // optional
  "hitCondition": "== 3",        // optional
  "logMessage": "x = {x}"        // optional (logpoint)
}
```

### launch config (debug_launch)
```json
{
  "sessionId": "session-1",
  "program": "/path/to/app.js",
  "cwd": "/path/to/project",
  "args": ["--port", "3000"],
  "env": { "NODE_ENV": "development" }
}
```

### attach config (debug_attach)
```json
{
  "sessionId": "session-1",
  "port": 9229,
  "address": "localhost"
}
```

## 🔍 Variable Inspection Pattern

```
Thread → Stack Frame → Scope → Variables

debug_get_threads
  ↓ (threadId)
debug_get_stack_trace
  ↓ (frameId from stackFrames[0])
debug_get_scopes
  ↓ (variablesReference from scopes[0])
debug_get_variables
  ↓ (if variable has variablesReference > 0)
debug_get_variables (recursive for nested objects)
```

## 📊 Response Structures

### Session Creation
```json
{
  "sessionId": "session-1",
  "status": "created",
  "configuration": { ... }
}
```

### Threads
```json
{
  "threads": [
    { "id": 1, "name": "Main Thread" }
  ]
}
```

### Stack Trace
```json
{
  "stackFrames": [
    {
      "id": 1,
      "name": "functionName",
      "source": { "path": "...", "name": "..." },
      "line": 10,
      "column": 5
    }
  ],
  "totalFrames": 1
}
```

### Scopes
```json
{
  "scopes": [
    {
      "name": "Local",
      "variablesReference": 1001,
      "expensive": false
    }
  ]
}
```

### Variables
```json
{
  "variables": [
    {
      "name": "myVar",
      "value": "42",
      "type": "number",
      "variablesReference": 0
    }
  ]
}
```

### Evaluate
```json
{
  "result": "84",
  "type": "number",
  "variablesReference": 0
}
```

## ⚠️ Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| Session not found | Invalid sessionId | Check with `debug_list_sessions` |
| Not active | Session terminated | Create new session |
| Breakpoint not verified | Wrong path/line | Check file path is absolute |
| Cannot evaluate | Not paused | Ensure debugger is paused at breakpoint |
| Connection refused | Server not running | Start VSCode extension first |

## 🎓 Debug Adapter Types

| Language | Type | Notes |
|----------|------|-------|
| Node.js | `node` | Default port 9229 |
| Python | `python` | Needs Python extension |
| Java | `java` | Needs Java debugger |
| C/C++ | `cppdbg` | Needs C++ extension |
| Go | `go` | Needs Go extension |

## 📝 Tips for AI Assistants

✅ **DO:**
- Always check health before starting
- Save sessionId for all operations
- Get fresh stack traces after each step
- Clean up sessions when done
- Use absolute file paths
- Check tool responses for errors

❌ **DON'T:**
- Cache frameIds across steps
- Assume thread IDs are constant
- Forget to initialize before launch
- Mix sessionIds between operations
- Use relative file paths

## 🔗 Related Documentation

- **ai-usage-guide.md** - Complete workflows and examples
- **variable-inspection.md** - Deep dive into variable inspection
- **github-copilot-setup.md** - Setup for GitHub Copilot
- **README.md** - Architecture and installation

## 🆘 Need Help?

1. Check `ai-usage-guide.md` for detailed workflows
2. Review error messages in tool responses
3. Verify VSCode extension is running (port 3001)
4. Use `debug_health_check` to test connectivity
5. Check `debug_list_sessions` to see active sessions

---

**Version**: 0.1.0  
**Last Updated**: 2026-02-15

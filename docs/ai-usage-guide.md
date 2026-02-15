# AI Usage Guide - Debugger MCP Server

This guide provides step-by-step instructions for AI assistants on how to use the debugger-mcp server to debug applications. It includes complete workflows with example commands.

## Prerequisites

Before starting, ensure that:
1. The VSCode Extension HTTP API server is running (port 3001 by default)
2. The MCP server is properly configured
3. You have access to all 21 debugging tools

## Table of Contents

1. [Quick Start: Simple Debugging Session](#quick-start)
2. [Complete Workflow: Node.js Application](#complete-workflow-nodejs)
3. [Variable Inspection Workflow](#variable-inspection-workflow)
4. [Advanced Debugging Scenarios](#advanced-scenarios)
5. [Tool Reference](#tool-reference)
6. [Common Patterns](#common-patterns)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start: Simple Debugging Session

This is the minimal workflow to start debugging:

### Step 1: Check Server Health
```
Tool: debug_health_check
Input: {}
```
Expected Output:
```json
{
  "healthy": true,
  "message": "DAP API server is running"
}
```

### Step 2: Create a Debug Session
```
Tool: debug_create_session
Input: {
  "name": "My Debug Session",
  "type": "node",
  "request": "launch"
}
```
Expected Output:
```json
{
  "sessionId": "session-1",
  "status": "created",
  "configuration": {
    "name": "My Debug Session",
    "type": "node",
    "request": "launch"
  }
}
```

### Step 3: Launch the Program
```
Tool: debug_launch
Input: {
  "sessionId": "session-1",
  "program": "/path/to/your/app.js",
  "cwd": "/path/to/your/project"
}
```
Expected Output:
```json
{
  "status": "launched"
}
```

---

## Complete Workflow: Node.js Application

This example demonstrates a complete debugging session for a Node.js application.

### Scenario
Debug a Node.js application that calculates Fibonacci numbers, set a breakpoint, and inspect variables.

### Step 1: Create and Initialize Session

**1.1 Create Session**
```
Tool: debug_create_session
Input: {
  "name": "Fibonacci Debugger",
  "type": "node",
  "request": "launch"
}
```
Save the returned `sessionId` (e.g., "session-1")

**1.2 Initialize Session**
```
Tool: debug_initialize
Input: {
  "sessionId": "session-1"
}
```

### Step 2: Set Breakpoints

**2.1 Set Breakpoint at Function Entry**
```
Tool: debug_set_breakpoints
Input: {
  "sessionId": "session-1",
  "source": {
    "path": "/home/user/project/app.js",
    "name": "app.js"
  },
  "breakpoints": [
    {
      "line": 10,
      "condition": "num > 5"
    }
  ]
}
```

Expected Output:
```json
{
  "breakpoints": [
    {
      "id": 0,
      "verified": true,
      "line": 10,
      "column": 0,
      "source": {
        "path": "/home/user/project/app.js"
      }
    }
  ]
}
```

### Step 3: Launch and Run

**3.1 Launch the Application**
```
Tool: debug_launch
Input: {
  "sessionId": "session-1",
  "program": "/home/user/project/app.js",
  "cwd": "/home/user/project",
  "console": "integratedTerminal"
}
```

**3.2 Continue Execution**
```
Tool: debug_continue
Input: {
  "sessionId": "session-1"
}
```

The program will run until it hits the breakpoint.

### Step 4: Inspect Variables When Paused

**4.1 Get Thread Information**
```
Tool: debug_get_threads
Input: {
  "sessionId": "session-1"
}
```

Expected Output:
```json
{
  "threads": [
    {
      "id": 1,
      "name": "Main Thread"
    }
  ]
}
```

**4.2 Get Stack Trace**
```
Tool: debug_get_stack_trace
Input: {
  "sessionId": "session-1",
  "threadId": 1
}
```

Expected Output:
```json
{
  "stackFrames": [
    {
      "id": 1,
      "name": "fibonacci",
      "source": {
        "path": "/home/user/project/app.js",
        "name": "app.js"
      },
      "line": 10,
      "column": 5
    },
    {
      "id": 2,
      "name": "main",
      "source": {
        "path": "/home/user/project/app.js"
      },
      "line": 18,
      "column": 20
    }
  ],
  "totalFrames": 2
}
```

**4.3 Get Scopes for Top Frame**
```
Tool: debug_get_scopes
Input: {
  "sessionId": "session-1",
  "frameId": 1
}
```

Expected Output:
```json
{
  "scopes": [
    {
      "name": "Local",
      "variablesReference": 1001,
      "expensive": false
    },
    {
      "name": "Global",
      "variablesReference": 1002,
      "expensive": true
    }
  ]
}
```

**4.4 Get Local Variables**
```
Tool: debug_get_variables
Input: {
  "sessionId": "session-1",
  "variablesReference": 1001
}
```

Expected Output:
```json
{
  "variables": [
    {
      "name": "n",
      "value": "8",
      "type": "number",
      "variablesReference": 0
    },
    {
      "name": "num",
      "value": "8",
      "type": "number",
      "variablesReference": 0
    }
  ]
}
```

**4.5 Evaluate an Expression**
```
Tool: debug_evaluate
Input: {
  "sessionId": "session-1",
  "expression": "n * 2",
  "frameId": 1,
  "context": "watch"
}
```

Expected Output:
```json
{
  "result": "16",
  "type": "number",
  "variablesReference": 0
}
```

### Step 5: Step Through Code

**5.1 Step Over Current Line**
```
Tool: debug_step_over
Input: {
  "sessionId": "session-1"
}
```

**5.2 Step Into Function Call**
```
Tool: debug_step_into
Input: {
  "sessionId": "session-1"
}
```

**5.3 Step Out of Current Function**
```
Tool: debug_step_out
Input: {
  "sessionId": "session-1"
}
```

### Step 6: Continue or Stop

**6.1 Continue Execution**
```
Tool: debug_continue
Input: {
  "sessionId": "session-1"
}
```

**6.2 Terminate Session (when done)**
```
Tool: debug_terminate
Input: {
  "sessionId": "session-1"
}
```

**6.3 Clean Up Session**
```
Tool: debug_delete_session
Input: {
  "sessionId": "session-1"
}
```

---

## Variable Inspection Workflow

This workflow focuses on inspecting complex variables and objects.

### Scenario
Inspect an object with nested properties at a breakpoint.

### Step 1: Set Up
```
Tool: debug_create_session
Input: { "name": "Inspector", "type": "node", "request": "launch" }

Tool: debug_set_breakpoints
Input: {
  "sessionId": "session-1",
  "source": { "path": "/path/to/file.js" },
  "breakpoints": [{ "line": 25 }]
}

Tool: debug_launch
Input: {
  "sessionId": "session-1",
  "program": "/path/to/file.js"
}
```

### Step 2: When Paused, Inspect Variables

**2.1 Get Current Frame**
```
Tool: debug_get_threads -> get threadId
Tool: debug_get_stack_trace -> get frameId (usually first stackFrame)
Tool: debug_get_scopes -> get variablesReference for "Local" scope
```

**2.2 Get Local Variables**
```
Tool: debug_get_variables
Input: {
  "sessionId": "session-1",
  "variablesReference": 1001
}
```

Response might show:
```json
{
  "variables": [
    {
      "name": "user",
      "value": "{...}",
      "type": "Object",
      "variablesReference": 2001
    },
    {
      "name": "count",
      "value": "42",
      "type": "number",
      "variablesReference": 0
    }
  ]
}
```

**2.3 Inspect Nested Object**
If a variable has `variablesReference > 0`, you can inspect its properties:
```
Tool: debug_get_variables
Input: {
  "sessionId": "session-1",
  "variablesReference": 2001
}
```

Response:
```json
{
  "variables": [
    {
      "name": "id",
      "value": "123",
      "type": "number",
      "variablesReference": 0
    },
    {
      "name": "name",
      "value": "John Doe",
      "type": "string",
      "variablesReference": 0
    },
    {
      "name": "address",
      "value": "{...}",
      "type": "Object",
      "variablesReference": 2002
    }
  ]
}
```

**2.4 Evaluate Complex Expression**
```
Tool: debug_evaluate
Input: {
  "sessionId": "session-1",
  "expression": "user.name.toUpperCase()",
  "frameId": 1
}
```

---

## Advanced Debugging Scenarios

### Scenario 1: Conditional Breakpoint

Set a breakpoint that only triggers when a condition is true:

```
Tool: debug_set_breakpoints
Input: {
  "sessionId": "session-1",
  "source": { "path": "/path/to/file.js" },
  "breakpoints": [
    {
      "line": 15,
      "condition": "i > 100 && result !== null"
    }
  ]
}
```

### Scenario 2: Function Breakpoint

Break when a specific function is called:

```
Tool: debug_set_function_breakpoints
Input: {
  "sessionId": "session-1",
  "breakpoints": [
    {
      "name": "processData",
      "condition": "data.length > 0"
    }
  ]
}
```

### Scenario 3: Exception Breakpoint

Break when exceptions occur:

```
Tool: debug_set_exception_breakpoints
Input: {
  "sessionId": "session-1",
  "filters": ["all", "uncaught"]
}
```

### Scenario 4: Attach to Running Process

Debug a process that's already running:

```
Tool: debug_create_session
Input: {
  "name": "Attach Session",
  "type": "node",
  "request": "attach"
}

Tool: debug_attach
Input: {
  "sessionId": "session-1",
  "port": 9229,
  "address": "localhost"
}
```

### Scenario 5: Multiple Breakpoints

Set multiple breakpoints at once:

```
Tool: debug_set_breakpoints
Input: {
  "sessionId": "session-1",
  "source": { "path": "/path/to/file.js" },
  "breakpoints": [
    { "line": 10 },
    { "line": 25, "condition": "x > 5" },
    { "line": 40, "logMessage": "Reached line 40, x={x}" }
  ]
}
```

---

## Tool Reference

### Session Management Tools

| Tool | Purpose | Required Parameters |
|------|---------|-------------------|
| `debug_health_check` | Verify API server is running | None |
| `debug_create_session` | Create new debug session | name, type, request |
| `debug_list_sessions` | List all sessions | None |
| `debug_get_session` | Get session info | sessionId |
| `debug_delete_session` | Delete session | sessionId |

### Debug Control Tools

| Tool | Purpose | Required Parameters |
|------|---------|-------------------|
| `debug_initialize` | Initialize session | sessionId |
| `debug_launch` | Launch program | sessionId, program |
| `debug_attach` | Attach to process | sessionId, (port or processId) |
| `debug_disconnect` | Disconnect | sessionId |
| `debug_terminate` | Terminate | sessionId |

### Execution Control Tools

| Tool | Purpose | Required Parameters |
|------|---------|-------------------|
| `debug_continue` | Continue execution | sessionId |
| `debug_pause` | Pause execution | sessionId |
| `debug_step_over` | Step over line | sessionId |
| `debug_step_into` | Step into function | sessionId |
| `debug_step_out` | Step out of function | sessionId |

### Breakpoint Tools

| Tool | Purpose | Required Parameters |
|------|---------|-------------------|
| `debug_set_breakpoints` | Set source breakpoints | sessionId, source, breakpoints |
| `debug_set_function_breakpoints` | Set function breakpoints | sessionId, breakpoints |
| `debug_set_exception_breakpoints` | Set exception breakpoints | sessionId, filters |

### Inspection Tools

| Tool | Purpose | Required Parameters |
|------|---------|-------------------|
| `debug_get_threads` | Get thread list | sessionId |
| `debug_get_stack_trace` | Get call stack | sessionId, threadId |
| `debug_get_scopes` | Get variable scopes | sessionId, frameId |
| `debug_get_variables` | Get variables | sessionId, variablesReference |
| `debug_evaluate` | Evaluate expression | sessionId, expression |

### Output Tools

| Tool | Purpose | Required Parameters |
|------|---------|-------------------|
| `debug_send_output` | Send to debug console | sessionId, output |

---

## Common Patterns

### Pattern 1: Find Variable Value

To find the value of a variable `myVar` at current execution point:

1. `debug_get_threads` → get threadId
2. `debug_get_stack_trace` → get frameId (usually first frame)
3. `debug_get_scopes` → get variablesReference for "Local" scope
4. `debug_get_variables` → find `myVar` in the list
5. If `myVar` has `variablesReference > 0`, repeat step 4 to explore nested properties

### Pattern 2: Watch Expression

To continuously monitor an expression:

```
Tool: debug_evaluate
Input: {
  "sessionId": "session-1",
  "expression": "myVariable * 2 + offset",
  "frameId": 1,
  "context": "watch"
}
```

Call this after each step operation to see updated values.

### Pattern 3: Inspect All Local Variables

```
1. Get current frame (from stack trace)
2. Get scopes for that frame
3. For each scope (usually start with "Local"):
   - Get variables using variablesReference
   - For each variable with variablesReference > 0:
     - Recursively get its properties
```

### Pattern 4: Hit and Continue

Set logpoint breakpoints that don't pause but log information:

```
Tool: debug_set_breakpoints
Input: {
  "sessionId": "session-1",
  "source": { "path": "/path/to/file.js" },
  "breakpoints": [
    {
      "line": 50,
      "logMessage": "Value of x: {x}, y: {y}"
    }
  ]
}
```

---

## Troubleshooting

### Issue: Session Not Found
**Problem**: Tool returns "Session not found or not active"

**Solution**:
1. Check if session exists: `debug_list_sessions`
2. Verify sessionId is correct
3. Ensure session is still active (not terminated)

### Issue: No Variables Available
**Problem**: `debug_get_variables` returns empty array

**Solution**:
1. Verify debugger is paused (not continuing)
2. Check you're using correct variablesReference
3. Ensure frame is valid (from current stack trace)

### Issue: Breakpoint Not Verified
**Problem**: Breakpoint shows `verified: false`

**Solution**:
1. Check file path is absolute and correct
2. Verify line number exists in source file
3. Ensure source file is loaded by debugger
4. Try setting breakpoint after program starts

### Issue: Evaluation Failed
**Problem**: `debug_evaluate` returns error

**Solution**:
1. Verify expression syntax is correct
2. Ensure variables in expression are in scope
3. Check debugger is paused
4. Verify frameId is valid

### Issue: Cannot Attach
**Problem**: `debug_attach` fails

**Solution**:
1. Verify process is running with debug port open
2. Check port number is correct (default: 9229 for Node.js)
3. Ensure no firewall blocks the port
4. For Node.js: start with `node --inspect` or `node --inspect-brk`

---

## Example Session Script

Here's a complete example you can follow:

```javascript
// 1. Health check
debug_health_check({})

// 2. Create session
const session = debug_create_session({
  name: "Demo Session",
  type: "node",
  request: "launch"
})
const sessionId = session.sessionId // e.g., "session-1"

// 3. Initialize
debug_initialize({ sessionId })

// 4. Set breakpoint
debug_set_breakpoints({
  sessionId,
  source: { path: "/home/user/app.js" },
  breakpoints: [{ line: 10 }]
})

// 5. Launch
debug_launch({
  sessionId,
  program: "/home/user/app.js",
  cwd: "/home/user"
})

// 6. Program starts and hits breakpoint...

// 7. Inspect state
const threads = debug_get_threads({ sessionId })
const threadId = threads.threads[0].id

const stack = debug_get_stack_trace({ sessionId, threadId })
const frameId = stack.stackFrames[0].id

const scopes = debug_get_scopes({ sessionId, frameId })
const localScope = scopes.scopes.find(s => s.name === "Local")

const variables = debug_get_variables({
  sessionId,
  variablesReference: localScope.variablesReference
})

// Print all local variables
for (const v of variables.variables) {
  console.log(`${v.name} = ${v.value} (${v.type})`)
}

// 8. Evaluate expression
const result = debug_evaluate({
  sessionId,
  expression: "myVar + 10",
  frameId
})
console.log(`Result: ${result.result}`)

// 9. Step over
debug_step_over({ sessionId })

// 10. Continue
debug_continue({ sessionId })

// 11. Clean up when done
debug_terminate({ sessionId })
debug_delete_session({ sessionId })
```

---

## Best Practices for AI Assistants

1. **Always start with health check** to verify the server is accessible
2. **Save session IDs** as they're needed for all subsequent operations
3. **Handle errors gracefully** - check tool responses for error fields
4. **Clean up sessions** when done to free resources
5. **Use descriptive session names** for easier tracking
6. **Set breakpoints before launching** for predictable behavior
7. **Check thread IDs** as they may change during execution
8. **Use fresh stack traces** - don't cache frameIds across steps
9. **Start with Local scope** when inspecting variables
10. **Use evaluate** for complex expressions rather than manual calculation

---

## Language-Specific Tips

### Node.js
- Default debug port: 9229
- Start with: `node --inspect-brk app.js`
- Type: "node"

### Python
- Requires Python debugger extension in VSCode
- Type: "python"
- Common config: `{ "program": "${file}", "console": "integratedTerminal" }`

### Java
- Requires Java debugger extension
- Type: "java"
- May need `projectName` and `mainClass` in launch config

### C/C++
- Requires C/C++ extension
- Type: "cppdbg" or "cppvsdbg"
- Needs `miDebuggerPath` for GDB/LLDB

---

This guide covers the essential workflows for debugging with the MCP server. For more detailed information about specific features, refer to:
- `variable-inspection.md` - Deep dive into variable inspection
- `github-copilot-setup.md` - Setup for GitHub Copilot integration
- README.md - Architecture and installation

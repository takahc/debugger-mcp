# Variable Inspection Implementation

This document explains how variable inspection is implemented in the debugger-mcp server using VSCode's Debug Adapter Protocol.

## Overview

The variable inspection functionality uses VSCode's `DebugSession.customRequest()` API to communicate directly with the underlying debug adapter. This provides real-time access to:

- Thread information
- Stack traces
- Variable scopes
- Variable values
- Expression evaluation

## Implementation Details

### 1. Get Threads (`debug_get_threads`)

Retrieves the list of active threads in the debug session.

**Endpoint**: `GET /api/dap/sessions/:sessionId/threads`

**Implementation**:
```typescript
const response = await session.debugSession.customRequest('threads');
```

**Response Format**:
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

### 2. Get Stack Trace (`debug_get_stack_trace`)

Retrieves the call stack for a specific thread.

**Endpoint**: `GET /api/dap/sessions/:sessionId/stackTrace/:threadId`

**Implementation**:
```typescript
const response = await session.debugSession.customRequest('stackTrace', {
  threadId: parseInt(threadId),
  startFrame: 0,
  levels: 20
});
```

**Response Format**:
```json
{
  "stackFrames": [
    {
      "id": 1,
      "name": "main",
      "source": {
        "path": "/path/to/file.js",
        "name": "file.js"
      },
      "line": 10,
      "column": 5
    }
  ],
  "totalFrames": 1
}
```

### 3. Get Scopes (`debug_get_scopes`)

Retrieves the variable scopes available in a stack frame.

**Endpoint**: `GET /api/dap/sessions/:sessionId/scopes/:frameId`

**Implementation**:
```typescript
const response = await session.debugSession.customRequest('scopes', {
  frameId: parseInt(frameId)
});
```

**Response Format**:
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

### 4. Get Variables (`debug_get_variables`)

Retrieves the variables in a specific scope.

**Endpoint**: `GET /api/dap/sessions/:sessionId/variables/:variablesReference`

**Implementation**:
```typescript
const response = await session.debugSession.customRequest('variables', {
  variablesReference: parseInt(variablesReference)
});
```

**Response Format**:
```json
{
  "variables": [
    {
      "name": "myVar",
      "value": "42",
      "type": "number",
      "variablesReference": 0
    },
    {
      "name": "myObject",
      "value": "{...}",
      "type": "Object",
      "variablesReference": 1003
    }
  ]
}
```

### 5. Evaluate Expression (`debug_evaluate`)

Evaluates an expression in the debug context.

**Endpoint**: `POST /api/dap/sessions/:sessionId/evaluate`

**Request Body**:
```json
{
  "expression": "myVar + 10",
  "frameId": 1,
  "context": "watch"
}
```

**Implementation**:
```typescript
const response = await session.debugSession.customRequest('evaluate', {
  expression,
  frameId: frameId ? parseInt(frameId) : undefined,
  context: context || 'watch'
});
```

**Response Format**:
```json
{
  "result": "52",
  "type": "number",
  "variablesReference": 0
}
```

## Usage Flow

A typical workflow for inspecting variables:

1. **Start a debug session** and pause at a breakpoint
2. **Get threads** to find the active thread ID
3. **Get stack trace** for the thread to find frame IDs
4. **Get scopes** for a specific frame to find variable references
5. **Get variables** using the variable references to see actual values
6. **Evaluate expressions** to compute derived values or check conditions

## Example with MCP Tools

```javascript
// 1. Create and launch a debug session
await debug_create_session({ name: "My App", type: "node" });
await debug_launch({ 
  sessionId: "session-1", 
  program: "./app.js" 
});

// 2. Set a breakpoint
await debug_set_breakpoints({
  sessionId: "session-1",
  source: { path: "./app.js" },
  breakpoints: [{ line: 10 }]
});

// 3. Continue until breakpoint is hit
await debug_continue({ sessionId: "session-1" });

// 4. Get thread information
const threads = await debug_get_threads({ sessionId: "session-1" });
// Response: { threads: [{ id: 1, name: "Main Thread" }] }

// 5. Get stack trace
const stack = await debug_get_stack_trace({ 
  sessionId: "session-1", 
  threadId: 1 
});
// Response: { stackFrames: [{ id: 1, name: "main", line: 10, ... }] }

// 6. Get scopes for the top frame
const scopes = await debug_get_scopes({ 
  sessionId: "session-1", 
  frameId: 1 
});
// Response: { scopes: [{ name: "Local", variablesReference: 1001 }] }

// 7. Get variables in the local scope
const vars = await debug_get_variables({ 
  sessionId: "session-1", 
  variablesReference: 1001 
});
// Response: { variables: [{ name: "x", value: "42", type: "number" }] }

// 8. Evaluate an expression
const result = await debug_evaluate({
  sessionId: "session-1",
  expression: "x * 2",
  frameId: 1
});
// Response: { result: "84", type: "number" }
```

## Debug Adapter Support

This implementation works with any debug adapter that supports the DAP specification, including:

- **Node.js** (built-in VSCode debugger)
- **Python** (Python extension debugger)
- **Java** (Java Debug Server)
- **C/C++** (cpptools debugger)
- **Go** (Go extension debugger)
- And many others

The debug adapter handles the actual variable inspection, and the VSCode extension acts as a proxy, making these capabilities available through HTTP API and MCP tools.

## Error Handling

All variable inspection endpoints include proper error handling:

- **404 Not Found**: Session not found or not active
- **500 Internal Server Error**: Debug adapter request failed (e.g., invalid frame ID, thread not paused)

The error messages include details from the debug adapter to help diagnose issues.

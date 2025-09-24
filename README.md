# debugger-mcp
VSCode Extension for debugging + MCP

This project consists of two components:

## VSCode Extension
A VSCode extension that provides HTTP API endpoints for Debug Adapter Protocol (DAP) operations.

## MCP Server
A Model Context Protocol (MCP) server that consumes the HTTP API to provide debugging tools to AI.

## Setup

### VSCode Extension
1. Open the `vscode-extension` folder in VSCode
2. Run `npm install`
3. Press F5 to launch the extension in a new VSCode window

### MCP Server
1. Navigate to the `mcp-server` folder
2. Run `npm install`
3. Run `npm start` to start the MCP server

## Architecture

```
AI Assistant <--> MCP Server <--> HTTP API <--> VSCode Extension <--> DAP <--> Debugger
```

The VSCode extension acts as a bridge between the MCP server and the Debug Adapter Protocol, exposing debugging operations through a simple HTTP API.

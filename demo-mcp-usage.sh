#!/bin/bash

# Demo script showing MCP server usage

echo "=== Debugger MCP Server Demo ==="
echo

echo "1. Testing MCP server startup and tool listing..."
cd mcp-server

# Test tool listing
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | node dist/index.js > /tmp/tools_response.json

echo "Available tools:"
cat /tmp/tools_response.json | jq -r '.result.tools[] | "- \(.name): \(.description)"'

echo
echo "2. Testing health check tool..."

# Test health check (this will fail since VSCode extension isn't running)
echo '{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "debug_health_check", "arguments": {}}}' | node dist/index.js

echo
echo "3. Demo complete!"
echo
echo "To use this system:"
echo "1. Start VSCode and run 'Start Debugger MCP Server' command"
echo "2. Configure your AI assistant to use this MCP server"
echo "3. Use the 21 available debugging tools to control debugging sessions"
echo

cd ..
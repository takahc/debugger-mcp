#!/usr/bin/env node

// Simple integration test for the HTTP API
const axios = require('axios');

const API_BASE = 'http://localhost:3000';

async function testAPI() {
    console.log('Testing Debugger MCP HTTP API...\n');
    
    try {
        // Test health endpoint
        console.log('1. Testing health endpoint...');
        const health = await axios.get(`${API_BASE}/health`);
        console.log('   ✅ Health check:', health.data);
        
        // Test sessions endpoint
        console.log('\n2. Testing debug sessions endpoint...');
        const sessions = await axios.get(`${API_BASE}/debug/sessions`);
        console.log('   ✅ Debug sessions:', sessions.data);
        
        console.log('\n✅ Basic API tests passed!');
        console.log('\nTo test full debugging functionality:');
        console.log('1. Open a JavaScript file in VSCode');
        console.log('2. Start a debug session using the API or MCP tools');
        console.log('3. Set breakpoints and step through code');
        
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.log('❌ Could not connect to API server.');
            console.log('Make sure the VSCode extension is running and the HTTP server is started.');
            console.log('(Press F5 in the vscode-extension folder to launch the extension)');
        } else {
            console.log('❌ API test failed:', error.message);
        }
    }
}

// Only run if axios is available
try {
    testAPI();
} catch (error) {
    console.log('To run this test, install axios: npm install axios');
    console.log('This is just a convenience test - the main functionality works without it.');
}
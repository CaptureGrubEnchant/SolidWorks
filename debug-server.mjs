#!/usr/bin/env node

// Test script to debug SolidWorks MCP Server initialization
console.error('[DEBUG] Starting SolidWorks MCP Server debug test...');

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

console.error('[DEBUG] MCP SDK imported successfully');

try {
  // Test winax import
  console.error('[DEBUG] Attempting to import winax...');
  const winax = await import('winax');
  console.error('[DEBUG] Winax imported successfully');
  
  // Try to create ActiveX object
  console.error('[DEBUG] Testing ActiveX connection...');
  try {
    const { createActiveXObject } = winax.default || winax;
    console.error('[DEBUG] CreateActiveXObject function found');
    
    // Test actual SolidWorks connection
    console.error('[DEBUG] Attempting to connect to SolidWorks...');
    try {
      const swApp = createActiveXObject('SldWorks.Application');
      console.error('[DEBUG] SUCCESS: Connected to SolidWorks!');
      console.error('[DEBUG] SolidWorks is available');
    } catch (swError) {
      console.error('[DEBUG] WARNING: Could not connect to SolidWorks:', swError.message);
      console.error('[DEBUG] This might be because SolidWorks is not running or not installed');
    }
  } catch (axError) {
    console.error('[DEBUG] ActiveX error:', axError.message);
  }
} catch (winaxError) {
  console.error('[DEBUG] Winax import error:', winaxError.message);
  console.error('[DEBUG] This is likely the issue - winax module not properly built');
}

// Create a minimal MCP server
console.error('[DEBUG] Creating minimal MCP server...');

const server = new Server(
  {
    name: 'solidworks-debug',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Add a simple test tool using the correct schema
server.setRequestHandler(ListToolsRequestSchema, () => {
  console.error('[DEBUG] tools/list called');
  return {
    tools: [{
      name: 'test',
      description: 'Test tool - server is working',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    }]
  };
});

console.error('[DEBUG] Starting server with stdio transport...');

try {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('[DEBUG] Server started successfully, waiting for messages...');
} catch (serverError) {
  console.error('[DEBUG] Server startup error:', serverError.message);
  process.exit(1);
}

// Handle shutdown
process.on('SIGINT', () => {
  console.error('[DEBUG] Shutting down...');
  process.exit(0);
});
#!/usr/bin/env node
import { promises as fs } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

async function updateClaudeConfig() {
  // Skip in CI environments
  if (process.env.CI || process.env.GITHUB_ACTIONS) {
    console.log('⏭️  Skipping Claude Desktop setup in CI environment');
    return;
  }
  
  console.log('🔧 Setting up SolidWorks MCP Server for Claude Desktop...\n');
  
  // Find Claude config file
  const configPaths = [
    join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
    join(homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json'),
  ];
  
  let configPath = null;
  let config = {};
  
  for (const path of configPaths) {
    try {
      const content = await fs.readFile(path, 'utf-8');
      config = JSON.parse(content);
      configPath = path;
      console.log(`✅ Found Claude config at: ${path}`);
      break;
    } catch (e) {
      // Continue to next path
    }
  }
  
  if (!configPath) {
    console.log('❌ Could not find Claude Desktop configuration file.');
    console.log('\nPlease add the following to your Claude Desktop configuration manually:');
    console.log(JSON.stringify({
      mcpServers: {
        solidworks: {
          command: 'npx',
          args: ['mcp-server-solidworks-ts']
        }
      }
    }, null, 2));
    return;
  }
  
  // Update config
  if (!config.mcpServers) {
    config.mcpServers = {};
  }
  
  config.mcpServers.solidworks = {
    command: 'npx',
    args: ['mcp-server-solidworks-ts']
  };
  
  // Write back
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  console.log('✅ Updated Claude Desktop configuration');
  console.log('\n🎉 Installation complete! Please restart Claude Desktop.');
  console.log('\nYou can now use commands like:');
  console.log('  - "Open the part at C:/Models/example.sldprt"');
  console.log('  - "Generate VBA to batch export files"');
  console.log('  - "Create a 50mm extrusion"');
}

// Run setup
updateClaudeConfig().catch(console.error);
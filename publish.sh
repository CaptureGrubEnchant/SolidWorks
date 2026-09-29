#!/bin/bash

# SolidWorks MCP Server - NPM Publish Script

echo "📦 Preparing to publish SolidWorks MCP Server v2.0..."

# Ensure we're on the latest code
echo "→ Building project..."
npm run build

# Run tests
echo "→ Running tests..."
npm test

# Check if logged into npm
echo "→ Checking npm login..."
npm whoami &> /dev/null
if [ $? -ne 0 ]; then
    echo "❌ Not logged into npm. Please run: npm login"
    exit 1
fi

# Dry run to check what will be published
echo "→ Running npm publish dry-run..."
npm publish --dry-run

echo ""
echo "📋 Review the files above that will be published."
echo ""
read -p "Do you want to publish to npm? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "→ Publishing to npm..."
    npm publish --access public
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully published to npm!"
        echo ""
        echo "Package available at: https://www.npmjs.com/package/solidworks-mcp-server"
        echo ""
        echo "Users can now install with:"
        echo "  npm install -g solidworks-mcp-server"
    else
        echo "❌ Failed to publish to npm"
        exit 1
    fi
else
    echo "❌ Publishing cancelled"
    exit 0
fi
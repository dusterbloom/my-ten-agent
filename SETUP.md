# TEN Agent Setup Guide

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the setup script:
   ```bash
   npm run setup
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Open your browser to http://localhost:3000

## Architecture

This is a basic Node.js server that replaces the non-existent TEN framework packages with a working Express.js and WebSocket setup.

### Features
- Express.js REST API server
- WebSocket for real-time communication
- Extension loading system
- Web interface for monitoring extensions

### API Endpoints
- `GET /api/extensions` - List all loaded extensions
- `GET /api/health` - Health check endpoint
- WebSocket endpoint at `ws://localhost:3000`

### Extension Structure
Extensions are loaded from the `extensions/` directory. Each extension should have:
- `manifest.json` - Extension metadata
- `extension.py` - Python extension code

## Development

The server is designed to be simple and extensible. You can:
- Add new extensions by creating folders in `extensions/`
- Modify the web interface in `public/`
- Extend the API in `index.js`

## Environment Variables

Create a `.env` file from `.env.template` and configure your settings:
- `PORT` - Server port (default: 3000)
- Other extension-specific variables
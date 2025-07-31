#!/bin/bash

# TEN Agent Setup Script
# This script sets up all necessary dependencies for the TEN agent

set -e  # Exit on any error

echo "🚀 Starting TEN Agent setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Python 3.8+ is installed
echo "📋 Checking Python version..."
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed. Please install Python 3.8 or higher.${NC}"
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
echo -e "${GREEN}✅ Python $PYTHON_VERSION found${NC}"

# Check if Node.js is installed
echo "📋 Checking Node.js version..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 16 or higher.${NC}"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✅ Node.js $NODE_VERSION found${NC}"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed. Please install npm.${NC}"
    exit 1
fi

# Create virtual environment for Python dependencies
echo "🐍 Setting up Python virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo -e "${GREEN}✅ Virtual environment created${NC}"
else
    echo -e "${YELLOW}⚠️  Virtual environment already exists${NC}"
fi

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
echo "📦 Upgrading pip..."
pip install --upgrade pip

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip install livekit
pip install openai-whisper
pip install piper-tts
pip install aiohttp
pip install numpy

echo -e "${GREEN}✅ Python dependencies installed${NC}"

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

echo -e "${GREEN}✅ Node.js dependencies installed${NC}"

# Setup Ollama
echo "🦙 Setting up Ollama..."
if ! command -v ollama &> /dev/null; then
    echo -e "${YELLOW}⚠️  Ollama not found. Installing Ollama...${NC}"
    
    # Detect OS and install Ollama
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        curl -fsSL https://ollama.ai/install.sh | sh
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install ollama
        else
            echo -e "${RED}❌ Homebrew not found. Please install Ollama manually from https://ollama.ai${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ Unsupported OS. Please install Ollama manually from https://ollama.ai${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Ollama already installed${NC}"
fi

# Download default Ollama model
echo "📥 Downloading default Ollama model (llama3.2)..."
ollama pull llama3.2

echo -e "${GREEN}✅ Ollama model downloaded${NC}"

# Setup LiveKit server
echo "🎤 Setting up LiveKit server..."
if ! command -v livekit-server &> /dev/null; then
    echo -e "${YELLOW}⚠️  LiveKit server not found. Installing...${NC}"
    
    # Install LiveKit server
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        curl -sSL https://get.livekit.io | bash
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install livekit
        else
            echo -e "${RED}❌ Homebrew not found. Please install LiveKit manually${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ Unsupported OS. Please install LiveKit manually${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ LiveKit server already installed${NC}"
fi

# Create .env file if it doesn't exist
echo "⚙️  Creating .env file..."
if [ ! -f ".env" ]; then
    cp .env.template .env
    echo -e "${GREEN}✅ .env file created from template${NC}"
    echo -e "${YELLOW}⚠️  Please edit .env file with your actual configuration values${NC}"
else
    echo -e "${YELLOW}⚠️  .env file already exists${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Edit the .env file with your configuration"
echo "2. Start Ollama: ollama serve"
echo "3. Start LiveKit server: livekit-server --dev"
echo "4. Start the TEN agent: npm start"
echo ""
echo "For testing instructions, see README.md"
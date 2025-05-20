#!/bin/bash

# Clear any previous outputs
rm -rf test-outputs
mkdir -p test-outputs

# Ensure packages are installed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Build TypeScript code
echo "Building TypeScript code..."
npx tsc

# Check for API keys (either Anthropic or OpenAI)
if [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$OPENAI_API_KEY" ]; then
    echo "Neither ANTHROPIC_API_KEY nor OPENAI_API_KEY environment variables are set."
    echo "Please set one of them:"
    echo "For Anthropic (recommended): export ANTHROPIC_API_KEY=your_api_key"
    echo "For OpenAI: export OPENAI_API_KEY=your_api_key"
    exit 1
fi

# Initialize with Anthropic if ANTHROPIC_API_KEY is available
if [ ! -z "$ANTHROPIC_API_KEY" ]; then
    echo "Using Anthropic Claude model..."
    node dist/cli.js init --provider anthropic --api-key $ANTHROPIC_API_KEY
elif [ ! -z "$OPENAI_API_KEY" ]; then
    echo "Using OpenAI model..."
    node dist/cli.js init --provider openai --api-key $OPENAI_API_KEY
fi

# Run the test
echo "Starting Steelpush workflow test..."
node dist/test-steelpush.js

# If test completes successfully, show the results
if [ $? -eq 0 ]; then
    echo "Test completed successfully! Opening results..."
    
    # Open results files based on OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        open test-outputs/optimization-results.md
        open test-outputs/implementation
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        xdg-open test-outputs/optimization-results.md
        xdg-open test-outputs/implementation
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
        # Windows
        start test-outputs/optimization-results.md
        start test-outputs/implementation
    else
        echo "Results available in the test-outputs directory"
    fi
else
    echo "Test failed. Check the log file for details."
    exit 1
fi
#!/bin/bash

# Simple script to generate content variants from mock analysis data

echo "Steelpush: Content Variant Generator"
echo "==================================="

# Make sure TS-Node is installed
if ! command -v npx &> /dev/null; then
    echo "Error: npx is required but not installed. Please install Node.js."
    exit 1
fi

# Check if mock data exists
if [ ! -f "mock-website-analysis.json" ]; then
    echo "Error: mock-website-analysis.json not found. Please create it first."
    exit 1
fi

# Run the generator script
echo "Generating variants from mock data..."
npx ts-node --esm src/generate-variants.ts

# If successful, print success message
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Variant generation complete!"
    echo "Results saved to: website-variants.json"
    echo ""
    echo "You can view the results with:"
    echo "  cat website-variants.json | jq '.data.content'"
    echo "Or open it in your favorite editor"
fi 
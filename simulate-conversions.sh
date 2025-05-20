#!/bin/bash

# Script to simulate conversion rates for content variants

echo "Steelpush: Conversion Rate Simulator"
echo "==================================="

# Make sure TS-Node is installed
if ! command -v npx &> /dev/null; then
    echo "Error: npx is required but not installed. Please install Node.js."
    exit 1
fi

# Check if variants file exists
if [ ! -f "website-variants.json" ]; then
    echo "Error: website-variants.json not found."
    echo "Please run './generate-mock-variants.sh' first to generate content variants."
    exit 1
fi

# Run the simulator
echo "Simulating conversion rates for content variants..."
echo "This process uses AI to estimate how different variants perform with different user personas."

npx ts-node --esm src/simulator/simulate-conversions.ts

# Check if successful
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Conversion simulation complete!"
    echo "Results saved to: website-conversion-simulation.json"
    echo ""
    echo "The simulation has estimated how each content variant would affect conversion rates"
    echo "by testing against different user personas."
fi 
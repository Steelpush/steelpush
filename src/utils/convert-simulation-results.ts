#!/usr/bin/env ts-node

/**
 * Utility to convert website-conversion-simulation.json to the format expected by the results command
 * This bridges the gap between the older simulation format and the new CLI workflow
 */

import fs from 'fs';
import path from 'path';

// Check command line arguments
const inputFile = process.argv[2] || path.join(process.cwd(), 'website-conversion-simulation.json');
const outputFile = process.argv[3] || path.join(process.cwd(), 'converted-simulation-results.json');

// Validate input file
if (!fs.existsSync(inputFile)) {
  console.error(`Input file not found: ${inputFile}`);
  process.exit(1);
}

// Read and parse the simulation file
try {
  const simulationData = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
  
  // Get the content items with simulation results
  const contentItems = simulationData.data.content;
  
  if (!contentItems || !Array.isArray(contentItems)) {
    console.error('Invalid simulation data format');
    process.exit(1);
  }
  
  // Transform to the new format
  const elements = contentItems.map(item => {
    // Get simulation results
    const simResults = item.simulationResults || [];
    
    if (simResults.length === 0) {
      return null; // Skip items without simulation results
    }
    
    // Find the original content (first entry in simulation results)
    const original = {
      type: item.type,
      content: item.content,
      selector: item.location,
      context: item.url || ''
    };
    
    // Get variants (skip the first one which is the original)
    const variants = simResults.slice(1).map(sim => ({
      content: sim.variant,
      score: parseFloat(sim.improvement.replace('%', '')) / 100 + 0.5, // Convert to 0-1 scale
      reasoning: `Estimated to improve click rate from ${sim.clickRate}% to ${simResults[0].clickRate}% and conversion rate from ${sim.conversionRate}% to ${simResults[0].conversionRate}%`
    }));
    
    return {
      original,
      variants
    };
  }).filter(Boolean); // Remove null entries
  
  // Create the output structure
  const outputData = {
    source: simulationData.source,
    timestamp: Date.now(),
    originalAnalysis: inputFile,
    elements
  };
  
  // Write the converted file
  fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
  
  console.log(`Successfully converted simulation results to: ${outputFile}`);
  console.log(`Processed ${elements.length} content elements with variants`);
  
} catch (error) {
  console.error(`Error converting simulation results:`, error);
  process.exit(1);
}
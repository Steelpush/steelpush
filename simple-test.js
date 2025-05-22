#!/usr/bin/env node

/**
 * Simple test script to scan a website and generate analysis without using TypeScript
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const TARGET_WEBSITE = 'https://usetrag.com';
const OUTPUT_DIR = path.join(__dirname, 'test-outputs');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'website-analysis.json');

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Print status message
console.log('Starting simple website analysis test...');
console.log(`Target website: ${TARGET_WEBSITE}`);
console.log(`Output file: ${OUTPUT_FILE}`);

// Run the scan command directly
try {
  console.log('\nRunning website analysis...');
  
  // Use Anthropic model if API key is available
  if (process.env.ANTHROPIC_API_KEY) {
    console.log('Using Anthropic Claude model');
    // Initialize steelpush with Anthropic - scan 3 pages
    execSync(`node src/analyze-usetrag-direct.js "${TARGET_WEBSITE}" "${OUTPUT_FILE}" 3`, 
      { stdio: 'inherit' });
  } else if (process.env.OPENAI_API_KEY) {
    console.log('Using OpenAI model');
    // Initialize steelpush with OpenAI - scan 3 pages
    execSync(`node src/analyze-usetrag-direct.js "${TARGET_WEBSITE}" "${OUTPUT_FILE}" 3`, 
      { stdio: 'inherit' });
  } else {
    console.error('ERROR: Neither ANTHROPIC_API_KEY nor OPENAI_API_KEY is set');
    process.exit(1);
  }
  
  // Check if analysis was successful
  if (fs.existsSync(OUTPUT_FILE)) {
    console.log('\nAnalysis completed successfully!');
    console.log(`Results saved to ${OUTPUT_FILE}`);
    
    // Read the analysis file and show summary
    const analysis = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
    const pageCount = analysis.data.pages?.length || 0;
    const elementCount = analysis.data.pages?.reduce((sum, page) => 
      sum + (page.optimizableElements?.length || 0), 0) || 0;
    
    console.log('\nAnalysis summary:');
    console.log(`- Pages analyzed: ${pageCount}`);
    console.log(`- Optimizable elements found: ${elementCount}`);
    
    // Show first few elements if available
    if (elementCount > 0) {
      console.log('\nSample optimization opportunities:');
      
      // Find first page with optimizable elements
      const firstPageWithElements = analysis.data.pages.find(page => 
        page.optimizableElements && page.optimizableElements.length > 0);
      
      if (firstPageWithElements) {
        const elements = firstPageWithElements.optimizableElements.slice(0, 3);
        elements.forEach(element => {
          console.log(`- ${element.type}: "${element.content.substring(0, 50)}..."`);
          if (element.issue) {
            console.log(`  Issue: ${element.issue}`);
          }
          if (element.recommendation) {
            console.log(`  Recommendation: ${element.recommendation}`);
          }
        });
      }
    }
    
    process.exit(0);
  } else {
    console.error('\nERROR: Analysis failed, output file not created');
    process.exit(1);
  }
} catch (error) {
  console.error('\nERROR: Analysis failed with error:', error.message);
  process.exit(1);
}
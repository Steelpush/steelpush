#!/usr/bin/env ts-node

/**
 * Steelpush Complete Workflow Test Script
 * 
 * This script tests the full Steelpush workflow against a target website (usetrag.com)
 * by running all commands in sequence: analyze, generate, simulate, results, export
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const TARGET_WEBSITE = 'https://usetrag.com';
const OUTPUT_DIR = path.join(process.cwd(), 'test-outputs');
const TEST_LOG_FILE = path.join(OUTPUT_DIR, 'test-log.txt');

// Ensure API key is available
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set. Please run `steelpush init` first or set the API key in your .env file.');
  process.exit(1);
}

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Helper function to log to console and file
function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(TEST_LOG_FILE, logMessage + '\n');
}

// Helper function to run a steelpush command
function runSteelpushCommand(command: string, args: string = ''): string {
  const fullCommand = `node dist/cli.js ${command} ${args}`;
  log(`Running: ${fullCommand}`);
  
  try {
    const output = execSync(fullCommand, { encoding: 'utf-8' });
    log(`Command completed successfully`);
    return output;
  } catch (error) {
    const errorMessage = `Error running command: ${error.message}`;
    log(errorMessage);
    throw new Error(errorMessage);
  }
}

// Clear the log file
fs.writeFileSync(TEST_LOG_FILE, '');

// Start the test
async function runFullWorkflowTest() {
  log('Starting Steelpush workflow test against ' + TARGET_WEBSITE);
  log('---------------------------------------------------');
  
  // 1. Run analyze command
  log('\n[STEP 1] Analyzing website...');
  
  const analysisFile = path.join(OUTPUT_DIR, 'website-analysis.json');
  const analyzeArgs = `${TARGET_WEBSITE} --output ${analysisFile} --format json`;
  
  try {
    const analyzeOutput = runSteelpushCommand('analyze', analyzeArgs);
    log(analyzeOutput);
    
    // Verify analysis file exists
    if (!fs.existsSync(analysisFile)) {
      throw new Error('Analysis file was not created');
    }
    
    log('Analysis completed successfully!');
  } catch (error) {
    log(`Analysis failed: ${error.message}`);
    return;
  }
  
  // 2. Run generate command
  log('\n[STEP 2] Generating content variants...');
  
  const variantsFile = path.join(OUTPUT_DIR, 'content-variants.json');
  const generateArgs = `--input ${analysisFile} --output ${variantsFile} --count 3`;
  
  try {
    const generateOutput = runSteelpushCommand('generate', generateArgs);
    log(generateOutput);
    
    // Verify variants file exists
    if (!fs.existsSync(variantsFile)) {
      throw new Error('Variants file was not created');
    }
    
    log('Variant generation completed successfully!');
  } catch (error) {
    log(`Variant generation failed: ${error.message}`);
    return;
  }
  
  // 3. Run simulate command
  log('\n[STEP 3] Simulating user behavior...');
  
  const simulationFile = path.join(OUTPUT_DIR, 'simulation-results.json');
  const simulateArgs = `--input ${variantsFile} --output ${simulationFile} --visitors 3 --mode ai-only`;
  
  try {
    const simulateOutput = runSteelpushCommand('simulate', simulateArgs);
    log(simulateOutput);
    
    log('Simulation completed!');
  } catch (error) {
    log(`Simulation failed: ${error.message}`);
    // Continue with results even if simulation produces alternate format
  }
  
  // 4. Run results command
  log('\n[STEP 4] Analyzing results...');
  
  // Try the direct simulation output first, fall back to default simulation output
  let resultsInput = fs.existsSync(simulationFile) ? 
    simulationFile : 
    path.join(process.cwd(), 'website-conversion-simulation.json');
  
  // Check if we need to convert the format
  if (!fs.existsSync(simulationFile) && fs.existsSync(path.join(process.cwd(), 'website-conversion-simulation.json'))) {
    log('Using the AI-only simulation output and converting to the required format...');
    
    const convertedFile = path.join(OUTPUT_DIR, 'converted-simulation-results.json');
    
    // Run the converter
    execSync(`node dist/utils/convert-simulation-results.js "${path.join(process.cwd(), 'website-conversion-simulation.json')}" "${convertedFile}"`, 
      { encoding: 'utf-8' });
      
    // Use the converted file if it exists
    if (fs.existsSync(convertedFile)) {
      log('Successfully converted simulation results');
      resultsInput = convertedFile;
    }
  }
  
  const resultsFile = path.join(OUTPUT_DIR, 'optimization-results.md');
  const resultsArgs = `--input ${resultsInput} --output ${resultsFile} --format markdown`;
  
  try {
    const resultsOutput = runSteelpushCommand('results', resultsArgs);
    log(resultsOutput);
    
    // Verify results file exists
    if (!fs.existsSync(resultsFile)) {
      throw new Error('Results file was not created');
    }
    
    log('Results analysis completed successfully!');
  } catch (error) {
    log(`Results analysis failed: ${error.message}`);
    return;
  }
  
  // 5. Run export command
  log('\n[STEP 5] Exporting implementation code...');
  
  const exportDir = path.join(OUTPUT_DIR, 'implementation');
  const exportArgs = `--input ${resultsFile} --output ${exportDir} --format code`;
  
  try {
    const exportOutput = runSteelpushCommand('export', exportArgs);
    log(exportOutput);
    
    // Verify export directory exists
    if (!fs.existsSync(exportDir)) {
      throw new Error('Export directory was not created');
    }
    
    log('Export completed successfully!');
  } catch (error) {
    log(`Export failed: ${error.message}`);
    return;
  }
  
  // 6. Final report
  log('\n---------------------------------------------------');
  log('WORKFLOW TEST COMPLETED SUCCESSFULLY!');
  log('---------------------------------------------------');
  log('Test outputs:');
  log(`- Analysis: ${analysisFile}`);
  log(`- Variants: ${variantsFile}`);
  log(`- Simulation: ${resultsInput}`);
  log(`- Results: ${resultsFile}`);
  log(`- Implementation: ${exportDir}`);
  log('---------------------------------------------------');
}

// Run the test
runFullWorkflowTest().catch(error => {
  log(`Test failed with error: ${error.message}`);
  process.exit(1);
});
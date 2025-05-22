/**
 * Steelpush - AI-Powered Website Optimization Tool
 * Main entry point for the package
 */

import { scan, scanWebsite, scanCodebase } from './scanner/index.js';
import { analyzeWebsite } from './analyzer/index.js';
import { generateVariants } from './generators/index.js';
import { simulateTraffic } from './simulator/index.js';
import { exportContent, createOptimizationReport } from './exporter/index.js';
import { config } from './config.js';

// Version from package.json
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));

// Export public API
export {
  // Core scanning functionality
  scan,
  scanWebsite,
  scanCodebase,
  
  // Analysis functionality
  analyzeWebsite,
  
  // Content generation
  generateVariants,
  
  // Simulation
  simulateTraffic,
  
  // Export functionality
  exportContent,
  createOptimizationReport,
  
  // Configuration
  config,
  
  // Version
  version: packageJson.version
};

// Default export
export default {
  scan,
  scanWebsite,
  scanCodebase,
  analyzeWebsite,
  generateVariants,
  simulateTraffic,
  exportContent,
  createOptimizationReport,
  config,
  version: packageJson.version
};
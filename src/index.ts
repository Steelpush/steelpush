/**
 * Steelpush - AI-Powered Website Optimization Tool
 * Main entry point for the package
 */

import { scan, scanWebsite, scanCodebase } from './scanner/index';
import { analyzeWebsite } from './analyzer/index';
import { generateVariants } from './generators/index';
import { simulateTraffic } from './simulator/index';
import { exportContentToJson, exportContentToMarkdown, createOptimizationReport } from './exporter/index';
import { config } from './config';

// Version from package.json
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));

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
  exportContentToJson,
  exportContentToMarkdown,
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
  exportContentToJson,
  exportContentToMarkdown,
  createOptimizationReport,
  config,
  version: packageJson.version
};
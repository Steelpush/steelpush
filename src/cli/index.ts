#!/usr/bin/env node

/**
 * Steelpush CLI
 * AI-powered website optimization tool
 */

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  initCommand, 
  analyzeCommand, 
  generateCommand,
  simulateCommand,
  resultsCommand,
  exportCommand 
} from '../commands';

// Set up paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.join(__dirname, '../../package.json');

// Load package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

// Set up the CLI program
const program = new Command();
program
  .name('steelpush')
  .description('AI-powered website optimization tool')
  .version(packageJson.version);

// Add commands
initCommand(program);
analyzeCommand(program);

// TODO: Enable these commands once they're fully implemented
// generateCommand(program);
// simulateCommand(program);
// resultsCommand(program);
// exportCommand(program);

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
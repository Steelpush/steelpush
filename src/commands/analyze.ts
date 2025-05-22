/**
 * Analyze command implementation
 */

import { Command } from 'commander';
import fs from 'fs';
import { scanWebsiteAdvanced } from '../scanner/advanced-scanner';
import { scanCodebase } from '../scanner/codebase-scanner';
import { exportContentToJson, exportContentToMarkdown, exportContentToCsv } from '../exporter';
import { loadConfig } from '../utils/config';

export function analyzeCommand(program: Command): Command {
  return program
    .command('analyze <target>')
    .description('Analyze a website or codebase for optimization opportunities')
    .option('-o, --output <path>', 'Output file path')
    .option('-f, --format <format>', 'Output format (json, markdown, csv)', 'json')
    .option('-m, --max-pages <number>', 'Maximum number of pages to scan', '3')
    .option('-d, --max-depth <number>', 'Maximum link depth to crawl', '2')
    .option('--screenshots <dir>', 'Screenshots directory', 'screenshots')
    .option('--no-headless', 'Show browser during scanning')
    .action(async (target, options) => {
      console.log(`Analyzing ${target}...`);
      
      // Check if config exists
      const config = loadConfig();
      if (!config) {
        console.error("Steelpush not initialized. Run 'steelpush init' first.");
        process.exit(1);
      }
      
      try {
        // Determine if target is a URL or file path
        const isUrl = target.startsWith('http://') || target.startsWith('https://');
        
        let result;
        if (isUrl) {
          // Scan website
          result = await scanWebsiteAdvanced(target, {
            maxPages: parseInt(options.maxPages),
            maxDepth: parseInt(options.maxDepth),
            headless: options.headless !== false,
            screenshotsDir: options.screenshots
          });
        } else {
          // Scan codebase
          result = await scanCodebase(target);
        }
        
        // Determine output path
        const outputPath = options.output || `steelpush-analysis-${Date.now()}.${options.format}`;
        
        // Export results
        switch (options.format) {
          case 'markdown':
            await exportContentToMarkdown(result, outputPath);
            break;
          case 'csv':
            await exportContentToCsv(result, outputPath);
            break;
          case 'json':
          default:
            await exportContentToJson(result, outputPath);
            break;
        }
        
        console.log(`\nAnalysis complete!`);
        console.log(`Results saved to ${outputPath}`);
        
        // Output summary stats
        if (result.type === 'website') {
          const pageCount = result.data.pages.length;
          const elementCount = result.data.pages.reduce(
            (sum, page) => sum + (page.optimizableElements?.length || 0), 
            0
          );
          
          console.log(`\nAnalyzed ${pageCount} pages`);
          console.log(`Found ${elementCount} optimizable elements`);
          
          // Show a few examples of optimizable elements
          if (elementCount > 0) {
            const firstPage = result.data.pages.find(page => 
              page.optimizableElements && page.optimizableElements.length > 0
            );
            
            if (firstPage && firstPage.optimizableElements.length > 0) {
              console.log(`\nSample optimization opportunities:`);
              
              for (let i = 0; i < Math.min(3, firstPage.optimizableElements.length); i++) {
                const element = firstPage.optimizableElements[i];
                console.log(`- ${element.type}: "${element.content.substring(0, 50)}${element.content.length > 50 ? '...' : ''}"`);
                console.log(`  Issue: ${element.issue}`);
                console.log(`  Recommendation: ${element.recommendation}`);
              }
            }
          }
        }
      } catch (error) {
        console.error('Analysis failed:', error);
        process.exit(1);
      }
    });
}
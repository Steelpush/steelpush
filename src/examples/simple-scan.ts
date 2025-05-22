/**
 * Simple example of using Steelpush to scan a website
 */

import { scanWebsiteAdvanced } from '../scanner/advanced-scanner';

// Use environment variables for API keys
if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
  console.error('Error: Set either ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable');
  process.exit(1);
}

// Get the target URL from command line args or use default
const targetUrl = process.argv[2] || 'https://usetrag.com';

async function runExample() {
  console.log(`Scanning ${targetUrl}...`);
  
  try {
    // Run the scan
    const result = await scanWebsiteAdvanced(targetUrl, {
      maxPages: 3,
      maxDepth: 2,
      headless: true, // Run headless
    });
    
    // Print some stats
    const pageCount = result.data.pages.length;
    const elementCount = result.data.pages.reduce(
      (sum, page) => sum + (page.optimizableElements?.length || 0), 
      0
    );
    
    console.log(`\nScan complete!`);
    console.log(`Analyzed ${pageCount} pages`);
    console.log(`Found ${elementCount} optimizable elements`);
    
    // Show a few example findings
    if (elementCount > 0) {
      console.log('\nSample optimization opportunities:');
      
      // Find first page with elements
      const firstPage = result.data.pages.find(page => 
        page.optimizableElements && page.optimizableElements.length > 0
      );
      
      if (firstPage && firstPage.optimizableElements.length > 0) {
        // Show up to 3 elements
        for (let i = 0; i < Math.min(3, firstPage.optimizableElements.length); i++) {
          const element = firstPage.optimizableElements[i];
          console.log(`- ${element.type}: "${element.content.substring(0, 50)}${element.content.length > 50 ? '...' : ''}"`);
          console.log(`  Issue: ${element.issue}`);
          console.log(`  Recommendation: ${element.recommendation}`);
        }
      }
    }
    
    // Save the result to a file
    const fs = await import('fs');
    const outputFile = 'scan-result.json';
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`\nFull results saved to ${outputFile}`);
    
  } catch (error) {
    console.error('Scan failed:', error);
  }
}

// Run the example
runExample();
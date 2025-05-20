import { chromium } from "playwright";
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { MCPClient } from "@mastra/mcp";

// Load environment variables
dotenv.config();

/**
 * A simpler, more reliable MCP website scanner that avoids complexity
 */
async function scanWebsiteMini(url: string) {
  console.log(`Starting mini MCP website scan for: ${url}`);
  const startTime = Date.now();
  
  // Create output directory for screenshots
  const screenshotDir = path.join(process.cwd(), "screenshots");
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
  
  // Launch a browser instance with reliability settings
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-web-security', '--disable-features=IsolateOrigins', '--disable-site-isolation-trials']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
    ignoreHTTPSErrors: true,
    bypassCSP: true,
  });
  
  const page = await context.newPage();
  
  // State variables
  const visitedPages = [url];
  const contentItems = [];
  
  // Progress tracking
  const logFile = path.join(screenshotDir, "mini-scan.log");
  let progressLog = `Mini MCP scan started at ${new Date().toISOString()}\n`;
  
  const logProgress = (message: string) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    progressLog += logMessage + "\n";
    fs.writeFileSync(logFile, progressLog);
  };
  
  try {
    // Setup MCP client
    logProgress("Setting up MCP client...");
    const mcpClient = new MCPClient({
      servers: {
        sequential: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
        },
        playwright: {
          command: "npx",
          args: ["-y", "@playwright/mcp@latest"],
        },
      },
    });
    
    // Get MCP tools
    logProgress("Fetching MCP tools...");
    const mcpTools = await mcpClient.getTools();
    logProgress("MCP tools retrieved successfully");
    
    // Determine which AI model to use
    const useOpenAI = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 0;
    const modelType = process.env.OPENAI_MODEL || "gpt-4o-mini"; // Default to o-mini for faster analysis
    const modelProvider = useOpenAI 
      ? openai(modelType)
      : anthropic("claude-3-haiku-20240307"); // Use faster Anthropic model
      
    logProgress(`Using model: ${useOpenAI ? modelType : "claude-3-haiku-20240307"}`);
    
    // Navigation handling with retry
    logProgress(`Navigating to ${url}`);
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
    } catch (navError) {
      logProgress(`Navigation error: ${navError}. Trying again with networkidle...`);
      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: 60000,
      });
    }
    
    // Manual scroll to load lazy content
    logProgress("Scrolling through page...");
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            window.scrollTo(0, 0); // Scroll back to top
            resolve();
          }
        }, 100);
      });
    });
    
    // Take screenshots
    const initialScreenshot = path.join(screenshotDir, "mini-initial.png");
    await page.screenshot({ path: initialScreenshot, fullPage: true });
    logProgress(`Initial screenshot saved to ${initialScreenshot}`);
    
    // Create agent with access to MCP tools
    const agent = new Agent({
      name: "mini-mcp-scanner",
      instructions: `
        Analyze this website page for conversion optimization opportunities.
        Find 3-5 specific elements that could be improved for better conversion.
        
        First take a screenshot, then scroll through the page to see all content.
        
        For each opportunity, document:
        - Element type (headline, CTA, form, etc.)
        - Location on page
        - Current content 
        - The specific issue
        - A clear recommendation
        
        Return your findings as a JSON array with these fields:
        - url: The page URL
        - type: Element type (heading, cta, etc.)
        - content: Current text content
        - location: Where on the page
        - importance: high/medium/low
        - optimizationPotential: high/medium/low
        - issue: Problem description
        - recommendation: Suggested improvement
      `,
      model: modelProvider,
      tools: mcpTools,
    });
    
    // Use timeout for agent generation
    logProgress("Starting page analysis...");
    const maxAnalysisTime = 60000; // 60 seconds timeout
    
    let result: {
      text?: string;
      toolCalls?: any[];
    };
    try {
      result = await Promise.race([
        agent.generate([{
          role: "user",
          content: `
            Analyze this webpage for conversion optimization opportunities.
            
            First, take a screenshot to see the current page.
            Then scroll through the ENTIRE page to see all content.
            Identify 3-5 elements that could be improved for better conversion.
            
            For each element include:
            - What it is (headline, CTA, form, etc.)
            - Where it's located on the page
            - The current content (quote it exactly)
            - What's wrong with it
            - How to improve it
            
            Return your findings as a JSON array in this format:
            
            [
              {
                "url": "${url}",
                "type": "heading", 
                "content": "Current content text",
                "location": "hero section",
                "importance": "high",
                "optimizationPotential": "high",
                "issue": "The issue with the content",
                "recommendation": "How to improve it"
              }
            ]
          `
        }]),
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Analysis timed out after ${maxAnalysisTime/1000} seconds`));
          }, maxAnalysisTime);
        })
      ]);
      
      logProgress("Received agent response");
    } catch (analysisError) {
      logProgress(`Analysis error: ${analysisError}`);
      const errorScreenshot = path.join(screenshotDir, "mini-error.png");
      await page.screenshot({ path: errorScreenshot });
      throw analysisError;
    }
    
    // Take final screenshot
    const finalScreenshot = path.join(screenshotDir, "mini-final.png");
    await page.screenshot({ path: finalScreenshot, fullPage: true });
    logProgress(`Final screenshot saved to ${finalScreenshot}`);
    
    // Process agent response
    let opportunities = [];
    
    // Save the agent's response for debugging
    fs.writeFileSync(
      path.join(screenshotDir, "mini-response.txt"),
      result.text || "No response"
    );
    
    if (result.text) {
      // Try to extract JSON content
      const jsonMatches = result.text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ||
                         result.text.match(/\[\s*\{\s*"[^"]+"\s*:/);
      
      if (jsonMatches) {
        try {
          // Parse the JSON content
          let jsonText;
          if (jsonMatches[0].startsWith('[')) {
            // For raw JSON starting with array
            let bracketCount = 0;
            let endIndex = 0;
            
            for (let i = 0; i < result.text.length; i++) {
              if (result.text[i] === '[') bracketCount++;
              else if (result.text[i] === ']') bracketCount--;
              
              if (bracketCount === 0 && i > 0) {
                endIndex = i + 1;
                break;
              }
            }
            
            jsonText = result.text.substring(result.text.indexOf('['), endIndex);
          } else {
            // For code block
            jsonText = jsonMatches[1].trim();
          }
          
          const items = JSON.parse(jsonText);
          if (Array.isArray(items)) {
            opportunities = items;
            logProgress(`Extracted ${opportunities.length} opportunities from JSON`);
          }
        } catch (e) {
          logProgress(`Error parsing JSON: ${e}`);
        }
      } else {
        // Try to extract from text if no JSON was found
        logProgress("No JSON found, extracting from text...");
        
        // Look for numbered items that might be recommendations
        const lines = result.text.split('\n');
        let currentItem = null;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          // Look for numbered points or headers that indicate new items
          if (/^\d+\.\s+|^\**\s*[A-Z][a-zA-Z\s]+:/.test(line)) {
            // Save previous item if it exists
            if (currentItem) {
              opportunities.push(currentItem);
            }
            
            // Start new item
            currentItem = {
              url,
              type: 'unknown',
              content: line,
              location: 'page',
              importance: 'medium',
              optimizationPotential: 'medium',
              issue: '',
              recommendation: ''
            };
            
            // Try to determine type
            if (/head(er|ing)|title/i.test(line)) {
              currentItem.type = 'heading';
            } else if (/button|cta|call to action/i.test(line)) {
              currentItem.type = 'cta';
            } else if (/form|input/i.test(line)) {
              currentItem.type = 'form';
            }
          } 
          // Add content to current item
          else if (currentItem) {
            // Try to identify different parts based on keywords
            if (/location|where|found|appears/i.test(line)) {
              currentItem.location = line.replace(/^.*?:\s*/, '');
            } else if (/content|text|says|reads/i.test(line)) {
              currentItem.content = line.replace(/^.*?:\s*/, '');
            } else if (/issue|problem|weakness/i.test(line)) {
              currentItem.issue = line.replace(/^.*?:\s*/, '');
            } else if (/recommend|suggest|improve|better/i.test(line)) {
              currentItem.recommendation = line.replace(/^.*?:\s*/, '');
            } else if (/priority|importance|high|medium|low/i.test(line)) {
              if (/high/i.test(line)) {
                currentItem.importance = 'high';
                currentItem.optimizationPotential = 'high';
              } else if (/medium/i.test(line)) {
                currentItem.importance = 'medium';
              } else if (/low/i.test(line)) {
                currentItem.importance = 'low';
              }
            }
          }
        }
        
        // Add the last item if it exists
        if (currentItem) {
          opportunities.push(currentItem);
        }
        
        logProgress(`Extracted ${opportunities.length} opportunities from text`);
      }
    }
    
    // Clean up MCP client
    await mcpClient.disconnect();
    
    // If no opportunities were found, create fallback item
    if (opportunities.length === 0) {
      opportunities = [{
        url,
        type: "feedback",
        content: "Analysis completed but no structured results were generated",
        location: "general",
        importance: "medium",
        optimizationPotential: "medium"
      }];
    }
    
    // Return the results
    return {
      baseUrl: url,
      scannedPages: visitedPages,
      content: opportunities,
      metadata: {
        scanDuration: Date.now() - startTime,
        pageCount: visitedPages.length,
        contentCount: opportunities.length
      }
    };
  } catch (error) {
    logProgress(`Mini MCP scan failed: ${error}`);
    throw error;
  } finally {
    // Clean up browser
    browser.close();
  }
}

async function main() {
  try {
    // Target URL (can be customized)
    const defaultUrl = "https://developer.mozilla.org/en-US/"; // MDN has rich content to analyze
    
    // Allow command line argument for URL
    const url = process.argv[2] || defaultUrl;
    
    console.log(`Starting mini website analysis for ${url}`);

    // Run the mini scanner
    const result = await scanWebsiteMini(url);

    // Save results to file
    const outputPath = path.join(process.cwd(), "usetrag-mini-analysis.json");
    fs.writeFileSync(outputPath, JSON.stringify({
      type: "website",
      source: url,
      timestamp: Date.now(),
      data: result
    }, null, 2));

    console.log(`\nMini Analysis completed successfully!`);
    console.log(`Results saved to: ${outputPath}`);

    // Print summary
    console.log(`\nSummary:`);
    console.log(`- Scanned ${result.scannedPages.length} pages`);
    console.log(`- Found ${result.content.length} content items`);
    console.log(
      `- Scan duration: ${Math.round(result.metadata.scanDuration / 1000)} seconds`
    );

    // Print content items
    if (result.content.length > 0) {
      console.log(`\nOptimization Opportunities:`);

      // Group by importance
      const highPriorityItems = result.content.filter(
        (item) => item.importance === "high"
      );

      const mediumPriorityItems = result.content.filter(
        (item) => item.importance === "medium"
      );

      const lowPriorityItems = result.content.filter(
        (item) => item.importance === "low"
      );

      // Display high priority items first
      if (highPriorityItems.length > 0) {
        console.log(`\n🔴 HIGH PRIORITY ITEMS (${highPriorityItems.length}):`);
        highPriorityItems.forEach((item, i) => {
          console.log(
            `\n${i + 1}. ${item.type.toUpperCase()} (${item.location})`
          );
          console.log(`   URL: ${item.url}`);
          console.log(`   Content: "${item.content}"`);
          if (item.issue) console.log(`   Issue: ${item.issue}`);
          if (item.recommendation) console.log(`   Recommendation: ${item.recommendation}`);
        });
      }

      // Display medium priority items
      if (mediumPriorityItems.length > 0) {
        console.log(
          `\n🟠 MEDIUM PRIORITY ITEMS (${mediumPriorityItems.length}):`
        );
        mediumPriorityItems.slice(0, 3).forEach((item, i) => {
          console.log(
            `\n${i + 1}. ${item.type.toUpperCase()} (${item.location})`
          );
          console.log(`   URL: ${item.url}`);
          console.log(`   Content: "${item.content}"`);
          if (item.issue) console.log(`   Issue: ${item.issue}`);
          if (item.recommendation) console.log(`   Recommendation: ${item.recommendation}`);
        });

        if (mediumPriorityItems.length > 3) {
          console.log(
            `\n... and ${mediumPriorityItems.length - 3} more medium priority items.`
          );
        }
      }

      // Just mention low priority items
      if (lowPriorityItems.length > 0) {
        console.log(
          `\n🟢 ${lowPriorityItems.length} LOW PRIORITY ITEMS found (not shown)`
        );
      }

      console.log(`\nFull analysis saved to: ${outputPath}`);
      console.log(`\nScreenshots saved to: ${path.join(process.cwd(), "screenshots")}`);
    }
  } catch (error) {
    console.error("Mini Analysis failed:", error);
  }
}

main();
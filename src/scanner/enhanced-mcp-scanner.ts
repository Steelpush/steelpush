import { chromium, Browser, BrowserContext, Page } from "playwright";
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { config } from "../config";
import { WebsiteContent, WebsiteScanResult } from "./website-scanner";
import { MCPClient } from "@mastra/mcp";
import fs from "fs";
import path from "path";

/**
 * Enhanced MCP website scanner with improved interactivity and navigation
 * 
 * Features:
 * - Multi-page navigation (with breadth-first exploration)
 * - Deep scrolling with content observation
 * - Form interaction capabilities
 * - Click-based exploration
 * - Element extraction
 * - Structured data processing
 */
export async function scanWebsiteWithEnhancedMcp(
  url: string,
  options: {
    maxPages?: number;
    maxDepth?: number;
    screenshotDir?: string;
    headless?: boolean;
    timeout?: number;
    maxTurns?: number;
  } = {}
): Promise<WebsiteScanResult> {
  console.log(`Starting enhanced MCP website scan for: ${url}`);
  const startTime = Date.now();
  
  // Setup options with defaults
  const {
    maxPages = 5,
    maxDepth = 2,
    screenshotDir = path.join(process.cwd(), "screenshots"),
    headless = true,
    timeout = 180000, // 3 minutes
    maxTurns = 5      // Maximum conversation turns
  } = options;
  
  // Create output directory for screenshots if it doesn't exist
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
  
  // Launch browser with more reliable settings
  const browser = await chromium.launch({
    headless,
    slowMo: headless ? 0 : 300, // Slow down for visible execution
    args: ['--disable-web-security', '--disable-features=IsolateOrigins', '--disable-site-isolation-trials']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
    ignoreHTTPSErrors: true,
    bypassCSP: true,
    // Add additional context options (like geolocation, permissions, etc. if needed)
  });
  
  const page = await context.newPage();
  
  // State tracking
  const visitedPages: string[] = [];
  const contentItems: WebsiteContent[] = [];
  const pagesToVisit: {url: string; depth: number}[] = [{url, depth: 0}];
  
  // Logs and progress tracking
  const logFile = path.join(screenshotDir, "enhanced-scan.log");
  let progressLog = `Enhanced MCP scan started at ${new Date().toISOString()}\n`;
  
  const logProgress = (message: string) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    progressLog += logMessage + "\n";
    
    // Write to log file
    try {
      fs.writeFileSync(logFile, progressLog);
    } catch (e) {
      // Ignore write errors
    }
  };
  
  // Helper function to take screenshots
  const takeScreenshot = async (name: string) => {
    try {
      const screenshotPath = path.join(screenshotDir, `${name}-${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      logProgress(`Screenshot saved to ${screenshotPath}`);
      return screenshotPath;
    } catch (e) {
      logProgress(`Failed to take screenshot: ${e}`);
      return null;
    }
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
    
    // Determine which AI model to use based on available API keys
    const useOpenAI = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 0;
    const modelProvider = useOpenAI 
      ? openai(process.env.OPENAI_MODEL || "gpt-4o")
      : anthropic(config.analysis.modelName || "claude-3-7-sonnet-20240229");
    
    logProgress(`Using model: ${useOpenAI ? (process.env.OPENAI_MODEL || "gpt-4o") : config.analysis.modelName}`);
    
    // Create enhanced agent with improved instructions
    const agent = new Agent({
      name: "enhanced-mcp-website-analyzer",
      instructions: `You are an expert website conversion optimizer and content analyzer with browser control capabilities.
        
        YOUR GOAL: Thoroughly explore the website, interact with its elements, and identify optimization opportunities.
        
        EXPLORATION APPROACH:
        1. Start with the main page and analyze it in detail
        2. ALWAYS scroll through the entire page content (this is critical!)
        3. Click on important navigation elements to explore key pages
        4. If forms exist, inspect them for usability issues
        5. Navigate back to previous pages when needed
        6. Take screenshots to document key findings
        
        INTERACTION CAPABILITIES - USE THESE EXTENSIVELY:
        - Use browser_scroll_down/up to see all content on a page
        - Use browser_navigate to move to new pages
        - Use browser_back to return to previous pages
        - Use browser_take_screenshot to capture important elements
        - Use browser_click to interact with elements
        - Use browser_extract_text to extract content from specific elements
        
        ANALYZE THESE KEY ELEMENTS:
        - Headlines: Are they clear, compelling, benefit-focused?
        - CTAs and Buttons: Are they clear, action-oriented, well-placed?
        - Value propositions: Are they differentiated and persuasive?
        - Forms: Are they simple, focused, with clear labels?
        - Navigation: Is it intuitive and well-structured?
        - Social proof: Are testimonials and trust indicators effective?
        - Mobile responsiveness: Does the page work well on different sizes?
        
        DOCUMENT EACH OPTIMIZATION OPPORTUNITY WITH:
        - The exact URL
        - Element location on the page
        - Current content (exact text)
        - The specific issue
        - A clear recommendation for improvement
        - Priority level (high/medium/low)
        
        YOUR RESPONSE FORMAT:
        - Structure your analysis as a JSON array of optimization opportunities
        - Include specific details for each issue
        - Rate importance and optimization potential for prioritization
        
        JSON SCHEMA:
        [{
          "url": "exact-page-url",
          "type": "element-type", // heading, cta, form, image, etc.
          "content": "current content",
          "location": "where-on-page",
          "importance": "high|medium|low",
          "optimizationPotential": "high|medium|low",
          "issue": "description of the problem",
          "recommendation": "specific improvement suggestion"
        }]
      `,
      model: modelProvider,
      tools: mcpTools,
    });
    
    // Website exploration and analysis
    let pagesAnalyzed = 0;
    let currentDepth = 0;
    
    // While we have pages to visit and haven't exceeded our limit
    while (
      pagesToVisit.length > 0 && 
      pagesAnalyzed < maxPages && 
      (Date.now() - startTime) < timeout
    ) {
      // Get next page to visit (breadth-first)
      const nextPage = pagesToVisit.shift();
      if (!nextPage) break;
      
      const { url: pageUrl, depth } = nextPage;
      
      // Skip if we've already visited this page or exceeded max depth
      if (visitedPages.includes(pageUrl) || depth > maxDepth) {
        continue;
      }
      
      currentDepth = depth;
      logProgress(`Navigating to ${pageUrl} (depth ${depth}/${maxDepth})`);
      
      try {
        // Navigate to the page with more reliable settings
        try {
          await page.goto(pageUrl, {
            waitUntil: "domcontentloaded", // Use domcontentloaded which is faster than load
            timeout: 30000,
          });
        } catch (navError) {
          logProgress(`Navigation error: ${navError}. Trying again with networkidle...`);
          try {
            // If domcontentloaded fails, try with networkidle which waits longer but is more reliable
            await page.goto(pageUrl, {
              waitUntil: "networkidle",
              timeout: 60000, // Longer timeout for networkidle
            });
          } catch (retryError) {
            logProgress(`Failed to navigate after retry: ${retryError}`);
            throw retryError;
          }
        }
        
        // Mark as visited
        visitedPages.push(pageUrl);
        pagesAnalyzed++;
        
        // Take initial screenshot
        await takeScreenshot(`page-${pagesAnalyzed}-initial`);
        
        // Perform initial scroll to load lazy content
        logProgress("Performing initial scroll to load content...");
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
        
        // Take post-scroll screenshot
        await takeScreenshot(`page-${pagesAnalyzed}-scrolled`);
        
        // Analyze the current page with the agent
        logProgress(`Analyzing page ${pagesAnalyzed}: ${pageUrl}`);
        
        // Generate analysis using agent with MCP tools and a timeout
        const analysisStartTime = Date.now();
        const maxPageAnalysisTime = 60000; // 60 seconds max per page
        
        // Create a promise that resolves with the agent response or rejects after timeout
        let result;
        try {
          result = await Promise.race([
            agent.generate([  // First promise is the agent generation
              {
                role: "user",
                content: `
                  Analyze this webpage at ${pageUrl} for conversion optimization opportunities.
                  
                  Follow these steps:
                  1. Take a screenshot to capture the initial view
                  2. Scroll through the ENTIRE page to see all content
                  3. Identify 3-5 specific elements that could be improved
                  4. Extract the text content from these elements
                  5. For each element, describe:
                     - What it is (heading, button, form, etc.)
                     - Where it appears on the page
                     - The current content
                     - The specific issue
                     - Your recommended improvement
                  
                  If you find forms, check for:
                  - Clear labels
                  - Required field indicators
                  - Error handling
                  - Submit button clarity
                  
                  If you find CTAs, check for:
                  - Clear action words
                  - Value proposition
                  - Placement
                  - Design/contrast
                  
                  IMPORTANT: After analysis, if you find interesting links to other key pages 
                  (like Features, Pricing, About), click on one of them to continue exploration.
                  
                  Return your findings as a structured JSON array.
                `,
              },
            ]),
            // Second promise is a timeout
            new Promise((_, reject) => {
              setTimeout(() => {
                reject(new Error(`Page analysis timed out after ${maxPageAnalysisTime/1000} seconds`));
              }, maxPageAnalysisTime);
            })
          ]);
          
          logProgress(`Received agent response for page ${pagesAnalyzed}`);
        } catch (analysisError) {
          logProgress(`Analysis error: ${analysisError}`);
          // Add an error content item
          contentItems.push({
            url: pageUrl,
            type: "error",
            content: `Analysis timed out or failed: ${analysisError.message || 'Unknown error'}`,
            location: "general",
            importance: "medium",
            optimizationPotential: "medium",
            issue: "The AI analysis process took too long or encountered an error",
            recommendation: "Try analyzing this page with a different scanner approach"
          });
          
          // Take error screenshot and continue to next page
          await takeScreenshot(`page-${pagesAnalyzed}-error`);
          continue;
        }
          {
            role: "user",
            content: `
              Analyze this webpage at ${pageUrl} for conversion optimization opportunities.
              
              Follow these steps:
              1. Take a screenshot to capture the initial view
              2. Scroll through the ENTIRE page to see all content
              3. Identify 3-5 specific elements that could be improved
              4. Extract the text content from these elements
              5. For each element, describe:
                 - What it is (heading, button, form, etc.)
                 - Where it appears on the page
                 - The current content
                 - The specific issue
                 - Your recommended improvement
              
              If you find forms, check for:
              - Clear labels
              - Required field indicators
              - Error handling
              - Submit button clarity
              
              If you find CTAs, check for:
              - Clear action words
              - Value proposition
              - Placement
              - Design/contrast
              
              IMPORTANT: After analysis, if you find interesting links to other key pages 
              (like Features, Pricing, About), click on one of them to continue exploration.
              
              Return your findings as a structured JSON array.
            `,
          },
        ]);
        
        logProgress(`Received agent response for page ${pagesAnalyzed}`);
        
        // Handle navigation actions from tool calls
        if (result.toolCalls && result.toolCalls.length > 0) {
          logProgress(`Processing ${result.toolCalls.length} tool calls`);
          
          // Check if any of the tool calls failed with errors
          const hasErrors = result.toolCalls.some(call => {
            return call.error && typeof call.error === 'string' && call.error.length > 0;
          });
          
          if (hasErrors) {
            logProgress('Errors detected in tool calls. Adding fallback content item.');
            contentItems.push({
              url: pageUrl,
              type: "error",
              content: "Browser automation encountered errors when analyzing this page",
              location: "general",
              importance: "high",
              optimizationPotential: "high",
              issue: "The AI encountered errors when trying to interact with this page",
              recommendation: "Consider manual analysis or using a different scanner approach"
            });
            continue; // Skip to next page in queue
          }
          
          // Process click and navigation events to find new pages
          const navigationEvents = result.toolCalls.filter(
            (call) => call.toolName === "browser_navigate" || call.toolName === "browser_click"
          );
          
          if (navigationEvents.length > 0) {
            logProgress(`Found ${navigationEvents.length} navigation events`);
            
            // Extract new URLs
            for (const event of navigationEvents) {
              if (event.toolName === "browser_navigate") {
                const navParams = (event as any).parameters;
                if (navParams && navParams.url && !visitedPages.includes(navParams.url)) {
                  pagesToVisit.push({ url: navParams.url, depth: depth + 1 });
                  logProgress(`Added to queue: ${navParams.url}`);
                }
              }
              // For clicks, we'll capture the current URL after the action completes
            }
            
            // Get current URL after all navigation actions
            const currentUrl = page.url();
            if (currentUrl !== pageUrl && !visitedPages.includes(currentUrl)) {
              visitedPages.push(currentUrl);
              // Add back to queue for analysis if we haven't exceeded depth
              if (depth < maxDepth) {
                pagesToVisit.push({ url: currentUrl, depth: depth + 1 });
                logProgress(`Added page after click/navigation: ${currentUrl}`);
              }
            }
          }
        }
        
        // Process content findings
        if (result.text) {
          // Extract JSON content
          const jsonMatches = result.text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ||
                              result.text.match(/\[\s*\{\s*"[^"]+"\s*:/);
          
          // Extract possible structured content from text
          function tryExtractStructuredContent(text) {
            // Find potential keys that might indicate content items in text paragraphs
            const contentPatterns = [
              { pattern: /\d+\.\s+(Headline|Heading|CTA|Button|Form):/i, type: (m) => m[1].toLowerCase() },
              { pattern: /\b(hero|main)\s+(headline|heading|title)\b/i, type: () => 'heading' },
              { pattern: /\b(call[\s-]to[\s-]action|button)\b/i, type: () => 'cta' },
              { pattern: /\b(form|input|field)\b/i, type: () => 'form' }
            ];
            
            // Split text into paragraphs or points
            const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 10);
            const items = [];
            
            // Process each paragraph
            paragraphs.forEach(para => {
              // Look for numbered points
              const itemMatch = para.match(/^\s*(\d+)\.\s+(.+)/m);
              const content = itemMatch ? itemMatch[2] : para;
              
              // Try to determine the type from the content
              let type = 'text';
              let location = 'page';
              
              for (const pattern of contentPatterns) {
                const match = content.match(pattern.pattern);
                if (match) {
                  type = pattern.type(match);
                  break;
                }
              }
              
              // Look for location references
              if (content.match(/\b(hero|above[\s-]the[\s-]fold|top)\b/i)) {
                location = 'hero section';
              } else if (content.match(/\b(footer|bottom)\b/i)) {
                location = 'footer';
              } else if (content.match(/\b(navigation|menu|nav)\b/i)) {
                location = 'navigation';
              }
              
              // Extract some content text
              let contentText = content.slice(0, 100);
              if (contentText.length === 100) contentText += '...';
              
              items.push({
                url: pageUrl,
                type,
                content: contentText,
                location,
                importance: 'medium',
                optimizationPotential: 'medium',
                issue: 'Extracted from unstructured analysis',
                recommendation: 'Review this element manually'
              });
            });
            
            return items;
          }
          
          if (jsonMatches) {
            try {
              // Get the JSON content
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
              
              // Parse the JSON
              const findings = JSON.parse(jsonText);
              if (Array.isArray(findings)) {
                logProgress(`Found ${findings.length} optimization opportunities`);
                
                // Add URL if missing
                const itemsWithUrl = findings.map(item => ({
                  ...item,
                  url: item.url || pageUrl
                }));
                
                // Add to our collection
                contentItems.push(...itemsWithUrl);
              }
            } catch (e) {
              logProgress(`Error parsing JSON: ${e}`);
            }
          } else {
            logProgress("No JSON content found in response");
            
            // Save the raw response for debugging
            fs.writeFileSync(
              path.join(screenshotDir, `page-${pagesAnalyzed}-response.txt`),
              result.text
            );
            
            // Try to extract structured content from the text response
            if (result.text && result.text.length > 0) {
              logProgress("Trying to extract structured content from text response");
              const extractedItems = tryExtractStructuredContent(result.text);
              
              if (extractedItems.length > 0) {
                logProgress(`Extracted ${extractedItems.length} items from unstructured text`);
                contentItems.push(...extractedItems);
              } else if (!result.text.includes("error") && !result.text.includes("issue")) {
                // If no errors mentioned and no items extracted, add a generic item
                logProgress("Adding generic content item based on response");
                contentItems.push({
                  url: pageUrl,
                  type: "general",
                  content: result.text.slice(0, 150) + (result.text.length > 150 ? '...' : ''),
                  location: "page",
                  importance: "medium",
                  optimizationPotential: "medium",
                  issue: "AI provided unstructured analysis",
                  recommendation: "Review the full response for insights"
                });
              }
            }
          }
        }
        
        // Take final screenshot of this page
        await takeScreenshot(`page-${pagesAnalyzed}-final`);
        
      } catch (pageError) {
        logProgress(`Error processing page ${pageUrl}: ${pageError}`);
        await takeScreenshot(`page-${pagesAnalyzed}-error`);
      }
      
      // Brief pause between pages
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Cleanup
    await mcpClient.disconnect();
    
    // If we didn't find any content, add a fallback item
    if (contentItems.length === 0) {
      contentItems.push({
        url,
        type: "feedback",
        content: "Analysis completed but no structured results were generated",
        location: "general",
        importance: "medium",
        optimizationPotential: "medium",
      });
    }
    
    // Calculate metadata
    const scanDuration = Date.now() - startTime;
    
    // Return the scan results
    return {
      baseUrl: url,
      scannedPages: visitedPages,
      content: contentItems,
      metadata: {
        scanDuration,
        pageCount: visitedPages.length,
        contentCount: contentItems.length,
      },
    };
    
  } catch (error) {
    logProgress(`Enhanced MCP scan failed: ${error}`);
    
    // Save error details
    try {
      fs.writeFileSync(
        path.join(screenshotDir, "enhanced-scan-error.txt"),
        error instanceof Error ? error.stack || error.message : String(error)
      );
      await takeScreenshot("error");
    } catch (e) {
      // Ignore errors during error handling
    }
    
    throw error;
  } finally {
    // Clean up browser
    await browser.close();
  }
}
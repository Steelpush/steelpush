import { chromium } from "playwright";
import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import { anthropic } from "@ai-sdk/anthropic";
import { config } from "../config";
import { WebsiteContent, WebsiteScanResult } from "./website-scanner";
import { MCPClient } from "@mastra/mcp";
import fs from "fs";
import path from "path";

/**
 * Helper function to extract JSON from agent responses
 * This handles different ways the agent might format JSON in its response
 */
function extractJsonFromResponse(response: string): WebsiteContent[] {
  try {
    // Skip empty responses
    if (!response || !response.trim()) {
      console.log("Empty response received, skipping JSON extraction");
      return [];
    }

    // Try multiple approaches to find valid JSON

    // Approach 1: Look for JSON code blocks
    const codeBlockMatches = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatches && codeBlockMatches[1]) {
      const jsonText = codeBlockMatches[1].trim();
      try {
        const parsed = JSON.parse(jsonText);
        if (Array.isArray(parsed)) {
          console.log(
            `Successfully extracted JSON array with ${parsed.length} items from code block`
          );
          return parsed.filter(
            (item) =>
              item &&
              typeof item === "object" &&
              (item.content || item.type || item.location) // Basic validation that it's a content item
          );
        }
      } catch (e) {
        console.log("Could not parse JSON from code block", e);
      }
    }

    // Approach 2: Look for array-like structures
    const arrayMatches = response.match(/\[\s*\{\s*"[^"]+"\s*:/);
    if (arrayMatches) {
      const startIndex = arrayMatches.index;
      if (startIndex !== undefined) {
        // Find closing bracket by counting opening and closing brackets
        let bracketCount = 0;
        let endIndex = startIndex;

        for (let i = startIndex; i < response.length; i++) {
          if (response[i] === "[") bracketCount++;
          else if (response[i] === "]") bracketCount--;

          if (bracketCount === 0 && i > startIndex) {
            endIndex = i + 1;
            break;
          }
        }

        const jsonText = response.substring(startIndex, endIndex);
        try {
          const parsed = JSON.parse(jsonText);
          if (Array.isArray(parsed)) {
            console.log(
              `Successfully extracted JSON array with ${parsed.length} items from raw text`
            );
            return parsed.filter(
              (item) =>
                item &&
                typeof item === "object" &&
                (item.content || item.type || item.location) // Basic validation that it's a content item
            );
          }
        } catch (e) {
          console.log("Could not parse JSON from array structure", e);
        }
      }
    }

    // Approach 3: Look for individual JSON objects and combine them
    const items: WebsiteContent[] = [];
    const objectRegex =
      /\{\s*"(?:type|url|content)"\s*:\s*"[^"]+"\s*,[\s\S]*?\}/g;
    const objectMatches = response.matchAll(objectRegex);

    for (const match of objectMatches) {
      try {
        const item = JSON.parse(match[0]);
        if (
          item &&
          typeof item === "object" &&
          (item.content || item.type || item.location)
        ) {
          items.push(item);
        }
      } catch (e) {
        // Ignore invalid matches
      }
    }

    if (items.length > 0) {
      console.log(
        `Successfully extracted ${items.length} individual JSON objects`
      );
      return items;
    }

    console.log("No valid JSON content found in response");
    return [];
  } catch (error) {
    console.error("Error extracting JSON:", error);
    return [];
  }
}

/**
 * Scans a website to extract content using Playwright with MCP and Mastra agents
 *
 * This uses Model Context Protocol which gives the agent direct control
 * of the browser for more autonomous navigation and analysis
 */
export async function scanWebsiteWithMcp(
  url: string
): Promise<WebsiteScanResult> {
  console.log(`Starting MCP website scan for: ${url}`);
  const startTime = Date.now();

  // Create output directory for screenshots
  const screenshotDir = path.join(process.cwd(), "screenshots");
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  // Launch a browser instance with a larger viewport to see more content
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  // State variables to track the exploration
  const visitedPages: string[] = [];
  const contentItems: WebsiteContent[] = [];
  const pagesToVisit: string[] = [url]; // Start with the initial URL
  let currentUrl = "";

  // Conversation state
  const conversationHistory: { role: "user" | "assistant"; content: string }[] =
    [];
  let explorationComplete = false;
  let turnCount = 0;
  const MAX_TURNS = 2; // Reduced to 2 turns for testing
  const startingTime = Date.now();
  const MAX_EXECUTION_TIME = 180000; // 3 minutes max execution time

  // Progress tracking
  let progressLog = `Scan started at ${new Date().toISOString()}\n`;

  const logProgress = (message: string) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    progressLog += logMessage + "\n";

    // Save log to file periodically
    if (turnCount > 0 && turnCount % 1 === 0) {
      try {
        fs.writeFileSync(
          path.join(screenshotDir, "mcp-progress.log"),
          progressLog
        );
      } catch (e) {
        // Ignore log write errors
      }
    }
  };

  // Common error handler
  const handleError = (error: any, phase: string) => {
    console.error(`Error during ${phase}:`, error);
    // Take a screenshot of the current state when an error occurs
    try {
      const errorScreenshotPath = path.join(
        screenshotDir,
        `error-${Date.now()}.png`
      );
      page.screenshot({ path: errorScreenshotPath });
      console.log(`Error screenshot saved to ${errorScreenshotPath}`);
    } catch (screenshotError) {
      console.error("Failed to take error screenshot:", screenshotError);
    }
  };

  try {
    // Set up MCP client to connect to MCP servers
    console.log("Setting up MCP client...");
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

    // Get the MCP tools
    console.log("Fetching MCP tools...");
    const mcpTools = await mcpClient.getTools();

    console.log("MCP tools retrieved successfully");

    // Create agent with access to MCP tools
    const agent = new Agent({
      name: "mcp-website-scanner",
      instructions: `You are an expert website conversion optimizer tasked with finding conversion optimization opportunities.
        Your goal is to thoroughly explore a website like a real user would and identify specific content that could be improved.
        
        You have direct access to a browser using the Model Context Protocol (MCP) tools.
        You also have access to sequential thinking tools to help you break down complex tasks.
        
        EXPLORATION STRATEGY:
        - Start with the homepage
        - Analyze the current page COMPLETELY (scroll down to see everything)
        - Follow important navigation links to key pages like Features, Pricing, etc.
        - Aim to explore at least 3-5 different pages of the website
        - Return to the homepage if you need to reorient
        
        PAGE ANALYSIS APPROACH:
        1. First, take a snapshot to see the page structure
        2. SCROLL DOWN to see all content (IMPORTANT - do this on every page!)
        3. Look for these high-impact conversion elements:
           - Headlines and main messaging (are they clear, compelling, benefit-focused?)
           - CTAs and buttons (are they clear, action-oriented, well-placed?)
           - Value propositions (are they differentiated and persuasive?)
           - Social proof (testimonials, logos, case studies)
           - Pricing information (is it clear, well-structured?)
           - Forms (are they simple, focused, with clear labels?)
        
        For each optimization opportunity, document:
        - The exact URL
        - Element location on the page
        - Current content (exact text)
        - The specific issue
        - A clear recommendation for improvement
        
        IMPORTANT: Your task is not complete until you've analyzed MULTIPLE pages and found
        at least 5-8 specific optimization opportunities across the site.
        
        Return your findings as a structured JSON array of optimization opportunities that follows this format exactly:

        [
          {
            "url": "https://example.com/page",
            "type": "heading",
            "content": "Current content text",
            "location": "hero section",
            "importance": "high",
            "optimizationPotential": "high",
            "issue": "The issue with this content",
            "recommendation": "How to improve it"
          }
        ]
        
        Always include the JSON response inside code blocks with proper formatting.`,
      model: anthropic(config.analysis.modelName),
      tools: mcpTools,
    });

    // Navigate to the starting URL
    console.log(`Navigating to ${url}...`);
    try {
      // Use 'domcontentloaded' with a longer timeout
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60000, // 60 seconds
      });
      visitedPages.push(url);
      currentUrl = url;
      console.log("Initial page loaded successfully");

      // Take initial screenshot
      const initialScreenshot = path.join(screenshotDir, "initial-page.png");
      await page.screenshot({ path: initialScreenshot });
      console.log(`Initial screenshot saved to ${initialScreenshot}`);
    } catch (navigationError) {
      handleError(navigationError, "initial navigation");
      throw new Error(
        `Failed to load the starting URL: ${url}. Please check your internet connection and try again.`
      );
    }

    let optimizationOpportunities: WebsiteContent[] = [];

    // Initial prompt
    conversationHistory.push({
      role: "user",
      content: `
        I need you to explore and analyze the website at ${url} to find conversion optimization opportunities.
        
        Start by analyzing the current page:
        1. Take a snapshot to see the structure
        2. Scroll down to see ALL content (very important!)
        3. Identify elements that could be optimized for better conversion
        
        Then, navigate to other important pages:
        - Click on main navigation items (Products, Features, Pricing, etc.)
        - For each page, scroll to see all content
        - Analyze thoroughly for optimization opportunities
        
        Document each optimization opportunity with:
        - Current URL
        - Element location
        - Current content
        - The issue
        - A specific recommendation
        
        As you explore, provide your findings in a valid JSON array inside code blocks.
      `,
    });

    // Exploration loop
    while (!explorationComplete && turnCount < MAX_TURNS) {
      turnCount++;
      logProgress(`\n--- EXPLORATION TURN ${turnCount}/${MAX_TURNS} ---`);
      logProgress(`Current page: ${currentUrl}`);

      // Check for timeout
      if (Date.now() - startingTime > MAX_EXECUTION_TIME) {
        logProgress("Maximum execution time reached. Stopping exploration.");
        explorationComplete = true;
        break;
      }

      try {
        // Generate agent response for current state
        logProgress("Generating agent response...");

        // Validate conversation history before sending to API
        const validConversation = conversationHistory.filter(
          (msg) =>
            msg && msg.role && msg.content && msg.content.trim().length > 0
        );

        if (validConversation.length === 0) {
          // If we have no valid messages, create a new starting prompt
          validConversation.push({
            role: "user",
            content: `
              I need you to explore and analyze the website at ${url} to find conversion optimization opportunities.
              Take a snapshot of the current page, analyze the content, and identify elements that could be optimized.
              Focus on headlines, CTAs, forms, and value propositions.
              Return your findings as a structured JSON array inside code blocks.
            `,
          });
          logProgress(
            "Resetting conversation with new starting prompt due to invalid history"
          );
        }

        // Use the validated conversation history
        const result = await agent.generate(validConversation);
        logProgress("Agent generated a response. Processing...");

        // Validate we got a meaningful response
        if (!result || !result.text || result.text.trim().length === 0) {
          logProgress("Empty response received from agent, ending exploration");
          explorationComplete = true;
          break;
        }

        // Extract tool calls and navigation information
        if (result.toolCalls && result.toolCalls.length > 0) {
          logProgress(
            `Agent used ${result.toolCalls.length} tools in this turn`
          );

          // Extract navigation actions
          const navigationCalls = result.toolCalls.filter(
            (call) => call.toolName === "browser_navigate"
          );

          if (navigationCalls.length > 0) {
            logProgress(
              `Navigation events detected: ${navigationCalls.length}`
            );
            // The last navigation call determines where we are
            const lastNavCall = navigationCalls[navigationCalls.length - 1];
            const navParams = (lastNavCall as any).parameters;
            if (navParams && navParams.url) {
              currentUrl = navParams.url;
              if (!visitedPages.includes(currentUrl)) {
                visitedPages.push(currentUrl);
                logProgress(`New page visited: ${currentUrl}`);
              }
            }
          }

          // Check for screenshots to track visual state
          const screenshotCalls = result.toolCalls.filter(
            (call) =>
              call.toolName === "browser_take_screenshot" ||
              call.toolName === "browser_screen_capture"
          );

          if (screenshotCalls.length > 0) {
            logProgress(`Screenshot actions: ${screenshotCalls.length}`);
          }
        }

        // Extract optimization opportunities from the response
        let newOpportunities: WebsiteContent[] = [];
        try {
          // Use the helper function to extract JSON content
          newOpportunities = extractJsonFromResponse(result.text);

          if (newOpportunities.length > 0) {
            logProgress(
              `Found ${newOpportunities.length} new optimization opportunities`
            );

            // Add current URL to any items missing it
            newOpportunities = newOpportunities.map((item) => ({
              ...item,
              url: item.url || currentUrl,
            }));

            // Add to our collected opportunities
            optimizationOpportunities = [
              ...optimizationOpportunities,
              ...newOpportunities,
            ];
          } else {
            logProgress("No optimization opportunities found in this turn");
          }
        } catch (parseError) {
          handleError(parseError, "parsing agent response");
        }

        // Take a screenshot of current state
        try {
          const turnScreenshot = path.join(
            screenshotDir,
            `turn-${turnCount}.png`
          );
          await page.screenshot({ path: turnScreenshot });
          logProgress(
            `Turn ${turnCount} screenshot saved to ${turnScreenshot}`
          );
        } catch (screenshotError) {
          console.error("Failed to take turn screenshot:", screenshotError);
        }

        // Determine if we should continue exploring
        if (turnCount >= MAX_TURNS) {
          logProgress("Maximum number of exploration turns reached");
          explorationComplete = true;
        } else if (optimizationOpportunities.length >= 10) {
          logProgress("Found enough optimization opportunities");
          explorationComplete = true;
        } else {
          // Continue the conversation with instructions for next turn
          // Ensure we don't add empty messages to the conversation history
          if (result.text && result.text.trim()) {
            conversationHistory.push({
              role: "assistant",
              content: result.text,
            });

            // Determine next focus based on current state
            let nextPrompt = "";
            if (visitedPages.length < 3) {
              nextPrompt = `
                Great progress so far! You've analyzed ${visitedPages.length} pages and found ${optimizationOpportunities.length} optimization opportunities.
                
                Let's continue exploring the website:
                1. Navigate to another important page we haven't visited yet
                2. Remember to scroll all the way down to see everything
                3. Find more optimization opportunities
                
                Continue focusing on high-impact elements like headlines, CTAs, forms, and value propositions.
                Remember to return your findings as a structured JSON array in a code block.
              `;
            } else {
              nextPrompt = `
                Excellent work! You've explored ${visitedPages.length} pages and found ${optimizationOpportunities.length} optimization opportunities.
                
                Let's wrap up our exploration:
                1. Visit one final important page we haven't seen yet OR return to the homepage
                2. Find a few more high-impact optimization opportunities
                3. After this turn, provide a final summary of all your findings as a JSON array
                
                Make sure to include all optimization opportunities in your final JSON summary in a code block.
              `;
            }

            // Validate the prompt is not empty
            if (nextPrompt && nextPrompt.trim()) {
              conversationHistory.push({
                role: "user",
                content: nextPrompt,
              });
            } else {
              // Use a default prompt if the generated one is empty
              const fallbackPrompt = `Continue analyzing the current page and find more optimization opportunities. Return your findings as JSON.`;
              logProgress("Using fallback prompt due to empty next prompt");
              conversationHistory.push({
                role: "user",
                content: fallbackPrompt,
              });
            }
          } else {
            // If assistant response was empty, end the exploration
            logProgress("Empty response from assistant, ending exploration");
            explorationComplete = true;
          }
        }
      } catch (error) {
        handleError(error, "exploration loop");
      }
    }

    // Final optimization opportunities
    contentItems.push(...optimizationOpportunities);

    // If we didn't find any structured data, try one more approach with the entire conversation
    if (contentItems.length === 0) {
      // Look through the entire conversation
      for (const message of conversationHistory) {
        if (message.role === "assistant") {
          const items = extractJsonFromResponse(message.content);
          if (items.length > 0) {
            contentItems.push(...items);
            logProgress(`Found ${items.length} items in conversation history`);
          }
        }
      }
    }

    // Ensure all items have required fields
    contentItems.forEach((item) => {
      // Fill in required fields if missing
      if (!item.importance) item.importance = "medium";
      if (!item.optimizationPotential) item.optimizationPotential = "medium";
      if (!item.type) item.type = "text";
      if (!item.location) item.location = "page";
    });

    // Disconnect the MCP client
    await mcpClient.disconnect();

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
    console.error("MCP scan failed:", error);
    throw error;
  } finally {
    // Clean up resources
    console.log("Closing browser...");
    await browser.close();
  }
}

import { chromium } from "playwright";
import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import { anthropic } from "@ai-sdk/anthropic";
import { config } from "../config";
import { WebsiteContent, WebsiteScanResult } from "./website-scanner";
import { MCPClient } from "@mastra/mcp";

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

  // Launch a browser instance
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Set up MCP client to connect to Playwright MCP server
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
      instructions: `
        You are an expert content analyzer tasked with scanning websites to find conversion-relevant content.
        Your goal is to identify content that could be optimized to improve conversion rates.
        
        You have direct access to a browser using the Model Context Protocol (MCP) tools.
        You also have access to sequential thinking tools to help you break down complex tasks.
        
        When analyzing a website:
        1. Start by navigating to the provided URL using browser_navigate
        2. Take a snapshot with browser_snapshot to assess the page structure
        3. Extract all important content elements, especially:
           - Headlines and page titles
           - Call-to-action buttons and links
           - Value propositions and feature descriptions
           - Trust indicators (testimonials, reviews, etc.)
           - Pricing information
           - Form labels and button text
        4. Follow important links within the same domain to discover more content
        5. For each content element you find, record:
           - The type of content (heading, cta, paragraph, etc.)
           - The actual text content
           - Where it appears on the page (header, hero section, sidebar, etc.)
           - Its importance level (high, medium, low)
           - Its potential for optimization (high, medium, low)
        
        Focus on extracting the most conversion-relevant content without getting distracted by navigation elements or footer links.
        Use sequential_thinking to break down complex tasks into steps.
        Be thorough in your analysis but limit to scanning at most 5 pages.
        
        Return your results as a structured JSON array of content items.
      `,
      model: anthropic(config.analysis.modelName),
      tools: mcpTools,
    });

    // Track visited pages
    const visitedPages: string[] = [url];

    // Navigate to the URL (we need to do this first, before the agent starts)
    console.log(`Navigating to ${url}...`);
    await page.goto(url);

    // Run the agent to analyze the website
    console.log("Starting content analysis with MCP...");
    const result = await agent.generate([
      {
        role: "user",
        content: `
          Please analyze the website at ${url} for conversion-relevant content.
          
          First take a snapshot of the page to see what's there.
          Extract all important content elements focusing on:
          - Headlines and titles (h1, h2, etc.)
          - Call-to-action buttons
          - Value propositions
          - Marketing copy
          - Feature descriptions
          
          After analyzing the main page, you can follow important links to analyze other key pages
          (like product pages, pricing pages, etc.), but limit to at most 5 pages total.
          
          For each content element you find, note:
          - The exact content text
          - The type of content
          - Where it appears on the page
          - Its importance for conversion
          - Its potential for optimization
          
          Return your findings as a structured JSON array with this format:
          [
            {
              "url": "page URL",
              "type": "heading/cta/paragraph/etc",
              "content": "the actual text",
              "location": "header/hero/etc",
              "importance": "high/medium/low",
              "optimizationPotential": "high/medium/low"
            },
            ...
          ]
        `,
      },
    ]);

    // Process the agent's response
    let contentItems: WebsiteContent[] = [];

    try {
      console.log("Processing agent response...");

      // First check if we have structured data in toolCalls
      if (result.toolCalls && result.toolCalls.length > 0) {
        // Some tools may return structured data directly
        const sequentialThinkingResults = result.toolCalls.filter(
          (call) => call.toolName === "sequential_thinking"
        );

        if (sequentialThinkingResults.length > 0) {
          // Try to extract result from the sequential thinking tool
          const lastThinkingResult =
            sequentialThinkingResults[sequentialThinkingResults.length - 1];
          if ((lastThinkingResult as any).result) {
            try {
              const thinkingResult = (lastThinkingResult as any).result;
              if (
                typeof thinkingResult === "string" &&
                thinkingResult.includes("[") &&
                thinkingResult.includes("]")
              ) {
                // This might be JSON
                contentItems = JSON.parse(thinkingResult);
              }
            } catch (error) {
              console.log("Could not parse sequential thinking result as JSON");
            }
          }
        }
      }

      // If we don't have content yet, try to extract from text
      if (contentItems.length === 0) {
        // Multiple approaches to extract JSON from text

        // Approach 1: Try to extract JSON from code blocks
        const jsonCodeBlockMatches = result.text.match(
          /```(?:json)?\s*([\s\S]*?)\s*```/
        );
        if (jsonCodeBlockMatches && jsonCodeBlockMatches[1]) {
          try {
            const parsedItems = JSON.parse(jsonCodeBlockMatches[1].trim());
            if (Array.isArray(parsedItems)) {
              contentItems = parsedItems;
              console.log(
                `Extracted ${contentItems.length} content items from code block`
              );
            }
          } catch (error) {
            console.log("Could not parse JSON from code block");
          }
        }

        // Approach 2: Try to find JSON array in the text (with square brackets)
        if (contentItems.length === 0) {
          const jsonArrayMatches = result.text.match(/\[\s*\{\s*"[^"]+"\s*:/);
          if (jsonArrayMatches) {
            const startIndex = jsonArrayMatches.index;
            if (startIndex !== undefined) {
              // Find the matching closing bracket
              let bracketCount = 0;
              let endIndex = startIndex;
              let foundEnd = false;

              for (let i = startIndex; i < result.text.length; i++) {
                if (result.text[i] === "[") bracketCount++;
                else if (result.text[i] === "]") bracketCount--;

                if (bracketCount === 0 && i > startIndex) {
                  endIndex = i + 1;
                  foundEnd = true;
                  break;
                }
              }

              if (foundEnd) {
                try {
                  const jsonText = result.text.substring(startIndex, endIndex);
                  const parsedItems = JSON.parse(jsonText);
                  if (Array.isArray(parsedItems)) {
                    contentItems = parsedItems;
                    console.log(
                      `Extracted ${contentItems.length} content items from text`
                    );
                  }
                } catch (error) {
                  console.log("Could not parse JSON from text");
                }
              }
            }
          }
        }

        // Approach 3: Last resort, try the entire text
        if (contentItems.length === 0) {
          try {
            const parsedItems = JSON.parse(result.text);
            if (Array.isArray(parsedItems)) {
              contentItems = parsedItems;
              console.log(
                `Extracted ${contentItems.length} content items from full text`
              );
            }
          } catch (error) {
            console.log("Could not parse full text as JSON");
          }
        }
      }

      // If we still don't have items, log the full response for debugging
      if (contentItems.length === 0) {
        console.log("Could not extract JSON from response. Raw response:");
        console.log(result.text);
      }
    } catch (error) {
      console.error("Error processing agent response:", error);
    }

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

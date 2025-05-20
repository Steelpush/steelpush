import { chromium } from "playwright";
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { config } from "../config";
import { WebsiteContent, WebsiteScanResult } from "./website-scanner";
import { MCPClient } from "@mastra/mcp";
import fs from "fs";
import path from "path";

/**
 * A simpler, more direct MCP website scanner that avoids multi-turn conversations
 * This reduces the complexity and potential points of failure
 */
export async function scanWebsiteWithDirectMcp(
  url: string
): Promise<WebsiteScanResult> {
  console.log(`Starting direct MCP website scan for: ${url}`);
  const startTime = Date.now();

  // Create output directory for screenshots
  const screenshotDir = path.join(process.cwd(), "screenshots");
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  // Launch a browser instance with a larger viewport to see more content
  const browser = await chromium.launch({
    headless: false, // Make browser visible so you can see the actions
    slowMo: 500, // Slow down actions to make them visible
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  // Track visited pages
  const visitedPages: string[] = [url];
  const contentItems: WebsiteContent[] = [];

  try {
    // Set up MCP client
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

    // Get MCP tools
    console.log("Fetching MCP tools...");
    const mcpTools = await mcpClient.getTools();
    console.log("MCP tools retrieved successfully");

    // Navigate to the starting URL
    console.log(`Navigating to ${url}...`);
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // Manual scroll to ensure the page is fully loaded
    console.log("Scrolling through the page...");
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

    // Take a screenshot
    const initialScreenshot = path.join(
      screenshotDir,
      "direct-scan-initial.png"
    );
    await page.screenshot({ path: initialScreenshot });
    console.log(`Initial screenshot saved to ${initialScreenshot}`);

    // Check if OPENAI_API_KEY is available
    if (!process.env.OPENAI_API_KEY) {
      console.log("No OpenAI API key found, using Anthropic as fallback");
    } else {
      console.log("Using OpenAI for website analysis");
    }

    // Determine which model to use
    const modelType = process.env.OPENAI_MODEL || "gpt-4o-mini"; // Default to o-mini
    console.log(`Using model: ${modelType}`);

    // Create agent with access to MCP tools
    const agent = new Agent({
      name: "direct-mcp-scanner",
      instructions: `
        Analyze this website for conversion optimization opportunities. Find 3-5 specific elements that could be improved.
        
        For each opportunity:
        1. Identify the element (headline, CTA, etc.)
        2. Note its current content
        3. Explain the issue
        4. Provide a specific recommendation
        
        Return findings as JSON with these fields:
        - url: The page URL
        - type: Element type (heading, cta, etc.)
        - content: Current text content
        - location: Where on the page
        - importance: high/medium/low
        - optimizationPotential: high/medium/low
        - issue: Problem description
        - recommendation: Suggested improvement
      `,
      model: process.env.OPENAI_API_KEY
        ? openai(modelType) // Use the selected OpenAI model
        : anthropic("claude-3-7-sonnet-20250219"), // Fallback to Anthropic
      tools: mcpTools,
    });

    // Single agent call to analyze the homepage
    console.log("Requesting analysis of homepage...");
    const result = await agent.generate([
      {
        role: "user",
        content: `
          Analyze this website for conversion optimization opportunities.
          
          1. Take a snapshot to see the current page
          2. Identify 3-5 elements that could be improved for better conversion
          3. Focus on headlines, CTAs, and value propositions
          
          Format your response as a list of numbered points (1. 2. 3. etc.) 
          
          For each point include:
          - The element type (headline, CTA, etc.)
          - The current content (quote the exact text)
          - Where it appears on the page
          - The issue with it
          - Your recommendation
          
          IMPORTANT: If possible, also include a JSON array with this format at the end of your response:
          
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
        `,
      },
    ]);

    console.log("Received response from agent");

    // Detailed debugging of result
    console.log("Response details:");
    console.log(`- Has text: ${result.text ? "Yes" : "No"}`);
    if (result.text) {
      console.log(`- Text length: ${result.text.length} characters`);
    } else {
      console.log("- No text in response");
    }

    console.log(
      `- Tool calls: ${result.toolCalls ? result.toolCalls.length : 0}`
    );

    // Save raw response data for debugging
    fs.writeFileSync(
      path.join(screenshotDir, "agent-response-raw.json"),
      JSON.stringify(result, null, 2)
    );

    // Take a final screenshot
    const finalScreenshot = path.join(screenshotDir, "direct-scan-final.png");
    await page.screenshot({ path: finalScreenshot });
    console.log(`Final screenshot saved to ${finalScreenshot}`);

    // Extract JSON content from response
    let opportunities: WebsiteContent[] = [];
    if (result.text) {
      // Save the agent's full response for debugging
      fs.writeFileSync(
        path.join(screenshotDir, "agent-response.txt"),
        result.text || "No response"
      );

      // Look for code blocks
      const codeBlockMatch = result.text.match(
        /```(?:json)?\s*([\s\S]*?)\s*```/
      );
      if (codeBlockMatch && codeBlockMatch[1]) {
        try {
          const jsonItems = JSON.parse(codeBlockMatch[1].trim());
          if (Array.isArray(jsonItems)) {
            opportunities = jsonItems;
            console.log(
              `Extracted ${opportunities.length} opportunities from code block`
            );
          }
        } catch (e) {
          console.error("Failed to parse JSON from code block:", e);
        }
      } else {
        // Try to find any array in the text
        const arrayMatch = result.text.match(/\[\s*\{\s*"[^"]+"\s*:/);
        if (arrayMatch) {
          const startIndex = arrayMatch.index;
          if (startIndex !== undefined) {
            let bracketCount = 0;
            let endIndex = startIndex;

            for (let i = startIndex; i < result.text.length; i++) {
              if (result.text[i] === "[") bracketCount++;
              else if (result.text[i] === "]") bracketCount--;

              if (bracketCount === 0 && i > startIndex) {
                endIndex = i + 1;
                break;
              }
            }

            try {
              const jsonText = result.text.substring(startIndex, endIndex);
              const jsonItems = JSON.parse(jsonText);
              if (Array.isArray(jsonItems)) {
                opportunities = jsonItems;
                console.log(
                  `Extracted ${opportunities.length} opportunities from raw text`
                );
              }
            } catch (e) {
              console.error("Failed to parse JSON from raw text:", e);
            }
          }
        }
      }

      // If no structured data found but we have text, extract insights directly
      if (opportunities.length === 0 && result.text.length > 0) {
        console.log("No JSON found, attempting to extract insights from text");

        // Look for potential sections in the text
        const sections = result.text.split(/\n\s*\d+\.\s+/).filter(Boolean);

        if (sections.length > 1) {
          // First item might be intro text, so skip if it doesn't look like an insight
          const startIndex =
            sections[0].includes("optimization") ||
            sections[0].includes("analysis")
              ? 1
              : 0;

          for (let i = startIndex; i < sections.length; i++) {
            const section = sections[i].trim();
            if (section.length < 10) continue; // Skip very short sections

            // Try to identify parts of the section
            let type = "text";
            let content = "";
            let location = "page";
            let issue = "";
            let recommendation = "";

            // Look for types
            if (
              section.toLowerCase().includes("headline") ||
              section.toLowerCase().includes("heading")
            ) {
              type = "heading";
            } else if (
              section.toLowerCase().includes("cta") ||
              section.toLowerCase().includes("button")
            ) {
              type = "cta";
            } else if (section.toLowerCase().includes("form")) {
              type = "form";
            } else if (section.toLowerCase().includes("testimonial")) {
              type = "testimonial";
            }

            // Extract content (quoted text is likely content)
            const contentMatch = section.match(/"([^"]+)"/);
            if (contentMatch) {
              content = contentMatch[1];
            } else {
              // Just take the first sentence
              const firstSentence = section.split(/[.!?](\s|$)/)[0];
              content = firstSentence;
            }

            // Look for location indicators
            if (section.toLowerCase().includes("hero")) {
              location = "hero section";
            } else if (section.toLowerCase().includes("header")) {
              location = "header";
            } else if (section.toLowerCase().includes("navigation")) {
              location = "navigation";
            } else if (section.toLowerCase().includes("footer")) {
              location = "footer";
            }

            // Find issue and recommendation
            const paragraphs = section.split(/\n\s*\n/).filter(Boolean);
            if (paragraphs.length > 1) {
              issue = paragraphs[0];
              recommendation = paragraphs[paragraphs.length - 1];
            } else {
              const parts = section.split(
                /issue|problem|recommendation|improve/i
              );
              if (parts.length > 1) {
                issue = parts[1].trim();
              }
              if (parts.length > 2) {
                recommendation = parts[2].trim();
              }
            }

            // Create a content item
            opportunities.push({
              url,
              type,
              content,
              location,
              importance: "medium",
              optimizationPotential: "medium",
              issue,
              recommendation,
            });
          }

          console.log(
            `Extracted ${opportunities.length} opportunities from unstructured text`
          );
        }
      }
    }

    // Add opportunities to content items
    contentItems.push(...opportunities);

    // If we didn't extract any content, create a simple feedback item
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

    // Clean up MCP client
    await mcpClient.disconnect();

    // Calculate metadata
    const scanDuration = Date.now() - startTime;

    // Return scan results
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
    console.error("Direct MCP scan failed:", error);
    // Save error for debugging
    try {
      fs.writeFileSync(
        path.join(screenshotDir, "error-log.txt"),
        error instanceof Error ? error.stack || error.message : String(error)
      );

      // Take error screenshot
      await page.screenshot({
        path: path.join(screenshotDir, `error-${Date.now()}.png`),
      });
    } catch (e) {
      // Ignore errors during error handling
    }
    throw error;
  } finally {
    // Clean up
    console.log("Closing browser...");
    await browser.close();
  }
}

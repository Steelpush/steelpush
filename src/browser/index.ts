import { startMcp, stopMcp } from "@playwright/mcp";
import { Page, Browser } from "playwright";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { config } from "../config";

// Types for browser session management
interface BrowserSession {
  browser: Browser;
  page: Page;
  mcpUrl: string;
}

let activeSessions: BrowserSession[] = [];

/**
 * Starts a browser session with Playwright MCP
 *
 * @returns Promise resolving to browser session info
 */
export async function startBrowser(): Promise<BrowserSession> {
  try {
    console.log("Starting browser with Playwright MCP...");

    // Start MCP server
    const { browser, page, wsEndpoint } = await startMcp();

    const session: BrowserSession = {
      browser,
      page,
      mcpUrl: wsEndpoint,
    };

    activeSessions.push(session);
    console.log(`Browser started successfully. MCP endpoint: ${wsEndpoint}`);

    return session;
  } catch (error) {
    console.error("Failed to start browser:", error);
    throw error;
  }
}

/**
 * Stops a browser session
 *
 * @param session The browser session to stop
 */
export async function stopBrowser(session: BrowserSession): Promise<void> {
  try {
    const index = activeSessions.indexOf(session);
    if (index !== -1) {
      activeSessions.splice(index, 1);
    }

    await stopMcp();
    console.log("Browser stopped successfully");
  } catch (error) {
    console.error("Failed to stop browser:", error);
    throw error;
  }
}

/**
 * Creates a Mastra agent that can analyze content using browser automation
 *
 * @param session The browser session to use
 * @returns Promise resolving to a Mastra agent
 */
export async function createBrowserAgent(session: BrowserSession) {
  // Create browser tools
  const navigateTool = createTool({
    id: "browser_navigate",
    description: "Navigate to a URL",
    inputSchema: z.object({
      url: z.string().describe("The URL to navigate to"),
    }),
    outputSchema: z.string(),
    execute: async ({ context }) => {
      await session.page.goto(context.url, { waitUntil: "networkidle" });
      return `Navigated to ${context.url}`;
    },
  });

  const snapshotTool = createTool({
    id: "browser_snapshot",
    description: "Take a snapshot of the current page content",
    inputSchema: z.object({}),
    outputSchema: z.string(),
    execute: async () => {
      const content = await session.page.content();
      const title = await session.page.title();
      const url = session.page.url();

      return JSON.stringify({
        title,
        url,
        content,
      });
    },
  });

  const clickTool = createTool({
    id: "browser_click",
    description: "Click on an element on the page",
    inputSchema: z.object({
      selector: z.string().describe("CSS selector of the element to click"),
      description: z
        .string()
        .describe("Human-readable description of what you're clicking on"),
    }),
    outputSchema: z.string(),
    execute: async ({ context }) => {
      try {
        await session.page.click(context.selector);
        return `Clicked on ${context.description} (${context.selector})`;
      } catch (error: any) {
        return `Failed to click on ${context.description}: ${error.message}`;
      }
    },
  });

  const extractContentTool = createTool({
    id: "browser_extract_content",
    description: "Extract content from the page using selectors",
    inputSchema: z.object({
      selectors: z.array(
        z.object({
          name: z.string().describe("Name to identify this content"),
          selector: z.string().describe("CSS selector to extract content from"),
          contentType: z
            .enum(["text", "html", "attribute"])
            .describe("Type of content to extract"),
          attribute: z
            .string()
            .optional()
            .describe(
              "Attribute name to extract (if contentType is 'attribute')",
            ),
        }),
      ),
    }),
    outputSchema: z.array(
      z.object({
        name: z.string(),
        content: z.string(),
        found: z.boolean(),
      }),
    ),
    execute: async ({ context }) => {
      const results = [];

      for (const item of context.selectors) {
        try {
          let content = "";
          const elements = await session.page.$$(item.selector);

          if (elements.length > 0) {
            if (item.contentType === "text") {
              content = (await elements[0].textContent()) || "";
            } else if (item.contentType === "html") {
              content = (await elements[0].innerHTML()) || "";
            } else if (item.contentType === "attribute" && item.attribute) {
              content = (await elements[0].getAttribute(item.attribute)) || "";
            }

            results.push({
              name: item.name,
              content: content.trim(),
              found: true,
            });
          } else {
            results.push({
              name: item.name,
              content: "",
              found: false,
            });
          }
        } catch (error) {
          results.push({
            name: item.name,
            content: "",
            found: false,
          });
        }
      }

      return results;
    },
  });

  const waitForTool = createTool({
    id: "browser_wait_for",
    description: "Wait for an element or navigation to complete",
    inputSchema: z.object({
      waitType: z
        .enum(["selector", "navigation", "time"])
        .describe("Type of wait operation"),
      selector: z
        .string()
        .optional()
        .describe("CSS selector to wait for (if waitType is 'selector')"),
      timeout: z
        .number()
        .optional()
        .describe("Maximum time to wait in milliseconds (default: 30000)"),
    }),
    outputSchema: z.boolean(),
    execute: async ({ context }) => {
      const timeout = context.timeout || 30000;

      try {
        if (context.waitType === "selector" && context.selector) {
          await session.page.waitForSelector(context.selector, { timeout });
          return true;
        } else if (context.waitType === "navigation") {
          await session.page.waitForNavigation({
            timeout,
            waitUntil: "networkidle",
          });
          return true;
        } else if (context.waitType === "time") {
          await session.page.waitForTimeout(timeout);
          return true;
        }
        return false;
      } catch (error) {
        return false;
      }
    },
  });

  const takeScreenshotTool = createTool({
    id: "browser_take_screenshot",
    description: "Take a screenshot of the current page",
    inputSchema: z.object({
      path: z.string().optional().describe("Path to save the screenshot"),
    }),
    outputSchema: z.string(),
    execute: async ({ context }) => {
      const path = context.path || `screenshot-${Date.now()}.png`;
      await session.page.screenshot({ path });
      return `Screenshot saved to ${path}`;
    },
  });

  // Create the content analyzer agent
  const agent = new Agent({
    name: "content-analyzer",
    instructions: `
      You are an expert website content analyzer using browser automation.
      Your task is to:
      
      1. Navigate to websites and analyze their content
      2. Identify marketing and conversion-critical content like headlines, CTAs, value propositions
      3. Understand the purpose, meaning, and effectiveness of each content element
      4. Extract structured data about content components without relying on fixed selectors
      
      Use an intelligence-based approach to identify content:
      - Examine the visual structure and hierarchy of the page
      - Identify patterns that indicate important content
      - Focus on content that impacts conversion and user experience
      
      When analyzing a website:
      1. Navigate to the URL
      2. Take a snapshot of the page
      3. Identify key content elements based on their purpose and meaning
      4. Extract relevant content with context about its purpose
      5. Organize findings in a structured format
      
      For each content element identified, record:
      - The content itself
      - The type/purpose (headline, CTA, description, etc.)
      - Its context and location on the page
      - Why it's important from a conversion perspective
      
      Focus on understanding content purpose rather than just structure.
    `,
    model: openai(config.analysis.modelName || "gpt-4-turbo"),
    tools: {
      browser_navigate: navigateTool,
      browser_snapshot: snapshotTool,
      browser_click: clickTool,
      browser_extract_content: extractContentTool,
      browser_wait_for: waitForTool,
      browser_take_screenshot: takeScreenshotTool,
    },
  });

  return agent;
}

/**
 * Analyzes website content using browser automation
 *
 * @param url The URL to analyze
 * @returns Promise resolving to the content analysis
 */
export async function analyzeWebsiteContent(url: string) {
  let session: BrowserSession | null = null;

  try {
    // Start browser
    session = await startBrowser();

    // Create browser agent
    const agent = await createBrowserAgent(session);

    // Let the agent analyze the website
    const result = await agent.generate([
      {
        role: "user",
        content: `
          Analyze the website at ${url} for its marketing content.
          
          First, navigate to the website and take a snapshot.
          Then, identify key marketing content elements like:
          - Headlines and taglines
          - Call-to-action buttons and links
          - Value propositions
          - Feature descriptions
          - Product benefits
          - Testimonials
          
          For each element, provide:
          - The content text
          - The type/purpose
          - Its location/context on the page
          - Whether it could be optimized for better conversion
          
          Format your analysis as structured JSON data.
        `,
      },
    ]);

    // Try to extract structured data from the result
    try {
      // Look for JSON in the response
      const jsonMatch = result.text.match(
        /```(?:json)?\s*([\s\S]*?)\s*```/,
      ) || [null, result.text];
      const jsonString = jsonMatch[1].trim();
      const analysisData = JSON.parse(jsonString);

      return {
        success: true,
        data: analysisData,
        raw: result.text,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        raw: result.text,
        error: "Failed to parse JSON from agent response",
      };
    }
  } catch (error: any) {
    return {
      success: false,
      data: null,
      raw: null,
      error: error.message || "Unknown error",
    };
  } finally {
    // Clean up browser session
    if (session) {
      await stopBrowser(session);
    }
  }
}

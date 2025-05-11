import { chromium, Browser, Page } from "playwright";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { anthropic } from "@ai-sdk/anthropic";
import { config } from "../config";

export interface WebsiteContent {
  url: string;
  type: string; // heading, cta, paragraph, etc.
  content: string;
  location: string; // Description of where this content appears
  importance: "high" | "medium" | "low";
  optimizationPotential: "high" | "medium" | "low";
}

export interface WebsiteScanResult {
  baseUrl: string;
  scannedPages: string[];
  content: WebsiteContent[];
  metadata: {
    scanDuration: number;
    pageCount: number;
    contentCount: number;
  };
}

/**
 * Scans a website to extract content using Playwright and Mastra agents
 */
export async function scanWebsite(url: string): Promise<WebsiteScanResult> {
  console.log(`Starting website scan for: ${url}`);
  const startTime = Date.now();

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Create tools for the agent
    const tools = createScanningTools(page);

    // Create content scanner agent
    const agent = new Agent({
      name: "website-content-scanner",
      instructions: `
        You are an expert content analyzer tasked with scanning websites to find conversion-relevant content.
        Your goal is to identify content that could be optimized to improve conversion rates.
        
        When analyzing a website:
        1. Start by navigating to the provided URL
        2. Extract and categorize all text content on the page (headings, CTAs, paragraphs, etc.)
        3. Follow important links within the same domain to discover more content
        4. Analyze the content's purpose and potential for optimization
        
        Focus on content that typically impacts conversions:
        - Headlines and page titles
        - Call-to-action buttons and links
        - Value propositions and feature descriptions
        - Trust indicators (testimonials, reviews, etc.)
        - Pricing information
        - Form labels and button text
        
        For each content element, record:
        - The type of content (heading, cta, paragraph, etc.)
        - The actual text content
        - Where it appears on the page (header, hero section, sidebar, etc.)
        - Its importance level (high, medium, low)
        - Its potential for optimization (high, medium, low)
        
        Aim to be thorough without getting distracted by non-essential content.
        Crawl multiple pages but prioritize important ones (homepage, product pages, etc.).
      `,
      model: anthropic(config.analysis.modelName),
      tools,
    });

    // Track visited pages and content
    const visitedPages: string[] = [];
    const contentItems: WebsiteContent[] = [];

    // Start the scanning process
    await scanPage(agent, page, url, visitedPages, contentItems);

    // Calculate metadata
    const scanDuration = Date.now() - startTime;

    // Return results
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
  } finally {
    // Clean up
    await browser.close();
  }
}

/**
 * Creates the necessary tools for the website scanning agent
 */
function createScanningTools(page: Page) {
  // Tool to navigate to a URL
  const navigateTool = createTool({
    id: "navigate",
    description: "Navigate to a specific URL",
    inputSchema: z.object({
      url: z.string().describe("The URL to navigate to"),
    }),
    outputSchema: z.string(),
    execute: async ({ context }) => {
      try {
        await page.goto(context.url, { waitUntil: "networkidle" });
        return `Successfully navigated to ${context.url}`;
      } catch (error: any) {
        return `Failed to navigate to ${context.url}: ${error.message || "Unknown error"}`;
      }
    },
  });

  // Tool to extract content from the current page
  const extractContentTool = createTool({
    id: "extract_content",
    description: "Extract content from the current page",
    inputSchema: z.object({}),
    outputSchema: z.array(
      z.object({
        type: z.string(),
        content: z.string(),
        location: z.string(),
        importance: z.enum(["high", "medium", "low"]),
        optimizationPotential: z.enum(["high", "medium", "low"]),
      })
    ),
    execute: async () => {
      try {
        // Extract all text-containing elements from the page
        return await page.evaluate(() => {
          // Define helper functions inside the evaluate function to avoid scope issues
          function getElementType(element) {
            const tagName = element.tagName.toLowerCase();

            // Headings
            if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tagName)) {
              return `heading-${tagName}`;
            }

            // CTAs
            if (
              (tagName === "button" ||
                (tagName === "a" && element.classList.contains("btn")) ||
                (tagName === "a" && element.classList.contains("button")) ||
                element.getAttribute("role") === "button") &&
              element.textContent &&
              element.textContent.trim().length > 0
            ) {
              return "cta";
            }

            // Form elements
            if (tagName === "label") return "form-label";
            if (
              tagName === "input" &&
              element.getAttribute("type") === "submit"
            )
              return "form-submit";

            // Paragraphs and text
            if (tagName === "p") return "paragraph";
            if (tagName === "li") return "list-item";

            // Default type
            return "text";
          }

          function getElementLocation(element) {
            // Check for common IDs and classes
            const elementClasses = Array.from(element.classList);
            const parentClasses = element.parentElement
              ? Array.from(element.parentElement.classList)
              : [];

            if (
              element.closest("header") ||
              element.closest('[class*="header"]')
            )
              return "header";
            if (
              element.closest("footer") ||
              element.closest('[class*="footer"]')
            )
              return "footer";
            if (element.closest("nav") || element.closest('[class*="nav"]'))
              return "navigation";
            if (
              element.closest("aside") ||
              element.closest('[class*="sidebar"]')
            )
              return "sidebar";

            if (
              elementClasses.some((c) => c.includes("hero")) ||
              parentClasses.some((c) => c.includes("hero"))
            )
              return "hero section";

            if (
              elementClasses.some((c) => c.includes("feature")) ||
              parentClasses.some((c) => c.includes("feature"))
            )
              return "features section";

            if (
              elementClasses.some((c) => c.includes("testimonial")) ||
              parentClasses.some((c) => c.includes("testimonial"))
            )
              return "testimonials section";

            if (
              elementClasses.some((c) => c.includes("pricing")) ||
              parentClasses.some((c) => c.includes("pricing"))
            )
              return "pricing section";

            if (element.closest("form")) return "form";

            // Default location
            return "main content";
          }

          function getImportance(element) {
            const tagName = element.tagName.toLowerCase();

            // High importance elements
            if (
              tagName === "h1" ||
              tagName === "h2" ||
              element.classList.contains("cta") ||
              element.getAttribute("role") === "button"
            ) {
              return "high";
            }

            // Medium importance elements
            if (
              tagName === "h3" ||
              tagName === "h4" ||
              tagName === "button" ||
              (tagName === "a" && element.classList.contains("btn"))
            ) {
              return "medium";
            }

            // Low importance by default
            return "low";
          }

          const results = [];

          // Find all text-containing elements
          const textElements = Array.from(
            document.querySelectorAll("*")
          ).filter((el) => {
            const text = el.textContent?.trim();
            return text && text.length > 0 && el.children.length === 0;
          });

          // Process each element
          textElements.forEach((element) => {
            const content = element.textContent?.trim() || "";

            // Skip very short or empty content
            if (content.length < 2) return;

            // Skip if element is not visible
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;

            const type = getElementType(element);
            const location = getElementLocation(element);
            const importance = getImportance(element);

            // Determine optimization potential (this is simplified)
            let optimizationPotential = "low";
            if (importance === "high") optimizationPotential = "high";
            else if (importance === "medium") optimizationPotential = "medium";

            results.push({
              type,
              content,
              location,
              importance,
              optimizationPotential,
            });
          });

          return results;
        });
      } catch (error) {
        console.error("Error extracting content:", error);
        return [];
      }
    },
  });

  // Tool to get all links from the current page
  const getPageLinksTool = createTool({
    id: "get_page_links",
    description: "Get all links from the current page",
    inputSchema: z.object({
      baseUrl: z.string().describe("The base URL of the website"),
    }),
    outputSchema: z.array(z.string()),
    execute: async ({ context }) => {
      try {
        const baseUrl = new URL(context.baseUrl);
        const baseHostname = baseUrl.hostname;

        return await page.evaluate((hostname) => {
          return Array.from(document.querySelectorAll("a[href]"))
            .map((a) => a.getAttribute("href"))
            .filter((href) => {
              if (!href) return false;

              // Keep absolute URLs with the same hostname
              if (href.startsWith("http")) {
                try {
                  return new URL(href).hostname === hostname;
                } catch {
                  return false;
                }
              }

              // Keep relative URLs
              return href.startsWith("/") && !href.startsWith("//");
            })
            .map((href) => {
              // Convert relative URLs to absolute
              if (href && href.startsWith("/")) {
                return `${window.location.protocol}//${hostname}${href}`;
              }
              return href;
            }) as string[];
        }, baseHostname);
      } catch (error: any) {
        console.error("Error getting page links:", error);
        return [];
      }
    },
  });

  return {
    navigate: navigateTool,
    extract_content: extractContentTool,
    get_page_links: getPageLinksTool,
  };
}

/**
 * Recursively scans a page and its linked pages
 */
async function scanPage(
  agent: Agent,
  page: Page,
  url: string,
  visitedPages: string[],
  contentItems: WebsiteContent[],
  maxPages: number = 5
): Promise<void> {
  // Skip if we've already visited this page or reached the max
  if (visitedPages.includes(url) || visitedPages.length >= maxPages) return;

  console.log(`Scanning page: ${url}`);
  visitedPages.push(url);

  try {
    // Let the agent navigate and extract content
    const result = await agent.generate([
      {
        role: "user",
        content: `
          Scan the website at ${url} for conversion-relevant content.
          First, navigate to the URL, then extract all content from the page.
          After extraction, get all links on the page to continue scanning.
          
          Identify and categorize content elements like headings, CTAs, descriptions, etc.
          Assess each element's importance and potential for optimization.
          
          Provide your findings in a structured format.
        `,
      },
    ]);

    // Process the agent's response to extract content items
    try {
      // Extract content from agent's tools usage
      const toolCalls = result.toolCalls || [];

      // Filter for extract_content tool calls
      const extractContentCalls = toolCalls.filter(
        (call) => call.toolName === "extract_content"
      );

      // Add extracted content to our results
      for (const call of extractContentCalls) {
        // Check if the result property exists (it might not in the type definition)
        const callResult = (call as any).result;
        if (callResult && Array.isArray(callResult)) {
          callResult.forEach((item) => {
            contentItems.push({
              url,
              ...item,
            });
          });
        }
      }

      // Get links for further scanning
      const getLinksCalls = toolCalls.filter(
        (call) => call.toolName === "get_page_links"
      );

      if (getLinksCalls.length > 0 && visitedPages.length < maxPages) {
        // Check if the result property exists (it might not in the type definition)
        const links = (getLinksCalls[0] as any).result;

        if (Array.isArray(links)) {
          // Filter to unvisited links and limit
          const unvisitedLinks = links
            .filter((link) => !visitedPages.includes(link))
            .slice(0, maxPages - visitedPages.length);

          // Recursively scan linked pages
          for (const link of unvisitedLinks) {
            if (visitedPages.length < maxPages) {
              await scanPage(
                agent,
                page,
                link,
                visitedPages,
                contentItems,
                maxPages
              );
            }
          }
        }
      }
    } catch (error) {
      console.error("Error processing agent response:", error);
    }
  } catch (error) {
    console.error(`Error scanning page ${url}:`, error);
  }
}

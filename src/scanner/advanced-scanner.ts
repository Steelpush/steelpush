/**
 * Advanced website scanner using Mastra MCP
 * Uses AI agent with browser tools to scan and analyze websites for optimization opportunities
 */

import * as fs from "fs";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { MCPClient } from "@mastra/mcp";
import { loadConfig } from "../utils/config";

// Types
export interface ScanOptions {
  maxPages?: number;
  maxDepth?: number;
  headless?: boolean;
  timeout?: number;
  screenshotsDir?: string;
  interactiveMode?: boolean;
  visionMode?: boolean;
  generateReport?: boolean;
}

export interface OptimizableElement {
  type: string;
  selector: string;
  content: string;
  location: string;
  importance: "high" | "medium" | "low";
  optimizationPotential: "high" | "medium" | "low";
  issue: string;
  recommendation: string;
}

export interface PageContent {
  pageUrl: string;
  pageTitle: string;
  screenshots: string[];
  interactions: any[];
  optimizableElements: OptimizableElement[];
  visionAnalysis?: any;
}

export interface ScanResult {
  type: "website";
  source: string;
  timestamp: number;
  data: {
    pages: PageContent[];
  };
}

/**
 * Main website scanning function using Mastra MCP
 */
export async function scanWebsiteAdvanced(
  url: string,
  options: ScanOptions = {}
): Promise<ScanResult> {
  console.log(`🚀 Scanning website: ${url}`);
  const startTime = Date.now();

  // Create screenshots directory
  const screenshotsDir = options.screenshotsDir || "screenshots";
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // Get AI configuration
  const config = loadConfig();
  if (!config) {
    throw new Error("Config not found. Run steelpush init first.");
  }

  // Set up AI model
  let model;
  if (config.ai.provider === "anthropic") {
    model = anthropic(config.ai.model || "claude-opus-4-20250514");
  } else {
    model = openai(config.ai.model || "gpt-4");
  }

  // Configure MCP Client for Playwright
  console.log("🔧 Setting up MCP client...");
  const mcp = new MCPClient({
    servers: {
      playwright: {
        command: "npx",
        args: ["@playwright/mcp@latest", "--headless"],
      },
    },
  });

  // Test MCP connection
  console.log("🔗 Connecting to MCP servers...");
  try {
    const tools = await mcp.getTools();
    console.log(`✅ MCP connected! Available tools: ${tools.length}`);
    console.log("🛠️ Tools:", tools.map((t: any) => t.name).join(", "));

    // Create website analysis agent
    const agent = new Agent({
      name: "Website Scanner",
      instructions: `
        You are a systematic website scanner. Follow these EXACT steps but KEEP RESPONSES CONCISE:
        
        STEP 1: INITIAL NAVIGATION
        - Navigate to the provided URL and take a screenshot
        - Report ONLY: page title, main heading, key sections (max 3 sentences)
        
        STEP 2: DOCUMENT CURRENT PAGE  
        - Extract key content but SUMMARIZE don't dump everything
        - List main CTAs and navigation items (max 5 each)
        - Note page structure briefly
        
        STEP 3: FIND MORE PAGES
        - Identify internal links but list ONLY the 3-5 most important ones
        - Skip minor/duplicate links
        
        STEP 4: SYSTEMATIC EXPLORATION  
        - Visit MAX 3 additional pages only
        - For each page: brief summary (2-3 sentences max)
        - Don't repeat full content analysis
        
        RESPONSE FORMAT:
        Always respond with BRIEF summaries:
        1. Current action: "Navigating to [URL]" or "Analyzing [URL]" 
        2. Key findings: 2-3 sentences maximum
        3. Next step: What you'll do next
        
        CRITICAL RULES:
        - NEVER include full page content in your response
        - SUMMARIZE everything - be concise
        - Stop after analyzing 4 pages total (homepage + 3 others)
        - Focus on KEY findings only, not exhaustive details
        - Keep each response under 200 words
      `,
      model: model,
      tools: tools,
    });

    // Start scanning
    console.log("🔍 Agent analyzing website...");
    console.log("📡 Starting browser automation via MCP...");
    console.log("🤖 Agent working on:", url);
    console.log("⏳ This may take 30-60 seconds...\n");

    // Have the agent scan the website with streaming
    console.log("🤖 Agent progress:\n");

    const streamResult = await agent.stream([
      {
        role: "user",
        content: `SYSTEMATIC WEBSITE SCAN: ${url}

        Execute these steps in order:
        
        STEP 1: Navigate to ${url} and take a screenshot
        STEP 2: Document everything on the homepage (content, CTAs, navigation)
        STEP 3: Find all internal links and navigation menu items
        STEP 4: Visit each discovered page and repeat documentation
        STEP 5: Report your findings in a structured format
        
        Current action: Navigate to ${url} and begin systematic scan
        
        Work through each step methodically. Report what you're doing and what you find.`,
      },
    ]);

    let fullResponse = "";

    // Stream the response in real-time
    for await (const chunk of streamResult.textStream) {
      process.stdout.write(chunk);
      fullResponse += chunk;
    }

    // Get the final result
    const result = await streamResult.text;

    console.log("✅ Agent finished processing!");
    console.log("📝 Analysis complete, parsing results...");
    console.log(
      "🔍 Raw agent response length:",
      result.length || 0,
      "characters"
    );

    // Log the full response for debugging
    if (result) {
      console.log("\n📄 Full agent response:");
      console.log("=".repeat(50));
      console.log(result);
      console.log("=".repeat(50));
      console.log("");
    }

    // Parse the agent's response
    let pageData: PageContent;

    try {
      // Try to extract JSON from the response
      const jsonMatch = result.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [
        null,
        result,
      ];
      const parsedData = JSON.parse(jsonMatch[1]);

      // Handle new comprehensive format
      if (parsedData.siteMap && parsedData.pages) {
        console.log(
          `🗺️ Site map discovered: ${parsedData.siteMap.totalPages} pages`
        );
        console.log(
          `📄 URLs found: ${parsedData.siteMap.discoveredUrls?.length || 0}`
        );

        // Convert comprehensive data to our PageContent format
        const pages = parsedData.pages.map((page: any) => ({
          pageUrl: page.url,
          pageTitle: page.pageTitle,
          screenshots: [],
          interactions: [],
          optimizableElements:
            page.enhancementOpportunities?.map((opp: any) => ({
              type: opp.area,
              selector: `${opp.area}-element`,
              content: opp.current,
              location: "page",
              importance: opp.priority,
              optimizationPotential: opp.priority,
              issue: opp.issue,
              recommendation: opp.enhancement,
            })) || [],
          visionAnalysis: {
            siteMap: parsedData.siteMap,
            contentSections: page.contentSections,
            ctaElements: page.ctaElements,
            navigationElements: page.navigationElements,
          },
        }));

        console.log(
          `✅ Processed ${pages.length} pages with detailed intelligence`
        );

        // Save findings to markdown file
        await saveAnalysisToMarkdown(
          url,
          result,
          pages,
          Date.now() - startTime
        );

        // Return all pages found
        return {
          type: "website",
          source: url,
          timestamp: Date.now(),
          data: { pages },
        };
      } else {
        // Fallback for single page format
        pageData = {
          pageUrl: parsedData.pageUrl || url,
          pageTitle: parsedData.pageTitle || "Untitled",
          screenshots: [],
          interactions: [],
          optimizableElements: parsedData.optimizableElements || [],
          visionAnalysis: parsedData.visionAnalysis,
        };

        console.log(
          `✅ Found ${pageData.optimizableElements.length} optimization opportunities`
        );
      }
    } catch (parseError) {
      console.warn("⚠️ Could not parse JSON response, creating fallback");
      console.log("📄 Raw response:", result.substring(0, 500));

      // Create fallback analysis
      pageData = {
        pageUrl: url,
        pageTitle: "Analysis Complete",
        screenshots: [],
        interactions: [],
        optimizableElements: [
          {
            type: "analysis",
            selector: "body",
            content: result.substring(0, 200),
            location: "page",
            importance: "medium",
            optimizationPotential: "medium",
            issue: "Raw analysis available",
            recommendation: "Review the detailed analysis text",
          },
        ],
      };
    }

    const scanDuration = Date.now() - startTime;
    console.log(`⏱️ Scan completed in ${(scanDuration / 1000).toFixed(1)}s`);

    // Save findings to markdown file
    await saveAnalysisToMarkdown(
      url,
      result,
      pageData ? [pageData] : [],
      scanDuration
    );

    return {
      type: "website",
      source: url,
      timestamp: Date.now(),
      data: {
        pages: [pageData],
      },
    };
  } catch (mcpError) {
    console.error("❌ MCP connection failed:", mcpError);
    throw new Error(`MCP setup failed: ${mcpError}`);
  }
}

/**
 * Save analysis findings to a markdown file
 */
async function saveAnalysisToMarkdown(
  url: string,
  agentResponse: string,
  pages: PageContent[],
  scanDuration: number
): Promise<void> {
  const timestamp = new Date().toISOString();
  const filename = `steelpush-analysis-${Date.now()}.md`;

  let markdown = `# Website Analysis Report\n\n`;
  markdown += `**Target URL:** ${url}\n`;
  markdown += `**Analysis Date:** ${timestamp}\n`;
  markdown += `**Scan Duration:** ${(scanDuration / 1000).toFixed(1)}s\n\n`;

  markdown += `## Agent's Raw Analysis\n\n`;
  markdown += `\`\`\`\n${agentResponse}\n\`\`\`\n\n`;

  if (pages.length > 0) {
    markdown += `## Structured Findings\n\n`;

    pages.forEach((page, index) => {
      markdown += `### ${index + 1}. ${page.pageTitle}\n`;
      markdown += `**URL:** ${page.pageUrl}\n\n`;

      if (page.optimizableElements.length > 0) {
        markdown += `**Optimization Opportunities:**\n\n`;
        page.optimizableElements.forEach((element, i) => {
          markdown += `${i + 1}. **${element.type.toUpperCase()}** (${element.importance} priority)\n`;
          markdown += `   - **Content:** "${element.content}"\n`;
          markdown += `   - **Location:** ${element.location}\n`;
          markdown += `   - **Issue:** ${element.issue}\n`;
          markdown += `   - **Recommendation:** ${element.recommendation}\n\n`;
        });
      }

      if (page.visionAnalysis) {
        markdown += `**Additional Analysis:**\n`;
        if (page.visionAnalysis.contentSections) {
          markdown += `- Content sections found\n`;
        }
        if (page.visionAnalysis.ctaElements) {
          markdown += `- CTA elements identified\n`;
        }
        if (page.visionAnalysis.navigationElements) {
          markdown += `- Navigation structure mapped\n`;
        }
        markdown += `\n`;
      }
    });
  }

  markdown += `## Summary\n\n`;
  markdown += `- **Pages Analyzed:** ${pages.length}\n`;
  const totalOpportunities = pages.reduce(
    (sum, page) => sum + page.optimizableElements.length,
    0
  );
  markdown += `- **Total Optimization Opportunities:** ${totalOpportunities}\n`;
  markdown += `- **Generated:** ${timestamp}\n`;

  // Write to file
  fs.writeFileSync(filename, markdown);
  console.log(`📄 Markdown report saved to: ${filename}`);
}

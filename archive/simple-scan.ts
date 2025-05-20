import { chromium } from "playwright";
import { MCPClient } from "@mastra/mcp";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import OpenAI from "openai";

// Load environment variables
dotenv.config();

async function simpleScan(url = "https://usetrag.com/") {
  console.log(`Starting simple scan for ${url}`);
  const startTime = Date.now();

  // Create output directory
  const outputDir = "./outputs";
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Launch browser
  const browser = await chromium.launch({
    headless: false,
    slowMo: 200,
  });
  const page = await browser.newPage();

  try {
    // Set up MCP client
    console.log("Setting up MCP client...");
    const mcpClient = new MCPClient({
      servers: {
        playwright: {
          command: "npx",
          args: ["-y", "@playwright/mcp@latest"],
        },
      },
    });

    // Get MCP tools
    console.log("Fetching MCP tools...");
    const mcpTools = await mcpClient.getTools();
    console.log("MCP tools retrieved successfully:", Object.keys(mcpTools));

    // Navigate to URL
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "domcontentloaded" });

    // Take a screenshot
    const screenshotPath = path.join(outputDir, "page-screenshot.png");
    await page.screenshot({ path: screenshotPath });
    console.log(`Screenshot saved: ${screenshotPath}`);

    // Scroll down to see full page
    console.log("Scrolling through page...");
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

    // Capture page metadata for better analysis
    const pageTitle = await page.title();
    const pageUrl = page.url();

    // Create an OpenAI client directly
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Prepare MCP functions for OpenAI
    const browserTools = Object.values(mcpTools).filter((tool) =>
      tool.toolName.startsWith("browser_")
    );

    // Create the function JSON for OpenAI
    const functionDefinitions = browserTools.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.toolName,
        description: tool.description || `Use the ${tool.toolName} function`,
        parameters: {
          type: "object",
          properties: tool.parameters || {},
        },
      },
    }));

    // Make direct call to OpenAI API
    console.log("Requesting analysis from model...");

    const modelName = process.env.OPENAI_MODEL || "gpt-4o-mini";
    console.log(`Using model: ${modelName}`);

    const completion = await openai.chat.completions.create({
      model: modelName,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `You are a conversion optimization expert analyzing ${url}. 
          Focus on identifying specific elements that could be improved for better conversion rates.
          You have direct browser control through MCP tools.`,
        },
        {
          role: "user",
          content: `I'm looking at ${pageTitle} at ${pageUrl} and need your help identifying conversion optimization opportunities.
          
          Please:
          1. Use browser_screen_capture to take a screenshot
          2. Scroll through the page to see all content using browser_execute_function
          3. Identify 3-5 specific elements that could be improved for better conversion rates
          
          Format your final response as a list of numbered points, and for each include:
          - Element type (headline, CTA, etc.)
          - Current content (quote exact text)
          - Location on page
          - The issue
          - Your recommendation
          `,
        },
      ],
      tools: functionDefinitions,
    });

    // Save the completion response
    const responsePath = path.join(outputDir, "analysis-response.json");
    fs.writeFileSync(responsePath, JSON.stringify(completion, null, 2));
    console.log(`Response saved: ${responsePath}`);

    // Extract the final text response
    const finalResponse =
      completion.choices[0]?.message?.content || "No response generated";
    const textPath = path.join(outputDir, "analysis-text.md");
    fs.writeFileSync(textPath, finalResponse);
    console.log(`Analysis text saved: ${textPath}`);

    // Print summary
    console.log("\nScan completed successfully!");
    console.log(
      `Scan duration: ${Math.round((Date.now() - startTime) / 1000)} seconds`
    );
    console.log(`Results saved to: ${outputDir}`);

    // Print preview of response
    console.log("\nAnalysis result preview:");
    console.log("------------------------");
    console.log(
      finalResponse.slice(0, 500) + (finalResponse.length > 500 ? "..." : "")
    );
    console.log("------------------------");

    // Clean up
    await mcpClient.disconnect();
  } catch (error) {
    console.error("Scan failed:", error);
  } finally {
    await browser.close();
  }
}

// Run the scan
simpleScan().catch(console.error);

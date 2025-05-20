import { scanWebsite, WebsiteScanResult } from "./scanner";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Helper to wait between retries
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Simple analysis with reduced functionality
async function main() {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`\nAttempt ${attempts}/${maxAttempts}`);

    try {
      console.log("Starting simplified MCP test...");

      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error(
          "No ANTHROPIC_API_KEY found in environment. Please set this in your .env file."
        );
      }

      console.log("API key found. Starting website analysis...");

      const url = "https://usetrag.com/";

      // Turn on debugging mode
      process.env.DEBUG = "mastra:*,mcp:*";

      const result = await scanWebsite(url, {
        useMcp: true,
        maxPages: 1, // Limit to just the homepage for quick testing
      });

      // Save results
      const outputPath = path.join(process.cwd(), "usetrag-simple-test.json");
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

      console.log(`\nSimple test completed!`);
      console.log(`Results saved to: ${outputPath}`);

      // Log basic results
      const websiteResult = result.data as WebsiteScanResult;
      console.log(`\nSummary:`);
      console.log(`- Pages visited: ${websiteResult.scannedPages.length}`);
      console.log(`- Content items found: ${websiteResult.content.length}`);

      // Success, exit the retry loop
      break;
    } catch (error) {
      console.error(`Test failed (attempt ${attempts}/${maxAttempts}):`, error);

      // Check for specific errors
      if (error instanceof Error) {
        if (error.message.includes("timeout")) {
          console.error(
            "\nTimeout detected. Try increasing the timeout parameter or simplifying the scanning task."
          );
        } else if (error.message.includes("navigator")) {
          console.error(
            "\nNavigation error. The website might be blocking automated browsers."
          );
        } else if (
          error.message.includes("MCP") ||
          error.message.includes("server")
        ) {
          console.error(
            "\nMCP server issue. Try reinstalling the MCP packages:"
          );
          console.error(
            "npm install -g @modelcontextprotocol/server-sequential-thinking @playwright/mcp"
          );
        } else if (
          error.message.includes("API") ||
          error.message.includes("Claude") ||
          error.message.includes("Anthropic") ||
          error.message.includes("empty")
        ) {
          console.error(
            "\nAPI issue with Anthropic. Check your API key and model access."
          );
        }
      }

      // If we have more attempts left, wait before retrying
      if (attempts < maxAttempts) {
        const waitTime = attempts * 5000; // Increase wait time with each attempt
        console.log(`\nRetrying in ${waitTime / 1000} seconds...`);
        await wait(waitTime);
      } else {
        console.error("\nAll retry attempts failed. Exiting.");
      }
    }
  }
}

main();

import { scanWebsite, WebsiteScanResult } from "./scanner";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import readline from "readline";

// Load environment variables
dotenv.config();

// Function to prompt for API key if not available
async function getAnthropicApiKey(): Promise<string> {
  // If API key is already set in environment, use it
  if (process.env.ANTHROPIC_API_KEY) {
    console.log("Using Anthropic API key from environment");
    return process.env.ANTHROPIC_API_KEY;
  }

  // Otherwise prompt the user
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Please enter your Anthropic API key: ", (apiKey) => {
      rl.close();
      process.env.ANTHROPIC_API_KEY = apiKey;

      // Save to .env file for future use
      try {
        const envPath = path.join(process.cwd(), ".env");
        let envContent = "";

        if (fs.existsSync(envPath)) {
          envContent = fs.readFileSync(envPath, "utf-8");

          // Replace existing ANTHROPIC_API_KEY line if it exists
          if (envContent.includes("ANTHROPIC_API_KEY=")) {
            envContent = envContent.replace(
              /ANTHROPIC_API_KEY=.*/,
              `ANTHROPIC_API_KEY=${apiKey}`
            );
          } else {
            // Otherwise add it as a new line
            envContent += `\nANTHROPIC_API_KEY=${apiKey}`;
          }
        } else {
          // Create new .env file
          envContent = `ANTHROPIC_API_KEY=${apiKey}`;
        }

        fs.writeFileSync(envPath, envContent);
        console.log("API key saved to .env file");
      } catch (err) {
        console.warn("Could not save API key to .env file:", err);
      }

      resolve(apiKey);
    });
  });
}

async function main() {
  try {
    console.log("Starting MCP website analysis setup...");

    // Ensure Anthropic API key is set
    const apiKey = await getAnthropicApiKey();
    if (!apiKey) {
      throw new Error(
        "No API key provided. Cannot continue without an Anthropic API key."
      );
    }

    console.log("Starting MCP website analysis for https://usetrag.com/");

    const url = "https://usetrag.com/";
    const result = await scanWebsite(url, {
      useMcp: true,
      timeout: 300000, // 5 minute timeout
    }); // Use the MCP-based scanner

    // Save results to file
    const outputPath = path.join(process.cwd(), "usetrag-mcp-analysis.json");
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    console.log(`\nMCP Analysis completed successfully!`);
    console.log(`Results saved to: ${outputPath}`);

    // Print summary
    const websiteResult = result.data as WebsiteScanResult;
    console.log(`\nSummary:`);
    console.log(`- Scanned ${websiteResult.scannedPages.length} pages`);
    console.log(`- Found ${websiteResult.content.length} content items`);
    console.log(
      `- Scan duration: ${Math.round(websiteResult.metadata.scanDuration / 1000)} seconds`
    );

    // Print sample content items
    if (websiteResult.content.length > 0) {
      console.log(`\nOptimization Opportunities:`);

      // Group by importance and optimization potential
      const highPriorityItems = websiteResult.content.filter(
        (item) =>
          item.importance === "high" && item.optimizationPotential === "high"
      );

      const mediumPriorityItems = websiteResult.content.filter(
        (item) =>
          (item.importance === "high" &&
            item.optimizationPotential === "medium") ||
          (item.importance === "medium" &&
            item.optimizationPotential === "high")
      );

      const lowPriorityItems = websiteResult.content.filter(
        (item) =>
          !highPriorityItems.includes(item) &&
          !mediumPriorityItems.includes(item)
      );

      // Display high priority items first
      if (highPriorityItems.length > 0) {
        console.log(`\n🔴 HIGH PRIORITY ITEMS (${highPriorityItems.length}):`);
        highPriorityItems.forEach((item, i) => {
          console.log(
            `\n${i + 1}. ${item.type.toUpperCase()} (${item.location})`
          );
          console.log(`   URL: ${item.url}`);
          console.log(`   Current: "${item.content}"`);
          if ((item as any).issue)
            console.log(`   Issue: ${(item as any).issue}`);
          if ((item as any).recommendation)
            console.log(`   Recommendation: ${(item as any).recommendation}`);
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
          console.log(`   Current: "${item.content}"`);
          if ((item as any).issue)
            console.log(`   Issue: ${(item as any).issue}`);
          if ((item as any).recommendation)
            console.log(`   Recommendation: ${(item as any).recommendation}`);
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
    }
  } catch (error) {
    console.error("MCP Analysis failed:", error);

    if (error instanceof Error) {
      // Display more specific error guidance
      if (error.message.includes("API")) {
        console.error("\nThis appears to be an API issue. Please check:");
        console.error("- Your Anthropic API key is valid and not expired");
        console.error(
          "- The model name 'claude-3-7-sonnet-20250219' is available to your account"
        );
        console.error(
          "- You have sufficient credits in your Anthropic account"
        );
      } else if (
        error.message.includes("MCP") ||
        error.message.includes("tool")
      ) {
        console.error("\nThis appears to be an MCP issue. Please check:");
        console.error("- The required MCP servers are installed correctly");
        console.error("- The npx commands are running properly");
      }
    }
  }
}

main();

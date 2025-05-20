import { scanWebsite, WebsiteScanResult } from "./scanner";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import readline from "readline";

// Load environment variables
dotenv.config();

// Function to prompt for API key if not available
async function getOpenAIApiKey(): Promise<string> {
  // If API key is already set in environment, use it
  if (process.env.OPENAI_API_KEY) {
    console.log("Using OpenAI API key from environment");
    return process.env.OPENAI_API_KEY;
  }

  // Otherwise prompt the user
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Please enter your OpenAI API key: ", (apiKey) => {
      rl.close();
      process.env.OPENAI_API_KEY = apiKey;

      // Save to .env file for future use
      try {
        const envPath = path.join(process.cwd(), ".env");
        let envContent = "";

        if (fs.existsSync(envPath)) {
          envContent = fs.readFileSync(envPath, "utf-8");

          // Replace existing OPENAI_API_KEY line if it exists
          if (envContent.includes("OPENAI_API_KEY=")) {
            envContent = envContent.replace(
              /OPENAI_API_KEY=.*/,
              `OPENAI_API_KEY=${apiKey}`
            );
          } else {
            // Otherwise add it as a new line
            envContent += `\nOPENAI_API_KEY=${apiKey}`;
          }
        } else {
          // Create new .env file
          envContent = `OPENAI_API_KEY=${apiKey}`;
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
    console.log("Starting OpenAI-powered website analysis...");

    // Ensure OpenAI API key is set
    const apiKey = await getOpenAIApiKey();
    if (!apiKey) {
      throw new Error(
        "No API key provided. Cannot continue without an OpenAI API key."
      );
    }

    console.log("Starting analysis for https://usetrag.com/");

    const url = "https://usetrag.com/";
    const result = await scanWebsite(url, {
      useDirectMcp: true, // Use the direct MCP scanner
    });

    // Save results to file
    const outputPath = path.join(process.cwd(), "usetrag-openai-analysis.json");
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    console.log(`\nAnalysis completed successfully!`);
    console.log(`Results saved to: ${outputPath}`);

    // Print summary
    const websiteResult = result.data as WebsiteScanResult;
    console.log(`\nSummary:`);
    console.log(`- Scanned ${websiteResult.scannedPages.length} pages`);
    console.log(`- Found ${websiteResult.content.length} content items`);
    console.log(
      `- Scan duration: ${Math.round(websiteResult.metadata.scanDuration / 1000)} seconds`
    );

    // Print content items
    if (websiteResult.content.length > 0) {
      console.log(`\nOptimization Opportunities:`);

      websiteResult.content.forEach((item, i) => {
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

      console.log(`\nFull analysis saved to: ${outputPath}`);
    }
  } catch (error) {
    console.error("Analysis failed:", error);

    if (error instanceof Error) {
      // Display more specific error guidance
      if (error.message.includes("API")) {
        console.error("\nThis appears to be an API issue. Please check:");
        console.error("- Your OpenAI API key is valid and not expired");
        console.error("- You have sufficient credits in your OpenAI account");
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

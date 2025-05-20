import { scanWebsite, WebsiteScanResult } from "./scanner";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import readline from "readline";

// Load environment variables
dotenv.config();

// Function to prompt for API key if not available
async function getApiKey(): Promise<boolean> {
  // Check for OpenAI key first
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 10) {
    console.log("Using OpenAI API key from environment");
    return true;
  }
  
  // Check for Anthropic key next
  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length > 10) {
    console.log("Using Anthropic API key from environment");
    return true;
  }

  // Otherwise prompt the user
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Which AI provider do you want to use? (1 for OpenAI, 2 for Anthropic): ", async (choice) => {
      if (choice === "1" || choice.toLowerCase().includes("open")) {
        const apiKey = await promptForKey(rl, "OpenAI", "OPENAI_API_KEY");
        const model = await promptForModel(rl, "OpenAI", "gpt-4o");
        process.env.OPENAI_MODEL = model;
        rl.close();
        resolve(apiKey.length > 0);
      } else {
        const apiKey = await promptForKey(rl, "Anthropic", "ANTHROPIC_API_KEY");
        rl.close();
        resolve(apiKey.length > 0);
      }
    });
  });
}

async function promptForKey(rl: readline.Interface, provider: string, envVar: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(`Please enter your ${provider} API key: `, (apiKey) => {
      if (apiKey && apiKey.length > 0) {
        process.env[envVar] = apiKey;

        // Save to .env file for future use
        try {
          const envPath = path.join(process.cwd(), ".env");
          let envContent = "";

          if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, "utf-8");

            // Replace existing key line if it exists
            if (envContent.includes(`${envVar}=`)) {
              envContent = envContent.replace(
                new RegExp(`${envVar}=.*`),
                `${envVar}=${apiKey}`
              );
            } else {
              // Otherwise add it as a new line
              envContent += `\n${envVar}=${apiKey}`;
            }
          } else {
            // Create new .env file
            envContent = `${envVar}=${apiKey}`;
          }

          fs.writeFileSync(envPath, envContent);
          console.log(`${provider} API key saved to .env file`);
        } catch (err) {
          console.warn(`Could not save ${provider} API key to .env file:`, err);
        }
      }
      resolve(apiKey);
    });
  });
}

async function promptForModel(rl: readline.Interface, provider: string, defaultModel: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(`Enter ${provider} model to use (default: ${defaultModel}): `, (model) => {
      const selectedModel = model && model.trim().length > 0 ? model.trim() : defaultModel;
      
      // Save to .env file
      try {
        const envPath = path.join(process.cwd(), ".env");
        let envContent = "";

        if (fs.existsSync(envPath)) {
          envContent = fs.readFileSync(envPath, "utf-8");

          // Replace existing model line if it exists
          if (envContent.includes(`${provider.toUpperCase()}_MODEL=`)) {
            envContent = envContent.replace(
              new RegExp(`${provider.toUpperCase()}_MODEL=.*`),
              `${provider.toUpperCase()}_MODEL=${selectedModel}`
            );
          } else {
            // Otherwise add it as a new line
            envContent += `\n${provider.toUpperCase()}_MODEL=${selectedModel}`;
          }
        } else {
          // Create new .env file
          envContent = `${provider.toUpperCase()}_MODEL=${selectedModel}`;
        }

        fs.writeFileSync(envPath, envContent);
        console.log(`${provider} model preference saved to .env file`);
      } catch (err) {
        console.warn(`Could not save ${provider} model preference to .env file:`, err);
      }
      
      resolve(selectedModel);
    });
  });
}

async function main() {
  try {
    console.log("Starting Enhanced MCP website analysis setup...");

    // Ensure API key is set
    const hasApiKey = await getApiKey();
    if (!hasApiKey) {
      throw new Error(
        "No API key provided. Cannot continue without an API key."
      );
    }

    // Target URL (can be customized)
    const defaultUrl = "https://example.com/"; // Use example.com which is more reliable for testing
    
    // Allow command line argument for URL
    const url = process.argv[2] || defaultUrl;
    
    console.log(`Starting enhanced website analysis for ${url}`);

    const result = await scanWebsite(url, {
      useEnhancedMcp: true,  // Use our enhanced scanner
      maxPages: 5,           // Analyze up to 5 pages
      maxDepth: 2,           // Go up to 2 clicks deep
      headless: true,        // Run headless by default
      timeout: 300000,       // 5 minute timeout
    });

    // Save results to file
    const outputPath = path.join(process.cwd(), "usetrag-enhanced-analysis.json");
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    console.log(`\nEnhanced Analysis completed successfully!`);
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
      
      // Mention screenshot location
      console.log(`\nScreenshots saved to: ${path.join(process.cwd(), "screenshots")}`);
    }
  } catch (error) {
    console.error("Enhanced Analysis failed:", error);

    if (error instanceof Error) {
      // Display more specific error guidance
      if (error.message.includes("API")) {
        console.error("\nThis appears to be an API issue. Please check:");
        console.error("- Your API key is valid and not expired");
        console.error("- You have sufficient credits in your account");
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
import fs from "fs";
import path from "path";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { Agent } from "@mastra/core/agent";
import dotenv from "dotenv";
import readline from "readline";

// Load environment variables
dotenv.config();

// Define content item interface
interface ContentItem {
  url: string;
  type: string;
  content: string;
  location: string;
  importance: string;
  optimizationPotential: string;
  issue?: string;
  recommendation?: string;
  variants?: string[];
}

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

// Mock function to generate variants
async function generateVariants(
  content: ContentItem[],
  numVariants: number = 3
): Promise<ContentItem[]> {
  // Get API key
  const apiKey = await getOpenAIApiKey();
  if (!apiKey) {
    throw new Error(
      "No API key provided. Cannot continue without an OpenAI API key."
    );
  }

  // Determine the model to use
  const modelType = process.env.OPENAI_MODEL || "gpt-4o-mini";
  console.log(`Using model: ${modelType}`);

  // Create agent to generate variants
  const agent = new Agent({
    name: "content-variant-generator",
    instructions: `Generate creative, high-converting variants for website content.`,
    model: process.env.OPENAI_API_KEY
      ? openai(modelType)
      : anthropic("claude-3-7-sonnet-20250219"),
  });

  // Generate variants for each content item
  const contentWithVariants: ContentItem[] = [];

  for (const item of content) {
    console.log(`\nGenerating variants for: "${item.content}"`);

    // Prepare prompt based on content type
    let prompt = `Generate ${numVariants} high-converting variants for this ${item.type}:\n\n`;
    prompt += `Current content: "${item.content}"\n\n`;
    prompt += `Issue: ${item.issue}\n\n`;
    prompt += `Recommendation: ${item.recommendation}\n\n`;
    prompt += `Provide ${numVariants} different variations that address the issues and follow the recommendation.`;
    prompt += `Format your response as a JSON array of strings containing only the variants.`;

    // Generate variants
    const result = await agent.generate([{ role: "user", content: prompt }]);

    // Extract variants from response
    let variants: string[] = [];

    try {
      // Try to parse JSON from the response
      const jsonMatch =
        result.text?.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ||
        result.text?.match(/\[\s*".*"\s*\]/s);

      if (jsonMatch && jsonMatch[1]) {
        variants = JSON.parse(jsonMatch[1].trim());
      } else if (result.text) {
        // Fallback: extract lines that look like variants
        variants = result.text
          .split("\n")
          .filter(
            (line) => line.match(/^\d+[\.\)]\s+["']/) || line.match(/^["']/)
          )
          .map((line) =>
            line.replace(/^\d+[\.\)]\s+["']|^["']|["']$/g, "").trim()
          )
          .filter((line) => line.length > 0);

        // Ensure we have at most numVariants
        variants = variants.slice(0, numVariants);
      }
    } catch (error) {
      console.warn(
        `Could not parse variants as JSON: ${error}. Using fallback.`
      );

      // Fallback to simple extraction
      if (result.text) {
        variants = result.text
          .split("\n")
          .filter(
            (line) =>
              line.length > 10 && !line.includes(":") && !line.includes("```")
          )
          .map((line) => line.trim())
          .slice(0, numVariants);
      }
    }

    // If we still don't have variants, create some mock ones
    if (!variants || variants.length === 0) {
      variants = [
        `${item.recommendation?.replace("Make it more specific: '", "").replace("'", "") || "No recommendation"}`,
        `Enhanced version of: ${item.content}`,
        `Alternative: ${item.content} (Improved)`,
      ];
    }

    // Add variants to content item
    contentWithVariants.push({
      ...item,
      variants: variants.slice(0, numVariants),
    });

    // Print variants
    console.log("Generated variants:");
    variants.forEach((v: string, i: number) => console.log(`${i + 1}. "${v}"`));
  }

  return contentWithVariants;
}

async function main() {
  try {
    console.log("Starting content variant generation...");

    // Read input analysis file
    let analysisPath = process.argv[2] || "mock-website-analysis.json";

    // Check if the file exists
    if (!fs.existsSync(analysisPath)) {
      console.error(`File not found: ${analysisPath}`);
      return;
    }

    console.log(`Reading analysis from: ${analysisPath}`);
    const analysis = JSON.parse(fs.readFileSync(analysisPath, "utf-8"));

    // Extract content items
    const websiteResult = analysis.data;
    const contentItems = websiteResult.content as ContentItem[];

    console.log(
      `Generating variants for ${contentItems.length} content items...`
    );

    // Generate variants
    const contentWithVariants = await generateVariants(contentItems);

    // Update the analysis with variants
    analysis.data.content = contentWithVariants;

    // Save updated analysis
    const outputPath = path.join(process.cwd(), "website-variants.json");
    fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2));

    console.log(`\nVariant generation completed successfully!`);
    console.log(`Results saved to: ${outputPath}`);

    // Print summary
    console.log(`\nSummary:`);
    console.log(
      `- Generated variants for ${contentWithVariants.length} content items`
    );
    contentWithVariants.forEach((item: ContentItem, i: number) => {
      console.log(`\n${i + 1}. ${item.type.toUpperCase()} (${item.location})`);
      console.log(`   Current: "${item.content}"`);
      console.log(`   Variants:`);
      item.variants?.forEach((v: string, j: number) => {
        console.log(`     ${j + 1}. "${v}"`);
      });
    });
  } catch (error) {
    console.error("Variant generation failed:", error);
  }
}

// Run the script
main();

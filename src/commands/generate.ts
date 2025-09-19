/**
 * Generate command implementation - generates optimized content for approved opportunities
 */

import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { REQAnalysisResult, REQOpportunity } from "../utils/format-converter";

interface GeneratedContent {
  opportunity_id: string;
  original_content: string;
  optimized_content: string;
  generation_reasoning: string;
  generation_timestamp: string;
}

interface GenerationResult {
  website_url: string;
  generation_timestamp: string;
  generated_content: GeneratedContent[];
}

export function generateCommand(program: Command): Command {
  return program
    .command("generate <analysis-file>")
    .description("Generate optimized content for approved opportunities")
    .option("-o, --output <path>", "Output file path for generated content")
    .option("--model <model>", "AI model to use for generation", "gpt-4")
    .option("--temperature <temp>", "Generation temperature (0-1)", "0.7")
    .action(async (analysisFile, options) => {
      console.log(`Generating optimized content from ${analysisFile}...`);

      try {
        // Load analysis file
        if (!fs.existsSync(analysisFile)) {
          console.error(`Analysis file not found: ${analysisFile}`);
          process.exit(1);
        }

        const analysisData: REQAnalysisResult = JSON.parse(
          fs.readFileSync(analysisFile, "utf-8")
        );

        // Filter for approved opportunities only
        const approvedOpportunities = analysisData.opportunities.filter(
          (opp) => opp.approved === true
        );

        if (approvedOpportunities.length === 0) {
          console.log(
            "No approved opportunities found. Use the approve command first."
          );
          process.exit(0);
        }

        console.log(
          `Found ${approvedOpportunities.length} approved opportunities to generate content for`
        );

        const generatedContent: GeneratedContent[] = [];

        // Generate content for each approved opportunity
        for (const opportunity of approvedOpportunities) {
          console.log(
            `Generating content for ${opportunity.id}: ${opportunity.element_type}`
          );

          const optimizedContent = await generateOptimizedContent(
            opportunity,
            options.model,
            parseFloat(options.temperature)
          );

          generatedContent.push({
            opportunity_id: opportunity.id,
            original_content: opportunity.original_content,
            optimized_content: optimizedContent.content,
            generation_reasoning: optimizedContent.reasoning,
            generation_timestamp: new Date().toISOString(),
          });

          console.log(`✓ Generated content for ${opportunity.id}`);
        }

        // Create result object
        const result: GenerationResult = {
          website_url: analysisData.website_url,
          generation_timestamp: new Date().toISOString(),
          generated_content: generatedContent,
        };

        // Save results
        const outputPath =
          options.output || `steelpush-generated-${Date.now()}.json`;

        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

        console.log(`\n✅ Content generation complete!`);
        console.log(
          `Generated optimized content for ${generatedContent.length} opportunities`
        );
        console.log(`Results saved to ${outputPath}`);

        // Show summary
        console.log("\n📋 Generated Content Summary:");
        generatedContent.forEach((content) => {
          console.log(`\n${content.opportunity_id}:`);
          console.log(
            `  Original: "${content.original_content.substring(0, 60)}${content.original_content.length > 60 ? "..." : ""}"`
          );
          console.log(
            `  Optimized: "${content.optimized_content.substring(0, 60)}${content.optimized_content.length > 60 ? "..." : ""}"`
          );
        });
      } catch (error) {
        console.error("Content generation failed:", error);
        process.exit(1);
      }
    });
}

/**
 * Generate optimized content for a single opportunity using AI
 */
async function generateOptimizedContent(
  opportunity: REQOpportunity,
  model: string = "gpt-4",
  temperature: number = 0.7
): Promise<{ content: string; reasoning: string }> {
  // For now, implement a simple rule-based generation
  // In a real implementation, this would use OpenAI or similar API

  const elementType = opportunity.element_type;
  const originalContent = opportunity.original_content;
  const optimizationReasoning = opportunity.optimization_reasoning;

  let optimizedContent = "";
  let reasoning = "";

  switch (elementType) {
    case "headline":
      optimizedContent = generateOptimizedHeadline(
        originalContent,
        optimizationReasoning
      );
      reasoning =
        "Enhanced headline with stronger value proposition and urgency";
      break;

    case "cta_button":
      optimizedContent = generateOptimizedCTA(
        originalContent,
        optimizationReasoning
      );
      reasoning = "Improved CTA with more specific action and benefit";
      break;

    case "text_content":
      optimizedContent = generateOptimizedText(
        originalContent,
        optimizationReasoning
      );
      reasoning = "Enhanced text content for better engagement and clarity";
      break;

    case "form_element":
      optimizedContent = generateOptimizedForm(
        originalContent,
        optimizationReasoning
      );
      reasoning = "Optimized form element to reduce friction";
      break;

    default:
      optimizedContent = enhanceGenericContent(
        originalContent,
        optimizationReasoning
      );
      reasoning = "Generic content optimization for better conversion";
  }

  return {
    content: optimizedContent,
    reasoning: reasoning,
  };
}

/**
 * Generate optimized headline
 */
function generateOptimizedHeadline(
  original: string,
  reasoning: string
): string {
  // Simple rule-based headline optimization
  const benefitWords = [
    "Save",
    "Get",
    "Increase",
    "Boost",
    "Transform",
    "Achieve",
  ];
  const urgencyWords = ["Today", "Now", "Instantly", "Fast", "Quick"];

  if (
    original.toLowerCase().includes("welcome") ||
    original.toLowerCase().includes("hello")
  ) {
    return `${benefitWords[Math.floor(Math.random() * benefitWords.length)]} More Results ${urgencyWords[Math.floor(Math.random() * urgencyWords.length)]}`;
  }

  if (original.length < 30) {
    return `${original} - ${urgencyWords[Math.floor(Math.random() * urgencyWords.length)]}`;
  }

  return `${benefitWords[Math.floor(Math.random() * benefitWords.length)]} ${original.split(" ").slice(1).join(" ")}`;
}

/**
 * Generate optimized CTA
 */
function generateOptimizedCTA(original: string, reasoning: string): string {
  const actionWords = [
    "Get Started",
    "Try Free",
    "Start Now",
    "Get Access",
    "Join Today",
  ];

  if (
    original.toLowerCase().includes("click") ||
    original.toLowerCase().includes("here")
  ) {
    return actionWords[Math.floor(Math.random() * actionWords.length)];
  }

  if (
    original.toLowerCase() === "submit" ||
    original.toLowerCase() === "send"
  ) {
    return "Get My Free Quote";
  }

  if (original.length < 10) {
    return `${original} Now`;
  }

  return actionWords[Math.floor(Math.random() * actionWords.length)];
}

/**
 * Generate optimized text content
 */
function generateOptimizedText(original: string, reasoning: string): string {
  // Add benefit-focused language
  if (
    original.includes("we") ||
    original.includes("us") ||
    original.includes("our")
  ) {
    return original.replace(/we|us|our/gi, "you").replace(/We|Us|Our/g, "You");
  }

  if (!original.includes("you") && original.length > 20) {
    return `You'll love how ${original.toLowerCase()}`;
  }

  return original;
}

/**
 * Generate optimized form element
 */
function generateOptimizedForm(original: string, reasoning: string): string {
  if (original.toLowerCase().includes("email")) {
    return "Enter your email for instant access";
  }

  if (original.toLowerCase().includes("name")) {
    return "Your first name";
  }

  if (original.toLowerCase().includes("phone")) {
    return "Phone (optional)";
  }

  return `${original} (quick & easy)`;
}

/**
 * Enhance generic content
 */
function enhanceGenericContent(original: string, reasoning: string): string {
  if (original.length < 50) {
    return `${original} - proven results guaranteed`;
  }

  return original.replace(/\.$/, "") + " with proven results.";
}

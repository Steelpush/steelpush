#!/usr/bin/env node

import { Command } from "commander";
import fs from "fs";
import path from "path";
import { scan, scanWebsite, scanCodebase } from "./scanner";
import dotenv from "dotenv";
import {
  exportContentToMarkdown,
  exportContentToJson,
  exportContentToCsv,
} from "./exporter";

// Setup
dotenv.config();
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../package.json"), "utf-8")
);

// Create CLI program
const program = new Command();

program
  .name("steelpush")
  .description("AI-powered website optimization tool")
  .version(packageJson.version);

// Create config directory if it doesn't exist
const configDir = path.join(
  process.env.HOME || process.env.USERPROFILE || ".",
  ".steelpush"
);
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

const configPath = path.join(configDir, "config.json");

// Initialize command
program
  .command("init")
  .description("Initialize Steelpush configuration")
  .option("-k, --api-key <key>", "API key for the selected provider")
  .option("-p, --provider <provider>", "AI provider (anthropic or openai)", "anthropic")
  .option("-m, --model <model>", "AI model to use")
  .action(async (options) => {
    console.log("Initializing Steelpush...");
    
    // Set default model based on provider
    const defaultModel = options.provider === "anthropic" ? 
      "claude-3-7-sonnet-20250219" : 
      "gpt-4-turbo";
    
    const model = options.model || defaultModel;
    
    // Determine which environment variable to check
    const envVarName = options.provider === "anthropic" ? 
      "ANTHROPIC_API_KEY" : 
      "OPENAI_API_KEY";
      
    // Get API key if not provided
    let apiKey = options.apiKey || process.env[envVarName];
    if (!apiKey) {
      const { default: inquirer } = await import("inquirer");
      const answers = await inquirer.prompt([
        {
          type: "password",
          name: "apiKey",
          message: `Enter your ${options.provider === "anthropic" ? "Anthropic" : "OpenAI"} API key:`,
          validate: (input: string) =>
            input.length > 0 ? true : "API key is required",
        },
      ]);
      apiKey = answers.apiKey;
    }

    // Create config
    const config = {
      ai: {
        provider: options.provider,
        model: model,
        apiKey,
      },
      simulation: {
        visitorCount: 10,
        personaCount: 3,
      },
      analysis: {
        optimizableElements: ["headlines", "cta", "value-props"],
        confidenceThreshold: 0.85,
      },
    };

    // Save config
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`Configuration saved to ${configPath}`);

    // Also save to .env for current session
    fs.writeFileSync(".env", `${envVarName}=${apiKey}\n`);
    console.log(`API key saved to .env as ${envVarName} for current session`);

    console.log("\nSteelpush initialized successfully!");
    console.log(`Using provider: ${options.provider}`);
    console.log(`Using model: ${model}`);
  });

// Analyze command
program
  .command("analyze <target>")
  .description("Analyze a website or codebase")
  .option("-o, --output <path>", "Output file path")
  .option(
    "-f, --format <format>",
    "Output format (json, markdown, csv)",
    "json"
  )
  .option(
    "-m, --max-items <number>",
    "Maximum number of pages/files to scan",
    "10"
  )
  .action(async (target, options) => {
    console.log(`Analyzing ${target}...`);

    // Check if config exists
    if (!fs.existsSync(configPath)) {
      console.error("Steelpush not initialized. Run 'steelpush init' first.");
      process.exit(1);
    }

    // Load config
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    process.env.OPENAI_API_KEY = config.ai.apiKey;

    try {
      // Run the scan
      const scanOptions = {
        maxPages: parseInt(options.maxItems),
        maxFiles: parseInt(options.maxItems),
      };

      const result = await scan(target, scanOptions);

      // Determine output path
      const outputPath =
        options.output || `steelpush-analysis-${Date.now()}.${options.format}`;

      // Export results
      switch (options.format) {
        case "markdown":
          await exportContentToMarkdown(result, outputPath);
          break;
        case "csv":
          await exportContentToCsv(result, outputPath);
          break;
        case "json":
        default:
          await exportContentToJson(result, outputPath);
          break;
      }

      console.log(`\nAnalysis complete!`);
      console.log(`Results saved to ${outputPath}`);
    } catch (error) {
      console.error("Analysis failed:", error);
      process.exit(1);
    }
  });

// Generate command
program
  .command("generate")
  .description("Generate content variants for optimizable elements")
  .option("-i, --input <path>", "Analysis results file (from analyze command)")
  .option("-o, --output <path>", "Output file path")
  .option("-c, --count <number>", "Number of variants to generate", "3") 
  .option("-t, --types <types>", "Comma-separated types of content to focus on (e.g., headline,cta)")
  .action(async (options) => {
    console.log("Generating content variants...");

    // Check if input file exists
    if (!options.input || !fs.existsSync(options.input)) {
      console.error("Input file not found. Run 'steelpush analyze' first.");
      process.exit(1);
    }

    // Load config
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    process.env.OPENAI_API_KEY = config.ai.apiKey;

    try {
      // Read analysis results
      const analysis = JSON.parse(fs.readFileSync(options.input, "utf-8"));
      
      // Get content types to focus on
      const focusTypes = options.types ? options.types.split(',') : null;
      
      // Import the generator function
      const { generateVariants } = await import("./generators");
      
      // Extract optimizable elements from analysis
      const elements = [];
      
      if (analysis.type === "website") {
        // Handle website scan results
        const pageContent = analysis.data.pages;
        
        for (const page of pageContent) {
          if (page.optimizableElements) {
            for (const element of page.optimizableElements) {
              // Filter by type if types are specified
              if (!focusTypes || focusTypes.includes(element.type)) {
                elements.push({
                  type: element.type,
                  selector: element.selector,
                  content: element.content,
                  context: element.context || page.pageTitle,
                  url: page.url
                });
              }
            }
          }
        }
      } else if (analysis.type === "codebase") {
        // Handle codebase scan results with similar structure 
        const codeContent = analysis.data.files;
        
        for (const file of codeContent) {
          if (file.optimizableElements) {
            for (const element of file.optimizableElements) {
              if (!focusTypes || focusTypes.includes(element.type)) {
                elements.push({
                  type: element.type,
                  selector: element.selector || file.path,
                  content: element.content,
                  context: element.context || file.path,
                  file: file.path
                });
              }
            }
          }
        }
      }
      
      if (elements.length === 0) {
        console.log("No optimizable elements found in the analysis.");
        process.exit(0);
      }
      
      console.log(`Found ${elements.length} optimizable elements to generate variants for.`);
      
      // Generate variants for each element
      const variantCount = parseInt(options.count);
      const results = [];
      
      for (const [index, element] of elements.entries()) {
        console.log(`[${index + 1}/${elements.length}] Generating variants for ${element.type}: "${element.content.substring(0, 50)}..."`);
        
        try {
          const variants = await generateVariants(element);
          
          // Limit to requested number of variants
          const limitedVariants = variants.slice(0, variantCount);
          
          results.push({
            original: element,
            variants: limitedVariants
          });
          
          console.log(`  Generated ${limitedVariants.length} variants`);
        } catch (error) {
          console.error(`  Error generating variants: ${error.message}`);
        }
      }
      
      // Determine output path
      const outputPath = options.output || `steelpush-variants-${Date.now()}.json`;
      
      // Create output
      const output = {
        source: analysis.source,
        timestamp: Date.now(),
        originalAnalysis: options.input,
        elements: results
      };
      
      // Save results
      fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
      console.log(`\nVariant generation complete!`);
      console.log(`Generated variants for ${results.length} elements`);
      console.log(`Results saved to ${outputPath}`);
      
    } catch (error) {
      console.error("Variant generation failed:", error);
      process.exit(1);
    }
  });

// Simulate command
program
  .command("simulate")
  .description("Run AI agent simulation")
  .option(
    "-i, --input <path>",
    "Generated variants file (from generate command)"
  )
  .option("-o, --output <path>", "Output file path")
  .option("-v, --visitors <number>", "Number of simulated visitors", "10")
  .option("-p, --personas <number>", "Number of persona types to use", "3")
  .option("-m, --mode <mode>", "Simulation mode (ai-only, browser)", "ai-only")
  .action(async (options) => {
    console.log("Running simulation...");

    // Check if input file exists
    if (!options.input || !fs.existsSync(options.input)) {
      console.error("Input file not found. Run 'steelpush generate' first.");
      process.exit(1);
    }

    // Load config
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    process.env.OPENAI_API_KEY = config.ai.apiKey;

    try {
      // Determine which simulation approach to use
      if (options.mode === "browser") {
        console.log("Using browser-based simulation with Playwright...");
        
        // Import the full simulation functionality
        const { simulateTraffic } = await import("./simulator");
        
        // Read the variants file
        const variantsData = JSON.parse(fs.readFileSync(options.input, "utf-8"));
        
        if (!variantsData.elements || !Array.isArray(variantsData.elements)) {
          console.error("Invalid variants format");
          process.exit(1);
        }
        
        // Extract content variants for simulation
        const allContentVariants = [];
        
        for (const element of variantsData.elements) {
          const original = element.original;
          const variants = element.variants || [];
          
          // Skip if no variants
          if (variants.length === 0) {
            continue;
          }
          
          // Add original and variants for testing
          allContentVariants.push({
            type: original.type,
            original: original.content,
            selector: original.selector,
            context: original.context,
            variants: variants.map(v => ({
              content: v.content,
              score: v.score,
              reasoning: v.reasoning
            }))
          });
        }
        
        // Run the simulation
        const simulationResults = await simulateTraffic(allContentVariants, {
          visitorCount: parseInt(options.visitors),
          personaCount: parseInt(options.personas),
          duration: "5m" // Default duration
        });
        
        // Save simulation results
        const outputPath = options.output || `steelpush-simulation-${Date.now()}.json`;
        
        const output = {
          source: variantsData.source,
          timestamp: Date.now(),
          originalVariants: options.input,
          simulationOptions: {
            visitorCount: parseInt(options.visitors),
            personaCount: parseInt(options.personas),
            mode: options.mode
          },
          elements: variantsData.elements,
          simulationResults
        };
        
        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
        console.log(`\nSimulation complete!`);
        console.log(`Simulated ${options.visitors} visitors with ${options.personas} personas`);
        console.log(`Results saved to ${outputPath}`);
        
      } else {
        // Use the simpler AI-only simulation approach
        console.log("Using AI-only simulation (no browser)...");
        
        // Import the simpler simulation functionality
        const { simulateConversions } = await import("./simulator/simulate-conversions");
        
        // Run the simulation
        await simulateConversions(options.input);
        
        console.log(`\nAI simulation complete!`);
        console.log(`Results saved to website-conversion-simulation.json`);
      }
      
    } catch (error) {
      console.error("Simulation failed:", error);
      process.exit(1);
    }
  });

// Results command
program
  .command("results")
  .description("View optimization results")
  .option(
    "-i, --input <path>",
    "Simulation results file (from simulate command)"
  )
  .option("-o, --output <path>", "Output file path")
  .option(
    "-f, --format <format>",
    "Output format (json, markdown, csv)",
    "markdown"
  )
  .option(
    "-c, --confidence-threshold <threshold>",
    "Confidence threshold for recommendations (0-1)",
    "0.7"
  )
  .action(async (options) => {
    console.log("Analyzing results...");

    // Check if input file exists
    if (!options.input || !fs.existsSync(options.input)) {
      console.error("Input file not found. Run 'steelpush simulate' first.");
      process.exit(1);
    }

    try {
      // Read simulation results
      const simResults = JSON.parse(fs.readFileSync(options.input, "utf-8"));
      const confidenceThreshold = parseFloat(options.confidenceThreshold);
      
      if (!simResults.elements || !Array.isArray(simResults.elements)) {
        console.error("Invalid simulation results format");
        process.exit(1);
      }
      
      // Analyze the results and generate recommendations
      const recommendations = [];
      const rejectedRecommendations = [];
      let totalImprovementConfidence = 0;
      let totalRecommendations = 0;
      
      for (const element of simResults.elements) {
        const original = element.original;
        const variants = element.variants || [];
        
        if (variants.length === 0) {
          continue;
        }
        
        // Find the best variant based on score
        const bestVariant = variants.reduce((best, current) => {
          return (current.score > best.score) ? current : best;
        }, variants[0]);
        
        // Skip if below confidence threshold
        if (bestVariant.score < confidenceThreshold) {
          rejectedRecommendations.push({
            originalContent: original.content,
            type: original.type,
            bestVariant: bestVariant.content,
            confidence: bestVariant.score,
            reasoning: bestVariant.reasoning,
            location: original.selector || original.url || original.file,
            rejected: true,
            rejectionReason: `Confidence score below threshold (${confidenceThreshold})`
          });
          continue;
        }
        
        // Add to recommendations
        recommendations.push({
          originalContent: original.content,
          type: original.type,
          bestVariant: bestVariant.content,
          confidence: bestVariant.score,
          reasoning: bestVariant.reasoning,
          location: original.selector || original.url || original.file,
          improvementEstimate: `${((bestVariant.score - 0.5) * 100).toFixed(0)}%`
        });
        
        totalImprovementConfidence += bestVariant.score;
        totalRecommendations++;
      }
      
      // Create the results object
      const analysisResults = {
        timestamp: Date.now(),
        source: simResults.source,
        originalSimulation: options.input,
        metadata: {
          totalElements: simResults.elements.length,
          totalRecommendations: recommendations.length,
          rejectedRecommendations: rejectedRecommendations.length,
          confidenceThreshold: confidenceThreshold,
          averageConfidence: totalRecommendations > 0 ? 
            (totalImprovementConfidence / totalRecommendations).toFixed(2) : 0,
          estimatedOverallImprovement: totalRecommendations > 0 ?
            `${(((totalImprovementConfidence / totalRecommendations) - 0.5) * 100).toFixed(0)}%` : "0%"
        },
        recommendations,
        rejectedRecommendations
      };
      
      // Determine output path
      const outputPath = options.output || `steelpush-recommendations-${Date.now()}.${options.format}`;
      
      // Export results based on format
      switch (options.format) {
        case "markdown":
          await createOptimizationReportMarkdown(analysisResults, outputPath);
          break;
        case "csv":
          await exportRecommendationsToCsv(analysisResults, outputPath);
          break;
        case "json":
        default:
          fs.writeFileSync(outputPath, JSON.stringify(analysisResults, null, 2));
          break;
      }
      
      console.log(`\nResults analysis complete!`);
      console.log(`Found ${recommendations.length} recommendations with confidence above ${confidenceThreshold}`);
      console.log(`Estimated overall improvement: ${analysisResults.metadata.estimatedOverallImprovement}`);
      console.log(`Results saved to ${outputPath}`);
    } catch (error) {
      console.error("Results analysis failed:", error);
      process.exit(1);
    }
  });

// Helper functions for the results command
async function createOptimizationReportMarkdown(results, outputPath) {
  let markdown = `# Steelpush Optimization Recommendations\n\n`;
  
  // Executive Summary
  markdown += `## Executive Summary\n\n`;
  markdown += `- **Source**: ${results.source}\n`;
  markdown += `- **Analyzed**: ${new Date(results.timestamp).toLocaleString()}\n`;
  markdown += `- **Total recommendations**: ${results.metadata.totalRecommendations}\n`;
  markdown += `- **Confidence threshold**: ${results.metadata.confidenceThreshold}\n`;
  markdown += `- **Average confidence**: ${results.metadata.averageConfidence}\n`;
  markdown += `- **Estimated overall improvement**: ${results.metadata.estimatedOverallImprovement}\n\n`;
  
  // Top Recommendations
  markdown += `## Top Recommendations\n\n`;
  
  if (results.recommendations.length === 0) {
    markdown += `No recommendations met the confidence threshold of ${results.metadata.confidenceThreshold}.\n\n`;
  } else {
    // Sort by confidence
    const sortedRecs = [...results.recommendations].sort((a, b) => b.confidence - a.confidence);
    
    // Show top recommendations
    for (const rec of sortedRecs) {
      markdown += `### ${rec.type.charAt(0).toUpperCase() + rec.type.slice(1)} Optimization\n\n`;
      markdown += `**Current Content:**\n\`\`\`\n${rec.originalContent}\n\`\`\`\n\n`;
      markdown += `**Recommended Change:**\n\`\`\`\n${rec.bestVariant}\n\`\`\`\n\n`;
      markdown += `**Location:** ${rec.location}\n`;
      markdown += `**Confidence:** ${rec.confidence.toFixed(2)}\n`;
      markdown += `**Estimated Improvement:** ${rec.improvementEstimate}\n`;
      markdown += `**Reasoning:** ${rec.reasoning}\n\n`;
      markdown += `---\n\n`;
    }
  }
  
  // Rejected Recommendations
  if (results.rejectedRecommendations.length > 0) {
    markdown += `## Rejected Recommendations\n\n`;
    markdown += `The following recommendations were rejected due to low confidence scores:\n\n`;
    
    for (const rec of results.rejectedRecommendations) {
      markdown += `- **${rec.type}**: "${rec.originalContent.substring(0, 50)}..." -> "${rec.bestVariant.substring(0, 50)}..."\n`;
      markdown += `  - Confidence: ${rec.confidence.toFixed(2)}\n`;
      markdown += `  - Reason: ${rec.rejectionReason}\n\n`;
    }
  }
  
  // Write to output file
  fs.writeFileSync(outputPath, markdown, "utf-8");
  return outputPath;
}

async function exportRecommendationsToCsv(results, outputPath) {
  // Generate CSV header
  let csv = "Type,Original Content,Recommended Content,Location,Confidence,Improvement,Reasoning\n";
  
  // Add recommendations
  for (const rec of results.recommendations) {
    // Escape CSV values
    const originalContent = `"${rec.originalContent.replace(/"/g, '""')}"`;
    const bestVariant = `"${rec.bestVariant.replace(/"/g, '""')}"`;
    const location = `"${rec.location.replace(/"/g, '""')}"`;
    const reasoning = `"${rec.reasoning.replace(/"/g, '""')}"`;
    
    csv += `${rec.type},${originalContent},${bestVariant},${location},${rec.confidence},${rec.improvementEstimate},${reasoning}\n`;
  }
  
  // Write to output file
  fs.writeFileSync(outputPath, csv, "utf-8");
  return outputPath;
}

// Export command
program
  .command("export")
  .description("Export optimization recommendations")
  .option("-i, --input <path>", "Results file (from results command)")
  .option("-o, --output <path>", "Output directory path")
  .option("-f, --format <format>", "Output format (code, json, html, markdown)", "html")
  .option("-t, --template <template>", "Template theme for HTML output", "default")
  .action(async (options) => {
    console.log("Exporting recommendations...");

    // Check if input file exists
    if (!options.input || !fs.existsSync(options.input)) {
      console.error("Input file not found. Run 'steelpush results' first.");
      process.exit(1);
    }

    try {
      // Create output directory if it doesn't exist
      const outputDir = options.output || `steelpush-export-${Date.now()}`;
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Read results file
      const results = JSON.parse(fs.readFileSync(options.input, "utf-8"));
      
      // Process recommendations
      const { recommendations } = results;
      
      if (!recommendations || !Array.isArray(recommendations)) {
        console.error("Invalid recommendations format");
        process.exit(1);
      }
      
      // Define export formats
      switch (options.format) {
        case "code":
          await exportAsImplementationCode(recommendations, outputDir);
          break;
        case "html":
          await exportAsHtml(results, outputDir, options.template);
          break;
        case "markdown":
          await exportAsMarkdown(results, outputDir);
          break;
        case "json":
        default:
          await exportAsJson(results, outputDir);
          break;
      }
      
      console.log(`\nExport complete!`);
      console.log(`Files saved to ${outputDir}`);
      
    } catch (error) {
      console.error("Export failed:", error);
      process.exit(1);
    }
  });

// Export helper functions
async function exportAsImplementationCode(recommendations, outputDir) {
  // Create code implementations for different technologies
  const jsDir = path.join(outputDir, "js");
  const cssDir = path.join(outputDir, "css");
  const htmlDir = path.join(outputDir, "html");
  
  // Create directories
  if (!fs.existsSync(jsDir)) fs.mkdirSync(jsDir, { recursive: true });
  if (!fs.existsSync(cssDir)) fs.mkdirSync(cssDir, { recursive: true });
  if (!fs.existsSync(htmlDir)) fs.mkdirSync(htmlDir, { recursive: true });
  
  // Group recommendations by type
  const byType = recommendations.reduce((acc, rec) => {
    if (!acc[rec.type]) acc[rec.type] = [];
    acc[rec.type].push(rec);
    return acc;
  }, {});
  
  // Create JavaScript update file
  let jsContent = `/**
 * Steelpush - Content Optimization Implementation
 * Generated: ${new Date().toLocaleString()}
 */

// Function to update optimized content
function updateOptimizedContent() {
  // Content updates from Steelpush optimization
  const optimizations = {\n`;
  
  for (const rec of recommendations) {
    const selector = rec.location.startsWith('#') || rec.location.startsWith('.') ? 
      rec.location : 
      `[data-steelpush="${rec.type}-${recommendations.indexOf(rec)}"]`;
    
    jsContent += `    "${selector}": "${rec.bestVariant.replace(/"/g, '\\"')}",\n`;
  }
  
  jsContent += `  };\n\n`;
  jsContent += `  // Apply optimizations
  Object.entries(optimizations).forEach(([selector, content]) => {
    const element = document.querySelector(selector);
    if (element) {
      element.textContent = content;
    }
  });
}\n\n`;
  
  jsContent += `// Run optimizations when DOM is ready
document.addEventListener("DOMContentLoaded", updateOptimizedContent);
`;
  
  fs.writeFileSync(path.join(jsDir, "steelpush-optimizations.js"), jsContent);
  
  // Create HTML sample implementation
  let htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Steelpush Optimizations Implementation</title>
  <link rel="stylesheet" href="../css/steelpush-styles.css">
</head>
<body>
  <h1>Steelpush Optimization Implementation</h1>
  
  <section class="implementation-guide">
    <h2>Implementation Guide</h2>
    <p>Below are implementation examples for the optimized content.</p>
    
    <h3>Option 1: Direct HTML Updates</h3>
    <p>Replace your current content with the optimized versions:</p>
    
    <div class="code-samples">
`;

  for (const rec of recommendations) {
    htmlContent += `      <div class="example">
        <h4>${rec.type.charAt(0).toUpperCase() + rec.type.slice(1)} Update</h4>
        <p>Original: <code>${rec.originalContent}</code></p>
        <p>Optimized: <code>${rec.bestVariant}</code></p>
        <p>Selector: <code>${rec.location}</code></p>
      </div>\n`;
  }

  htmlContent += `    </div>
    
    <h3>Option 2: JavaScript Implementation</h3>
    <p>Include the generated JavaScript file:</p>
    <pre><code>&lt;script src="js/steelpush-optimizations.js"&gt;&lt;/script&gt;</code></pre>
  </section>
  
  <script src="../js/steelpush-optimizations.js"></script>
</body>
</html>`;

  fs.writeFileSync(path.join(htmlDir, "implementation-guide.html"), htmlContent);
  
  // Create CSS file for styling
  const cssContent = `/* Steelpush Optimization Styles */
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.6;
  color: #333;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

h1, h2, h3 {
  color: #2c3e50;
}

.implementation-guide {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 5px;
  margin: 20px 0;
}

.code-samples {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin: 20px 0;
}

.example {
  background: white;
  padding: 15px;
  border-radius: 5px;
  border: 1px solid #e1e4e8;
}

code {
  background: #f1f1f1;
  padding: 2px 5px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.9em;
}

pre {
  background: #f1f1f1;
  padding: 15px;
  border-radius: 5px;
  overflow-x: auto;
}`;

  fs.writeFileSync(path.join(cssDir, "steelpush-styles.css"), cssContent);
  
  // Create README with implementation instructions
  const readmeContent = `# Steelpush Optimization Implementation

This directory contains implementation files for the content optimizations suggested by Steelpush.

## Quick Start

1. **Review the optimization report**
   - See \`implementation-guide.html\` for a summary of all optimizations

2. **Choose an implementation method:**
   - Option 1: Directly update your HTML with the optimized content
   - Option 2: Use the JavaScript implementation provided

3. **JavaScript Implementation:**
   - Include the script in your HTML:
   \`\`\`html
   <script src="js/steelpush-optimizations.js"></script>
   \`\`\`

## Directory Structure

- \`/js\` - JavaScript implementation files
- \`/css\` - CSS styles for the implementation guide
- \`/html\` - HTML implementation guide and examples

## Support

For more information, visit [Steelpush documentation](https://github.com/your-repo/steelpush)
`;

  fs.writeFileSync(path.join(outputDir, "README.md"), readmeContent);
}

async function exportAsHtml(results, outputDir, template = "default") {
  // Create an HTML report of the recommendations
  const { recommendations, metadata } = results;
  
  // Basic HTML report
  let htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Steelpush Optimization Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    
    .summary {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 5px;
      margin-bottom: 30px;
    }
    
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 20px;
    }
    
    .stat-card {
      background: white;
      padding: 15px;
      border-radius: 5px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #2c3e50;
    }
    
    .recommendation {
      background: white;
      padding: 20px;
      border-radius: 5px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    
    .recommendation-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    
    .confidence {
      background: #e9f7ef;
      padding: 5px 10px;
      border-radius: 15px;
      color: #27ae60;
      font-weight: bold;
    }
    
    .content-comparison {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin: 20px 0;
    }
    
    .content-card {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 5px;
    }
    
    .footer {
      text-align: center;
      margin-top: 50px;
      color: #7f8c8d;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Steelpush Optimization Report</h1>
    <p>Generated on ${new Date(results.timestamp).toLocaleString()}</p>
  </div>
  
  <div class="summary">
    <h2>Executive Summary</h2>
    <div class="summary-grid">
      <div class="stat-card">
        <p>Total Recommendations</p>
        <div class="stat-value">${metadata.totalRecommendations}</div>
      </div>
      <div class="stat-card">
        <p>Average Confidence</p>
        <div class="stat-value">${metadata.averageConfidence}</div>
      </div>
      <div class="stat-card">
        <p>Estimated Improvement</p>
        <div class="stat-value">${metadata.estimatedOverallImprovement}</div>
      </div>
    </div>
  </div>
  
  <h2>Recommendations</h2>
  
  <div class="recommendations-container">`;
  
  // Sort recommendations by confidence
  const sortedRecs = [...recommendations].sort((a, b) => b.confidence - a.confidence);
  
  // Add each recommendation
  for (const rec of sortedRecs) {
    htmlContent += `
    <div class="recommendation">
      <div class="recommendation-header">
        <h3>${rec.type.charAt(0).toUpperCase() + rec.type.slice(1)} Optimization</h3>
        <span class="confidence">${(rec.confidence * 100).toFixed(0)}% Confidence</span>
      </div>
      
      <p>Location: ${rec.location}</p>
      <p>Estimated Improvement: ${rec.improvementEstimate}</p>
      
      <div class="content-comparison">
        <div class="content-card">
          <h4>Current Content</h4>
          <p>${rec.originalContent}</p>
        </div>
        <div class="content-card">
          <h4>Recommended Content</h4>
          <p>${rec.bestVariant}</p>
        </div>
      </div>
      
      <div class="reasoning">
        <h4>Why This Works Better</h4>
        <p>${rec.reasoning}</p>
      </div>
    </div>`;
  }
  
  htmlContent += `  </div>
  
  <div class="footer">
    <p>Generated with Steelpush - AI-Powered Website Optimization</p>
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(outputDir, "optimization-report.html"), htmlContent);
}

async function exportAsMarkdown(results, outputDir) {
  // Export as Markdown
  const markdownPath = path.join(outputDir, "optimization-report.md");
  await createOptimizationReportMarkdown(results, markdownPath);
}

async function exportAsJson(results, outputDir) {
  // Export as JSON
  fs.writeFileSync(
    path.join(outputDir, "optimization-results.json"), 
    JSON.stringify(results, null, 2)
  );
}

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

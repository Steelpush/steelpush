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
  .option("-k, --api-key <key>", "OpenAI API key")
  .option("-m, --model <model>", "OpenAI model to use (default: gpt-4-turbo)")
  .action(async (options) => {
    console.log("Initializing Steelpush...");

    // Get API key if not provided
    let apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const { default: inquirer } = await import("inquirer");
      const answers = await inquirer.prompt([
        {
          type: "password",
          name: "apiKey",
          message: "Enter your OpenAI API key:",
          validate: (input: string) =>
            input.length > 0 ? true : "API key is required",
        },
      ]);
      apiKey = answers.apiKey;
    }

    // Create config
    const config = {
      ai: {
        provider: "openai",
        model: options.model || "gpt-4-turbo",
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
    fs.writeFileSync(".env", `OPENAI_API_KEY=${apiKey}\n`);
    console.log("API key saved to .env for current session");

    console.log("\nSteelpush initialized successfully!");
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

    // TODO: Implement content generation
    console.log("Content generation not yet implemented in this CLI version.");
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

    // TODO: Implement simulation
    console.log("Simulation not yet implemented in this CLI version.");
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
  .action(async (options) => {
    console.log("Analyzing results...");

    // Check if input file exists
    if (!options.input || !fs.existsSync(options.input)) {
      console.error("Input file not found. Run 'steelpush simulate' first.");
      process.exit(1);
    }

    // TODO: Implement results analysis
    console.log("Results analysis not yet implemented in this CLI version.");
  });

// Export command
program
  .command("export")
  .description("Export optimization recommendations")
  .option("-i, --input <path>", "Results file (from results command)")
  .option("-o, --output <path>", "Output directory path")
  .option("-f, --format <format>", "Output format (code, json, html)", "json")
  .action(async (options) => {
    console.log("Exporting recommendations...");

    // Check if input file exists
    if (!options.input || !fs.existsSync(options.input)) {
      console.error("Input file not found. Run 'steelpush results' first.");
      process.exit(1);
    }

    // TODO: Implement export
    console.log("Export not yet implemented in this CLI version.");
  });

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

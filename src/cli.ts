#!/usr/bin/env node

import { Command } from "commander";
import { analyzeWebsite } from "./analyzer";
import { generateVariants } from "./generators";
import { simulateTraffic } from "./simulator";
import { exportResults } from "./core/export";
import { init } from "./core/init";
import fs from "fs";
import path from "path";

const program = new Command();

// State management
const STATE_FILE = path.join(process.cwd(), "steelpush-state.json");

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    }
  } catch (error) {
    console.warn("Failed to load state:", error);
  }
  return {
    analysis: null,
    variants: [],
    simulation: null,
  };
}

function saveState(state: any) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.warn("Failed to save state:", error);
  }
}

program
  .name("steelpush")
  .description("AI-powered website optimization tool")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize Steelpush configuration")
  .action(async () => {
    await init();
  });

program
  .command("analyze")
  .description("Analyze a website for optimization opportunities")
  .argument("<url>", "URL of the website to analyze")
  .option("-o, --output <format>", "Output format (json, table)", "json")
  .action(async (url: string, options) => {
    const state = loadState();
    console.log(`Analyzing website: ${url}`);

    const result = await analyzeWebsite(url);
    state.analysis = result;
    saveState(state);

    if (options.output === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      // TODO: Implement table output
      console.log("Table output not implemented yet");
    }
  });

program
  .command("generate")
  .description("Generate content variants for optimizable elements")
  .option(
    "-e, --element <selector>",
    "Element selector to generate variants for",
  )
  .option("-o, --output <format>", "Output format (json, table)", "json")
  .action(async (options) => {
    const state = loadState();
    if (!state.analysis) {
      console.error("No analysis found. Please run 'analyze' command first.");
      process.exit(1);
    }

    const element = options.element
      ? state.analysis.elements.find((e: any) => e.selector === options.element)
      : state.analysis.elements[0];

    if (!element) {
      console.error("Element not found in analysis results.");
      process.exit(1);
    }

    console.log(`Generating variants for element: ${element.selector}`);
    const variants = await generateVariants(element);
    state.variants = variants;
    saveState(state);

    if (options.output === "json") {
      console.log(JSON.stringify(variants, null, 2));
    } else {
      // TODO: Implement table output
      console.log("Table output not implemented yet");
    }
  });

program
  .command("simulate")
  .description("Run AI agent simulation")
  .option("-v, --visitors <count>", "Number of visitors to simulate", "5")
  .option("-p, --personas <count>", "Number of personas to use", "2")
  .option("-d, --duration <time>", "Simulation duration (e.g., 1h, 30m)", "1h")
  .option("-o, --output <format>", "Output format (json, table)", "json")
  .action(async (options) => {
    const state = loadState();
    if (!state.variants.length) {
      console.error("No variants found. Please run 'generate' command first.");
      process.exit(1);
    }

    console.log("Starting simulation...");
    const results = await simulateTraffic(state.variants, {
      visitorCount: parseInt(options.visitors),
      personaCount: parseInt(options.personas),
      duration: options.duration,
    });
    state.simulation = results;
    saveState(state);

    if (options.output === "json") {
      console.log(JSON.stringify(results, null, 2));
    } else {
      // TODO: Implement table output
      console.log("Table output not implemented yet");
    }
  });

program
  .command("results")
  .description("View optimization results")
  .option("-o, --output <format>", "Output format (json, table)", "json")
  .action((options) => {
    const state = loadState();
    if (!state.simulation) {
      console.error(
        "No simulation results found. Please run 'simulate' command first.",
      );
      process.exit(1);
    }

    if (options.output === "json") {
      console.log(JSON.stringify(state.simulation, null, 2));
    } else {
      // TODO: Implement table output
      console.log("Table output not implemented yet");
    }
  });

program
  .command("export")
  .description("Export optimization recommendations")
  .option("-f, --format <format>", "Export format (json, code)", "json")
  .action(async (options) => {
    const state = loadState();
    if (!state.simulation) {
      console.error(
        "No simulation results found. Please run 'simulate' command first.",
      );
      process.exit(1);
    }

    await exportResults({
      ...options,
      data: state.simulation,
    });
  });

program.parse();

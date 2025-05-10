import fs from "fs";
import path from "path";
import { glob } from "glob";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { config } from "../config";

export interface CodeContent {
  file: string;
  type: string; // heading, cta, description, etc.
  content: string;
  location: string; // Where in the code this appears (component name, function, etc.)
  importance: "high" | "medium" | "low";
  optimizationPotential: "high" | "medium" | "low";
}

export interface CodebaseScanResult {
  basePath: string;
  scannedFiles: string[];
  content: CodeContent[];
  metadata: {
    scanDuration: number;
    fileCount: number;
    contentCount: number;
    fileTypes: Record<string, number>;
  };
}

/**
 * Scans a codebase directory to extract content using Mastra agents
 */
export async function scanCodebase(
  directoryPath: string
): Promise<CodebaseScanResult> {
  console.log(`Starting codebase scan for: ${directoryPath}`);
  const startTime = Date.now();

  // Get all code files
  const codeFiles = await getCodeFiles(directoryPath);
  console.log(`Found ${codeFiles.length} files to scan`);

  // Create tools for the agent
  const tools = createCodeScanningTools();

  // Create content scanner agent
  const agent = new Agent({
    name: "codebase-content-scanner",
    instructions: `
      You are an expert code analyzer tasked with finding content in codebases.
      Your goal is to identify text content in code that could be optimized to improve conversion rates.
      
      When analyzing code files:
      1. Focus on user-facing content like UI text, error messages, and button labels
      2. Identify where the content appears in the code (components, functions, etc.)
      3. Categorize content by type (heading, CTA, description, etc.)
      4. Assess its importance and potential for optimization
      
      Look for content in:
      - React/Vue/Svelte/Angular components
      - HTML templates
      - Translation files and string resources
      - Text passed to UI elements
      - Form labels and validation messages
      
      For each content element, record:
      - The file it appears in
      - The type of content (heading, cta, description, etc.)
      - The actual text content
      - Where it appears within the file (component, function, etc.)
      - Its importance level (high, medium, low)
      - Its potential for optimization (high, medium, low)
      
      Be technology-agnostic and understand different frontend frameworks.
      Focus on finding content that impacts user experience and conversion.
    `,
    model: openai(config.analysis.modelName || "gpt-4-turbo"),
    tools,
  });

  // Track scanned files and content
  const scannedFiles: string[] = [];
  const contentItems: CodeContent[] = [];
  const fileTypes: Record<string, number> = {};

  // Process files in batches
  const batchSize = 5;
  for (let i = 0; i < codeFiles.length; i += batchSize) {
    const batch = codeFiles.slice(i, i + batchSize);
    console.log(
      `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(codeFiles.length / batchSize)}`
    );

    // Process each file in the batch
    for (const filePath of batch) {
      await scanFile(agent, filePath, scannedFiles, contentItems);

      // Track file types
      const ext = path.extname(filePath).toLowerCase();
      fileTypes[ext] = (fileTypes[ext] || 0) + 1;
    }
  }

  // Calculate metadata
  const scanDuration = Date.now() - startTime;

  // Return results
  return {
    basePath: directoryPath,
    scannedFiles,
    content: contentItems,
    metadata: {
      scanDuration,
      fileCount: scannedFiles.length,
      contentCount: contentItems.length,
      fileTypes,
    },
  };
}

/**
 * Get all code files in the directory
 */
async function getCodeFiles(directory: string): Promise<string[]> {
  const patterns = [
    // Frontend files
    "**/*.{jsx,tsx,js,ts,vue,svelte,astro}",
    "**/*.{html,htm}",

    // Translation files
    "**/locales/**/*.{json,js,ts}",
    "**/translations/**/*.{json,js,ts}",
    "**/i18n/**/*.{json,js,ts}",

    // Content files
    "**/*.{md,mdx}",
    "**/content/**/*.{json,yaml,yml}",
  ];

  const ignore = [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/.git/**",
    "**/public/assets/**",
    "**/*.test.{js,jsx,ts,tsx}",
    "**/*.spec.{js,jsx,ts,tsx}",
    "**/package.json",
    "**/package-lock.json",
    "**/yarn.lock",
    "**/pnpm-lock.yaml",
  ];

  let files: string[] = [];
  for (const pattern of patterns) {
    const matches = await glob(path.join(directory, pattern), {
      nodir: true,
      ignore: ignore.map((i) => path.join(directory, i)),
    });
    files = files.concat(matches);
  }

  return files;
}

/**
 * Creates the necessary tools for the codebase scanning agent
 */
function createCodeScanningTools() {
  // Tool to read a file
  const readFileTool = createTool({
    id: "read_file",
    description: "Read the contents of a file",
    inputSchema: z.object({
      filePath: z.string().describe("Path to the file to read"),
    }),
    outputSchema: z.string(),
    execute: async ({ context }) => {
      try {
        return fs.readFileSync(context.filePath, "utf-8");
      } catch (error: any) {
        return `Error reading file: ${error.message || "Unknown error"}`;
      }
    },
  });

  // Tool to analyze file content for user-facing text
  const analyzeContentTool = createTool({
    id: "analyze_content",
    description: "Analyze file content to identify user-facing text",
    inputSchema: z.object({
      filePath: z.string().describe("Path to the file being analyzed"),
      fileContent: z.string().describe("Content of the file to analyze"),
    }),
    outputSchema: z.array(
      z.object({
        file: z.string(),
        type: z.string(),
        content: z.string(),
        location: z.string(),
        importance: z.enum(["high", "medium", "low"]),
        optimizationPotential: z.enum(["high", "medium", "low"]),
      })
    ),
    execute: async ({ context }) => {
      try {
        // The agent will perform the analysis and return structured data
        return []; // Placeholder - the agent will actually return the data
      } catch (error: any) {
        console.error("Error analyzing content:", error);
        return [];
      }
    },
  });

  return {
    read_file: readFileTool,
    analyze_content: analyzeContentTool,
  };
}

/**
 * Scans a single file for content
 */
async function scanFile(
  agent: Agent,
  filePath: string,
  scannedFiles: string[],
  contentItems: CodeContent[]
): Promise<void> {
  console.log(`Scanning file: ${filePath}`);

  try {
    // Read the file content
    const fileContent = fs.readFileSync(filePath, "utf-8");

    // Skip if the file is empty or too small
    if (fileContent.length < 10) {
      scannedFiles.push(filePath);
      return;
    }

    // Let the agent analyze the file
    const result = await agent.generate([
      {
        role: "user",
        content: `
          Analyze this file for user-facing content that could be optimized for conversion:
          
          File: ${filePath}
          
          ${
            fileContent.length > 15000
              ? fileContent.substring(0, 15000) +
                "... (file truncated due to size)"
              : fileContent
          }
          
          First, determine if this file contains any user-facing content.
          If it does, identify and categorize each piece of content.
          For each content element, assess its importance and optimization potential.
          
          Provide your findings in a structured format, focusing only on actual content that users would see.
          Ignore variable names, function names, and other technical code elements.
        `,
      },
    ]);

    // Mark file as scanned
    scannedFiles.push(filePath);

    // Process the agent's response to extract content items
    try {
      // Get tool calls from the response
      const toolCalls = result.toolCalls || [];

      // Find analyze_content tool calls
      const analyzeContentCalls = toolCalls.filter(
        (call) => call.toolName === "analyze_content"
      );

      // Extract content items
      for (const call of analyzeContentCalls) {
        // Since the outputSchema of the tool is an array, we just need to add the items to our list
        // Check if result is available and is an array
        const callResult = (call as any).result;
        if (callResult && Array.isArray(callResult)) {
          callResult.forEach((item: CodeContent) => contentItems.push(item));
        }
      }

      // If no tool calls or no content found, try to parse from the response text
      if (contentItems.length === 0) {
        // Try to extract JSON from the response text
        const jsonMatches = result.text.match(
          /```(?:json)?\s*([\s\S]*?)\s*```/
        ) || [null, result.text];
        const jsonText = jsonMatches[1].trim();

        try {
          const parsedItems = JSON.parse(jsonText);
          if (Array.isArray(parsedItems)) {
            parsedItems.forEach((item: CodeContent) => contentItems.push(item));
          }
        } catch (error) {
          // If JSON parsing fails, try regexp-based extraction
          const contentRegex =
            /Content:\s*"([^"]+)"\s*Type:\s*(\w+)\s*Location:\s*([^\n]+)\s*Importance:\s*(\w+)\s*Optimization Potential:\s*(\w+)/g;

          let match;
          while ((match = contentRegex.exec(result.text)) !== null) {
            contentItems.push({
              file: filePath,
              content: match[1],
              type: match[2],
              location: match[3],
              importance: match[4] as "high" | "medium" | "low",
              optimizationPotential: match[5] as "high" | "medium" | "low",
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error processing response for ${filePath}:`, error);
    }
  } catch (error) {
    console.error(`Error scanning file ${filePath}:`, error);
  }
}

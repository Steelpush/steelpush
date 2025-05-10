import fs from "fs";
import path from "path";
import { glob } from "glob";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { config } from "../config";

export interface MarketingContentItem {
  file: string;
  content: string;
  type: string;
  context: string;
  lineNumber: number;
}

export interface ComponentAnalysisResult {
  marketingContent: MarketingContentItem[];
}

/**
 * Analyzes React components to find marketing content
 *
 * @param directory Directory containing React components to analyze
 * @returns Promise containing the analysis results
 */
export async function analyzeComponents(
  directory: string,
): Promise<ComponentAnalysisResult> {
  console.log(`Starting intelligent component analysis in: ${directory}`);

  // Get list of files for the agent to reason about
  const projectFiles = await getAllFiles(directory);
  console.log(`Found ${projectFiles.length} files to analyze`);

  // Create readFile tool
  const readFileTool = createTool({
    id: "readFile",
    description: "Read file contents",
    inputSchema: z.object({
      filePath: z.string().describe("Path to the file"),
    }),
    outputSchema: z.string(),
    execute: async ({ context }) => {
      try {
        return fs.readFileSync(context.filePath, "utf-8");
      } catch (error: any) {
        return `Error reading file: ${error.message}`;
      }
    },
  });

  // Create listFiles tool
  const listFilesTool = createTool({
    id: "listFiles",
    description: "List files in a directory",
    inputSchema: z.object({
      directory: z.string().describe("Directory path to list files from"),
    }),
    outputSchema: z.array(z.string()),
    execute: async ({ context }) => {
      return projectFiles.filter(
        (file) =>
          file.startsWith(context.directory) && !file.includes("node_modules"),
      );
    },
  });

  // Create focused agent
  const agent = new Agent({
    name: "react-content-analyzer",
    instructions: `
      You are an expert React component analyzer specialized in identifying marketing content.
      
      First, explore the project structure to identify React component files.
      Focus specifically on UI components that might contain marketing content,
      especially components like headers, hero sections, feature sections, etc.
      
      For this task, PRIORITIZE analyzing Header and marketing-related components when found, as they 
      typically contain important marketing content like taglines and navigation.
      
      Once you've identified the most relevant component file(s) to analyze, read their
      contents and identify ANY text that could be considered marketing content,
      including text between JSX tags, text in props, and any other text users would see.
      
      Examples of marketing content include:
      - Headings and taglines (e.g., <h1>Product Name</h1>)
      - Promotional statements (e.g., <p>The best solution for your business</p>)
      - Button and link text (e.g., <Button>Sign Up Now</Button>)
      - Feature descriptions
      - Value propositions
      
      FOR EACH PIECE OF CONTENT FOUND, output a JSON object with:
      - file: the file path
      - content: the actual text
      - type: the type of content (heading, description, cta, etc.)
      - context: a brief description of where this appears in the component
      - lineNumber: the approximate line number in the file
      
      Output should be a valid JSON array containing these objects.
    `,
    model: openai(config.analysis.modelName || "gpt-4-turbo"),
    tools: {
      readFile: readFileTool,
      listFiles: listFilesTool,
    },
  });

  // Let agent explore and analyze
  const result = await agent.generate([
    {
      role: "user",
      content: `
        Explore the ${directory} directory to find React component files.
        
        IMPORTANT: Focus on finding Header components or similar UI components that would contain 
        marketing content like taglines, product names, and promotional text.
        
        Use the listFiles tool to explore directories, and then use readFile to analyze the content
        of the most promising files.
        
        Return your findings as a JSON array of marketing content objects as described in your instructions.
      `,
    },
  ]);

  // Parse the response
  try {
    const jsonMatch = result.text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [
      null,
      result.text,
    ];
    const jsonText = jsonMatch[1].trim();
    const contentItems = JSON.parse(jsonText);

    if (Array.isArray(contentItems)) {
      console.log(
        `Analysis complete. Found ${contentItems.length} marketing content items.`,
      );
      return {
        marketingContent: contentItems,
      };
    } else {
      console.error(
        "Parser error: Expected an array of marketing content items",
      );
      return { marketingContent: [] };
    }
  } catch (error) {
    console.error("Error parsing agent output:", error);
    console.error("Raw agent output:\n", result.text);
    return { marketingContent: [] };
  }
}

/**
 * Retrieves all relevant files from the target directory
 */
async function getAllFiles(directory: string): Promise<string[]> {
  const patterns = ["**/*.{js,jsx,ts,tsx,vue,html}"];
  const ignore = ["**/node_modules/**", "**/dist/**", "**/build/**"];

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

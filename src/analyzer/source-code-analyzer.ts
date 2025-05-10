import fs from "fs";
import path from "path";
import { glob } from "glob";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { config } from "../config";

interface MarketingContent {
  file: string;
  path: string;
  content: string;
  type:
    | "heading"
    | "description"
    | "cta"
    | "feature"
    | "benefit"
    | "testimonial"
    | "other";
  context: string;
  lineNumber: number;
}

interface SourceCodeAnalysis {
  marketingContent: MarketingContent[];
  fileMap: {
    path: string;
    type: string;
    hasMarketingContent: boolean;
  }[];
}

const MarketingContentSchema = z.object({
  file: z.string(),
  path: z.string(),
  content: z.string(),
  type: z.enum([
    "heading",
    "description",
    "cta",
    "feature",
    "benefit",
    "testimonial",
    "other",
  ]),
  context: z.string(),
  lineNumber: z.number(),
});

const SourceCodeAnalysisSchema = z.object({
  marketingContent: z.array(MarketingContentSchema),
  fileMap: z.array(
    z.object({
      path: z.string(),
      type: z.string(),
      hasMarketingContent: z.boolean(),
    })
  ),
});

export async function analyzeSourceCode(
  directory: string
): Promise<SourceCodeAnalysis> {
  console.log(`Starting source code analysis in: ${directory}`);

  // Get all code files
  const files = await getCodeFiles(directory);
  console.log(`Found ${files.length} files to analyze`);

  // Create readFile tool for agent
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

  // Create file metadata for the agent
  const fileMetadata = files
    .map((file) => {
      const ext = path.extname(file).toLowerCase();
      // Skip files specified in .gitignore
      if (
        file === ".gitignore" ||
        file.includes("node_modules") ||
        file.includes("dist")
      ) {
        return null;
      }
      return {
        path: file,
        type: getFileType(ext),
      };
    })
    .filter(Boolean) as Array<{ path: string; type: string }>;

  // Create the Mastra agent to analyze the source code
  const agent = new Agent({
    name: "source-code-analyzer",
    instructions: `
      You are an expert source code analyzer specialized in identifying marketing content within codebases.
      Your task is to:
      1. Analyze the provided file metadata and contents
      2. Identify content that can be considered marketing content, including:
         - Headings and titles
         - Product/service descriptions
         - Call-to-action text
         - Feature descriptions
         - Benefit statements
         - Testimonials
         - Value propositions
         - Promotional language
      3. Create a map of all files and identify which ones contain marketing content

      For each piece of marketing content you find, record:
      - The file it was found in
      - The file path
      - The content itself
      - The type of marketing content
      - The surrounding context
      - The line number

      Look for content in:
      - UI components and templates (especially hardcoded text within JSX/TSX components)
      - Text within HTML tags like <h1>, <h2>, <p>, <div>, <span>, etc.
      - Button text, link text, and navbar items
      - Static text in code
      - Translation files
      - Markdown documentation
      - JSON/YAML configuration files
      - Comments that might contain marketing copy
      
      Pay VERY CLOSE attention to React/Vue/Angular components for text between JSX tags, such as:
      - <h1>This is a heading</h1>
      - <p>This is a description</p>
      - <Button>Click me</Button>
      - <div className="tagline">Promotional text here</div>
      
      For React components, examine both direct text content and any text passed as props.

      Output your analysis as a single JSON object with the following structure:
      {
        "marketingContent": [
          { 
            "file": string, 
            "path": string, 
            "content": string, 
            "type": "heading" | "description" | "cta" | "feature" | "benefit" | "testimonial" | "other",
            "context": string,
            "lineNumber": number 
          }
        ],
        "fileMap": [
          { 
            "path": string, 
            "type": string, 
            "hasMarketingContent": boolean 
          }
        ]
      }
    `,
    model: openai(config.analysis.modelName || "gpt-4-turbo"),
    tools: { readFile: readFileTool },
  });

  // Process files in batches to avoid overwhelming the agent
  const batchSize = 10;
  let marketingContent: MarketingContent[] = [];

  for (let i = 0; i < fileMetadata.length; i += batchSize) {
    const batch = fileMetadata.slice(i, i + batchSize);
    console.log(
      `Processing file batch ${i / batchSize + 1}/${Math.ceil(fileMetadata.length / batchSize)}`
    );

    // Ask agent to analyze files
    const result = await agent.generate([
      {
        role: "user",
        content: `
          Analyze these files and identify any marketing content:
          
          File metadata:
          ${JSON.stringify(batch, null, 2)}
          
          For each file, use the readFile tool to examine its contents and identify any marketing content.
          For files that likely contain marketing content (HTML, UI components, markdown, etc.), analyze carefully.
          For files that are unlikely to contain marketing content (configuration files, backend code), you can be more selective.
          
          Remember to record the file path, content, type, context, and line number for each piece of marketing content.
          Also create a complete file map indicating which files contain marketing content.
        `,
      },
    ]);

    try {
      // Extract JSON from possible markdown code blocks
      const jsonMatch = result.text.match(
        /```(?:json)?\s*([\s\S]*?)\s*```/
      ) || [null, result.text];
      const jsonString = jsonMatch[1].trim();

      const batchResults = JSON.parse(jsonString);

      if (
        batchResults.marketingContent &&
        Array.isArray(batchResults.marketingContent)
      ) {
        marketingContent = [
          ...marketingContent,
          ...batchResults.marketingContent,
        ];
      }
    } catch (error) {
      console.error("Error parsing agent output:");
      console.error("Raw agent output:\n", result.text);
    }
  }

  // Create final file map
  const fileMap = fileMetadata.map((file) => ({
    ...file,
    hasMarketingContent: marketingContent.some(
      (content) => content.path === file.path
    ),
  }));

  const analysis: SourceCodeAnalysis = {
    marketingContent,
    fileMap,
  };

  console.log(
    `Analysis complete. Found ${marketingContent.length} marketing content items in ${fileMap.filter((f) => f.hasMarketingContent).length} files`
  );

  return analysis;
}

async function getCodeFiles(directory: string): Promise<string[]> {
  // Get all relevant code files
  const patterns = [
    "**/*.{js,jsx,ts,tsx,vue,html,md,mdx,json,yaml,yml}",
    "**/locales/**/*.{json,js,ts}",
    "**/content/**/*.{json,md,mdx}",
  ];

  const ignore = [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/.git/**",
    "**/coverage/**",
    "**/.nyc_output/**",
    "**/logs/**",
    "**/*.log",
    // Comment out the lock files if you want to analyze them
    "**/package-lock.json",
    "**/yarn.lock",
    "**/pnpm-lock.yaml",
    // Ignore state files
    "**/steelpush-state.json",
    "**/steelpush-sourcecode-state.json",
    "**/marketing-report.md",
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

function getFileType(extension: string): string {
  const typeMap: Record<string, string> = {
    // Frontend
    ".html": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".sass": "SASS",
    ".less": "LESS",
    ".js": "JavaScript",
    ".jsx": "React",
    ".ts": "TypeScript",
    ".tsx": "React TypeScript",
    ".vue": "Vue",
    ".svelte": "Svelte",
    ".astro": "Astro",

    // Backend
    ".py": "Python",
    ".rb": "Ruby",
    ".php": "PHP",
    ".java": "Java",
    ".go": "Go",
    ".rs": "Rust",
    ".cs": "C#",
    ".fs": "F#",
    ".swift": "Swift",
    ".kt": "Kotlin",
    ".scala": "Scala",

    // Data
    ".json": "JSON",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".xml": "XML",
    ".csv": "CSV",
    ".toml": "TOML",
    ".ini": "INI",
    ".env": "Environment",

    // Documentation
    ".md": "Markdown",
    ".mdx": "MDX",
    ".txt": "Text",
    ".pdf": "PDF",
    ".doc": "Word",
    ".docx": "Word",
    ".ppt": "PowerPoint",
    ".pptx": "PowerPoint",
    ".xls": "Excel",
    ".xlsx": "Excel",
  };

  return typeMap[extension] || "Unknown";
}

import fs from "fs";
import path from "path";
import { glob } from "glob";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { config } from "../config";
import { chromium, Browser, Page } from "playwright";

interface ContentLocation {
  file: string;
  type: "component" | "translation" | "api" | "database" | "static";
  framework?: string;
  content: string;
  context: string;
  lineNumber: number;
}

interface WebsiteContent {
  selector: string;
  content: string;
  url: string;
}

interface ContentAnalysis {
  locations: ContentLocation[];
  patterns: {
    type: string;
    description: string;
    examples: string[];
  }[];
  recommendations: {
    type: string;
    description: string;
    priority: "high" | "medium" | "low";
  }[];
}

const ContentLocationSchema = z.object({
  file: z.string(),
  type: z.enum(["component", "translation", "api", "database", "static"]),
  framework: z.string().optional(),
  content: z.string(),
  context: z.string(),
  lineNumber: z.number(),
});

const ContentAnalysisSchema = z.object({
  locations: z.array(ContentLocationSchema),
  patterns: z.array(
    z.object({
      type: z.string(),
      description: z.string(),
      examples: z.array(z.string()),
    }),
  ),
  recommendations: z.array(
    z.object({
      type: z.string(),
      description: z.string(),
      priority: z.enum(["high", "medium", "low"]),
    }),
  ),
});

export * from "./source-code-analyzer";

export async function analyzeWebsite(url: string): Promise<ContentAnalysis> {
  console.log(`Starting browser automation to analyze: ${url}`);

  // Launch browser and crawl website
  const websiteContent = await crawlWebsite(url);

  // Find content locations in codebase
  const contentLocations = await findContentInCodebase(websiteContent);

  // Create the Mastra agent to analyze patterns and generate recommendations
  const agent = new Agent({
    name: "content-analyzer",
    instructions: `
      You are an expert content optimization analyzer specialized in optimizing website content.
      Your task is to:
      1. Analyze the provided content locations from a website
      2. Identify content patterns and structure
      3. Provide actionable recommendations for content optimization

      Based on the content locations data, provide:
      1. Content patterns you identify
      2. Recommendations for optimization

      Focus on:
      - SEO optimization opportunities
      - Content structure improvements
      - Translation and localization opportunities
      - Accessibility improvements
      - Conversion rate optimization potential

      Output your analysis as a single JSON object with the following structure:
      {
        "patterns": [
          { "type": string, "description": string, "examples": string[] }
        ],
        "recommendations": [
          { "type": string, "description": string, "priority": "high" | "medium" | "low" }
        ]
      }
    `,
    model: openai("gpt-4-turbo"),
    tools: {},
  });

  // Get agent analysis
  console.log(
    `Analyzing ${contentLocations.length} content locations with agent`,
  );

  const result = await agent.generate([
    {
      role: "user",
      content: `Analyze these content locations from a website and provide patterns and recommendations:\n\n${JSON.stringify(contentLocations, null, 2)}`,
    },
  ]);

  let agentAnalysis;
  try {
    // Extract JSON from possible markdown code blocks
    const jsonMatch = result.text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [
      null,
      result.text,
    ];
    const jsonString = jsonMatch[1].trim();

    agentAnalysis = JSON.parse(jsonString);

    if (!agentAnalysis.patterns) agentAnalysis.patterns = [];
    if (!agentAnalysis.recommendations) agentAnalysis.recommendations = [];
  } catch (error) {
    console.error("Error parsing agent output:");
    console.error("Raw agent output:\n", result.text);
    agentAnalysis = {
      patterns: [],
      recommendations: [],
    };
  }

  return {
    locations: contentLocations,
    patterns: agentAnalysis.patterns || [],
    recommendations: agentAnalysis.recommendations || [],
  };
}

async function crawlWebsite(url: string): Promise<WebsiteContent[]> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log(`Navigating to ${url}`);
  await page.goto(url, { waitUntil: "networkidle" });

  // Get all pages to crawl (links within the same domain)
  const internalUrls = await collectInternalLinks(page, url);
  const allUrls = [url, ...internalUrls.slice(0, 4)]; // Limit to 5 pages for the MVP

  // Crawl each page and collect content
  const contents: WebsiteContent[] = [];

  for (const pageUrl of allUrls) {
    console.log(`Crawling page: ${pageUrl}`);
    await page.goto(pageUrl, { waitUntil: "networkidle" });

    // Extract text content from various elements
    const pageContents = await page.evaluate(() => {
      const contentElements = Array.from(
        document.querySelectorAll(
          "h1, h2, h3, h4, h5, h6, p, button, a, label, input[placeholder], textarea[placeholder], .content, [aria-label]",
        ),
      );

      return contentElements
        .map((el) => {
          // Get unique selector for this element
          const getSelector = (element: Element): string => {
            if (element.id) return `#${element.id}`;

            let selector = element.tagName.toLowerCase();
            if (element.className) {
              const classes = Array.from(element.classList).join(".");
              if (classes) selector += `.${classes}`;
            }

            // If element has a unique attribute, use it
            const uniqueAttrs = [
              "data-testid",
              "data-cy",
              "data-test",
              "aria-label",
            ];
            for (const attr of uniqueAttrs) {
              const value = element.getAttribute(attr);
              if (value) return `[${attr}="${value}"]`;
            }

            return selector;
          };

          let content = "";

          // Get text content
          if (el.textContent) content = el.textContent.trim();

          // For inputs/textareas, check placeholder
          if (
            (el instanceof HTMLInputElement ||
              el instanceof HTMLTextAreaElement) &&
            el.placeholder
          ) {
            content = el.placeholder;
          }

          // For images, check alt text
          if (el instanceof HTMLImageElement && el.alt) {
            content = el.alt;
          }

          return {
            selector: getSelector(el),
            content: content,
          };
        })
        .filter((item) => item.content && item.content.length > 1); // Filter out empty content
    });

    // Add to content collection with the page URL
    contents.push(...pageContents.map((c) => ({ ...c, url: pageUrl })));
  }

  await browser.close();
  console.log(`Collected ${contents.length} content elements from website`);

  return contents;
}

async function collectInternalLinks(
  page: Page,
  baseUrl: string,
): Promise<string[]> {
  const domain = new URL(baseUrl).hostname;

  const links = await page.evaluate((domain) => {
    const anchors = Array.from(document.querySelectorAll("a[href]"));
    const validLinks: string[] = [];

    for (const a of anchors) {
      const href = a.getAttribute("href");
      if (!href) continue;

      if (
        href.startsWith("/") ||
        (() => {
          try {
            return new URL(href).hostname === domain;
          } catch {
            return false;
          }
        })()
      ) {
        validLinks.push(href);
      }
    }

    return validLinks;
  }, domain);

  // Convert relative URLs to absolute
  const absoluteLinks: string[] = [];

  for (const link of links) {
    if (link.startsWith("/")) {
      const baseUrlObj = new URL(baseUrl);
      absoluteLinks.push(`${baseUrlObj.protocol}//${baseUrlObj.host}${link}`);
    } else {
      absoluteLinks.push(link);
    }
  }

  // Remove duplicates
  return [...new Set(absoluteLinks)];
}

async function findContentInCodebase(
  websiteContent: WebsiteContent[],
): Promise<ContentLocation[]> {
  console.log(
    `Finding content locations in codebase for ${websiteContent.length} elements`,
  );

  // Get all code files
  const files = await getCodeFiles();

  // Create readFile tool for agent
  const readFileTool = createTool({
    id: "readFile",
    description: "Read file contents",
    inputSchema: z.object({
      filePath: z.string().describe("Path to the file"),
    }),
    outputSchema: z.string(),
    execute: async ({ context }) => {
      return fs.readFileSync(context.filePath, "utf-8");
    },
  });

  // Create content locator agent
  const agent = new Agent({
    name: "content-locator",
    instructions: `
      You are an expert code analyzer specialized in finding content in source code.
      Your task is to locate where specific content from a website is defined in the codebase.
      
      For each content element, identify:
      1. The file where the content is defined
      2. The type of content (component, translation, api, database, static)
      3. The framework used (if applicable)
      4. The exact line number
      5. Surrounding context
      
      When examining files, look for:
      - Exact text matches for the content
      - Translation keys that might render the content
      - API calls that fetch the content
      - Database queries
      - Content imported from static files
      
      Output each content location as a JSON object with the following structure:
      {
        "file": string,
        "type": "component" | "translation" | "api" | "database" | "static",
        "framework"?: string,
        "content": string,
        "context": string,
        "lineNumber": number
      }
    `,
    model: openai("gpt-4-turbo"),
    tools: { readFile: readFileTool },
  });

  const contentLocations: ContentLocation[] = [];

  // Process content in batches to avoid overwhelming the agent
  const batchSize = 5;
  for (let i = 0; i < websiteContent.length; i += batchSize) {
    const batch = websiteContent.slice(i, i + batchSize);
    console.log(
      `Processing content batch ${i / batchSize + 1}/${Math.ceil(websiteContent.length / batchSize)}`,
    );

    // Prepare file information for the agent
    const fileInfo = [];
    for (const file of files.slice(0, 20)) {
      // Limit to 20 files for the MVP
      try {
        const content = fs.readFileSync(file, "utf-8");
        fileInfo.push({
          path: file,
          preview: content.substring(0, 500) + "...", // Just a preview
        });
      } catch (error) {
        console.error(`Error reading file ${file}:`, error);
      }
    }

    // Ask agent to locate content
    const result = await agent.generate([
      {
        role: "user",
        content: `
          Find where the following content elements are defined in the codebase.
          
          Website content elements:
          ${JSON.stringify(batch, null, 2)}
          
          Available files:
          ${JSON.stringify(fileInfo, null, 2)}
          
          For each content element, identify which file likely contains it, then use the readFile tool to examine the file and locate the exact line number and context.
          
          Output one JSON object per content location found.
        `,
      },
    ]);

    try {
      // Extract JSON objects from the text
      const jsonMatches = [
        ...result.text.matchAll(/\{(?:[^{}]|(?:\{[^{}]*\}))*\}/g),
      ];
      for (const match of jsonMatches) {
        try {
          const locationData = JSON.parse(match[0]);
          if (locationData.file && locationData.content && locationData.type) {
            const validatedLocation = ContentLocationSchema.parse(locationData);
            contentLocations.push(validatedLocation);
          }
        } catch (parseError) {
          // Invalid JSON or missing required fields, skip this match
        }
      }
    } catch (error) {
      console.error("Error parsing locations from agent output:", error);
    }
  }

  console.log(`Found ${contentLocations.length} content locations in codebase`);
  return contentLocations;
}

async function getCodeFiles(): Promise<string[]> {
  // Get all relevant code files
  const patterns = [
    "src/**/*.{js,jsx,ts,tsx,vue,html,md,mdx,json}",
    "public/**/*.{html,json,md}",
    "components/**/*.{js,jsx,ts,tsx,vue}",
    "pages/**/*.{js,jsx,ts,tsx,vue}",
    "app/**/*.{js,jsx,ts,tsx,vue}",
    "locales/**/*.{json,js,ts}",
  ];

  const ignore = [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/.git/**",
    "**/package.json",
    "**/tsconfig.json",
    "**/README.md",
  ];

  let files: string[] = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern, { nodir: true, ignore });
    files = files.concat(matches);
  }

  return files;
}

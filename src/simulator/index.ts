import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { chromium } from "playwright";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { config } from "../config";

export interface ContentVariant {
  content: string;
  score: number;
  reasoning: string;
}

export interface SimulationOptions {
  visitorCount: number;
  personaCount: number;
  duration: string;
}

export interface SimulationResults {
  variants: ContentVariant[];
  metrics: {
    engagement: number;
    conversion: number;
    timeOnPage: number;
  };
  personaBreakdown: Record<
    string,
    {
      interactions: number;
      timeSpent: number;
      goals: string[];
    }
  >;
  sessions: Array<{
    persona: string;
    actions: Array<{
      type: string;
      target: string;
      timestamp: number;
      result: string;
    }>;
    goals: string[];
    timeSpent: number;
  }>;
}

interface Persona {
  name: string;
  interests: string[];
  goals: string[];
  behavior: string;
}

const PERSONAS: Persona[] = [
  {
    name: "Tech Enthusiast",
    interests: ["technology", "innovation", "gadgets"],
    goals: ["research products", "compare features", "read reviews"],
    behavior:
      "Analytical and detail-oriented, focuses on technical specifications and reviews",
  },
  {
    name: "Business Professional",
    interests: ["business", "efficiency", "solutions"],
    goals: ["find solutions", "compare prices", "check ROI"],
    behavior: "Pragmatic and goal-oriented, focuses on value and efficiency",
  },
  {
    name: "Casual Browser",
    interests: ["general", "entertainment", "social"],
    goals: ["discover content", "share findings", "engage with community"],
    behavior: "Social and exploratory, focuses on engaging content and sharing",
  },
];

export async function simulateTraffic(
  variants: ContentVariant[],
  options: SimulationOptions
): Promise<SimulationResults> {
  console.log("Starting traffic simulation...");

  // Run simulation
  const sessions = [];
  for (let i = 0; i < options.visitorCount; i++) {
    const persona = selectPersona(options.personaCount);
    console.log(
      `Starting session for persona: ${persona.name} (${i + 1}/${options.visitorCount})`
    );

    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    const sessionStart = Date.now();

    // Create browser interaction tools
    const navigateTool = createTool({
      id: "browser_navigate",
      description: "Navigate to a URL in the browser",
      inputSchema: z.object({
        url: z.string().describe("The URL to navigate to"),
      }),
      outputSchema: z.string(),
      execute: async ({ context: toolContext }) => {
        try {
          await page.goto(toolContext.url);
          return `Successfully navigated to ${toolContext.url}`;
        } catch (error: any) {
          return `Failed to navigate to ${toolContext.url}: ${error?.message || "Unknown error"}`;
        }
      },
    });

    const clickTool = createTool({
      id: "click_element",
      description: "Click on an element in the page",
      inputSchema: z.object({
        selector: z.string().describe("CSS selector of the element to click"),
      }),
      outputSchema: z.string(),
      execute: async ({ context: toolContext }) => {
        try {
          await page.click(toolContext.selector);
          return `Successfully clicked element ${toolContext.selector}`;
        } catch (error: any) {
          return `Failed to click element ${toolContext.selector}: ${error?.message || "Unknown error"}`;
        }
      },
    });

    const typeTool = createTool({
      id: "type_text",
      description: "Type text into an input field",
      inputSchema: z.object({
        selector: z.string().describe("CSS selector of the input element"),
        text: z.string().describe("Text to type into the element"),
      }),
      outputSchema: z.string(),
      execute: async ({ context: toolContext }) => {
        try {
          await page.fill(toolContext.selector, toolContext.text);
          return `Successfully typed text into ${toolContext.selector}`;
        } catch (error: any) {
          return `Failed to type text into ${toolContext.selector}: ${error?.message || "Unknown error"}`;
        }
      },
    });

    const getTextTool = createTool({
      id: "get_element_text",
      description: "Get the text content of an element",
      inputSchema: z.object({
        selector: z
          .string()
          .describe("CSS selector of the element to get text from"),
      }),
      outputSchema: z.string(),
      execute: async ({ context: toolContext }) => {
        try {
          const text = await page.textContent(toolContext.selector);
          return text || `No text found in ${toolContext.selector}`;
        } catch (error: any) {
          return `Failed to get text from ${toolContext.selector}: ${error?.message || "Unknown error"}`;
        }
      },
    });

    // Create agent using Mastra for the simulation
    const agent = new Agent({
      name: "user-simulator",
      instructions: `
        You are ${persona.name}, a user with interests in ${persona.interests.join(", ")}.
        Your goals are to ${persona.goals.join(", ")}.
        Your behavior is ${persona.behavior}.
        
        You are simulating a user visiting a website to test different content variants.
        Interact with the website naturally while pursuing your goals.
        
        Content variants being tested:
        ${JSON.stringify(variants, null, 2)}
        
        When interacting with the website:
        1. Navigate to pages
        2. Click on elements that interest you
        3. Fill out forms if needed
        4. Read important content
        5. Make decisions based on your persona's interests and goals
        
        Record your actions and impressions of the content variants.
      `,
      model: openai(config.analysis.modelName || "gpt-4-turbo"),
      tools: {
        browser_navigate: navigateTool,
        click_element: clickTool,
        type_text: typeTool,
        get_element_text: getTextTool,
      },
    });

    // Record session actions
    const actions: Array<{
      type: string;
      target: string;
      timestamp: number;
      result: string;
    }> = [];

    // Run the agent to simulate the user session
    try {
      const result = await agent.generate([
        {
          role: "user",
          content: `
            You are now browsing a website that has these content variants being tested:
            ${JSON.stringify(variants, null, 2)}
            
            Your goals: ${persona.goals.join(", ")}
            Your interests: ${persona.interests.join(", ")}
            Your behavior: ${persona.behavior}
            
            Simulate a user session where you explore the website and interact with these content variants.
            Use the available tools to navigate, click, type, and read content.
            
            Record which content variants you encountered and how you reacted to them.
          `,
        },
      ]);

      // Extract actions from the agent's response
      const actionMatches = result.text.matchAll(
        /Action: (.*?)[\n\r]+Result: (.*?)[\n\r]+/g
      );
      for (const match of actionMatches) {
        actions.push({
          type: "interaction",
          target: match[1],
          timestamp: Date.now() - sessionStart,
          result: match[2],
        });
      }
    } catch (error) {
      console.error(`Error in simulation session for ${persona.name}:`, error);
    }

    const timeSpent = Date.now() - sessionStart;
    sessions.push({
      persona: persona.name,
      actions,
      goals: persona.goals,
      timeSpent,
    });

    await browser.close();
  }

  return analyzeResults(sessions, variants);
}

function selectPersona(personaCount: number): Persona {
  // Select a persona from the available ones
  const availablePersonas = PERSONAS.slice(0, personaCount);
  const randomIndex = Math.floor(Math.random() * availablePersonas.length);
  return availablePersonas[randomIndex];
}

function analyzeResults(
  sessions: Array<{
    persona: string;
    actions: Array<{
      type: string;
      target: string;
      timestamp: number;
      result: string;
    }>;
    goals: string[];
    timeSpent: number;
  }>,
  variants: ContentVariant[]
): SimulationResults {
  // Calculate engagement metrics
  const totalInteractions = sessions.reduce(
    (sum, session) => sum + session.actions.length,
    0
  );
  const avgTimeOnPage =
    sessions.reduce((sum, session) => sum + session.timeSpent, 0) /
    sessions.length;

  // Calculate persona breakdown
  const personaBreakdown = sessions.reduce(
    (acc, session) => {
      if (!acc[session.persona]) {
        acc[session.persona] = {
          interactions: 0,
          timeSpent: 0,
          goals: [],
        };
      }
      acc[session.persona].interactions += session.actions.length;
      acc[session.persona].timeSpent += session.timeSpent;
      acc[session.persona].goals = [
        ...new Set([...acc[session.persona].goals, ...session.goals]),
      ];
      return acc;
    },
    {} as Record<
      string,
      { interactions: number; timeSpent: number; goals: string[] }
    >
  );

  // Calculate conversion rate (simplified)
  const conversionRate =
    sessions.filter((session) =>
      session.actions.some((action) => action.type === "conversion")
    ).length / sessions.length;

  return {
    variants,
    metrics: {
      engagement: totalInteractions / sessions.length,
      conversion: conversionRate,
      timeOnPage: avgTimeOnPage / 1000, // Convert to seconds
    },
    personaBreakdown,
    sessions,
  };
}

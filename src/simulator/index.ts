import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from "langchain/prompts";
import { chromium } from "playwright";
import {
  BrowserNavigationTool,
  ClickElementTool,
  TypeTextTool,
  GetElementTextTool,
} from "./tools";

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
  options: SimulationOptions,
): Promise<SimulationResults> {
  console.log("Starting traffic simulation...");

  // Create AI agents using LangChain
  const llm = new ChatOpenAI({
    modelName: "gpt-4",
    temperature: 0.7,
  });

  const agents = await Promise.all(
    PERSONAS.slice(0, options.personaCount).map((persona) => {
      const prompt = ChatPromptTemplate.fromPromptMessages([
        SystemMessagePromptTemplate.fromTemplate(
          `You are ${persona.name}, a user with interests in ${persona.interests.join(", ")}.
          Your goals are to ${persona.goals.join(", ")}.
          Your behavior is ${persona.behavior}.
          Interact with the website naturally while pursuing your goals.`,
        ),
        HumanMessagePromptTemplate.fromTemplate("{input}"),
      ]);

      return createOpenAIFunctionsAgent({
        llm,
        tools: [], // Tools will be added per session
        prompt,
      });
    }),
  );

  // Run simulation
  const sessions = [];
  for (let i = 0; i < options.visitorCount; i++) {
    const agent = selectAgent(agents);
    const persona = PERSONAS[agents.indexOf(agent)];
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    const sessionStart = Date.now();

    // Create browser interaction tools
    const tools = [
      new BrowserNavigationTool(page),
      new ClickElementTool(page),
      new TypeTextTool(page),
      new GetElementTextTool(page),
    ];

    const executor = new AgentExecutor({
      agent,
      tools,
      verbose: true,
    });

    // Record session actions
    const actions: Array<{
      type: string;
      target: string;
      timestamp: number;
      result: string;
    }> = [];

    // Override tool execution to record actions
    const originalCall = executor.call;
    executor.call = async (input) => {
      const result = await originalCall.call(executor, input);
      actions.push({
        type: "interaction",
        target: input.input.toString(),
        timestamp: Date.now() - sessionStart,
        result: result.toString(),
      });
      return result;
    };

    const session = await executor.run({
      input: {
        variants,
        goals: persona.goals,
        behavior: persona.behavior,
      },
    });

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

function selectAgent(agents: any[]): any {
  // Weighted random selection based on persona characteristics
  const weights = agents.map((_, i) => {
    const persona = PERSONAS[i];
    return persona.interests.length + persona.goals.length;
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < weights.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return agents[i];
    }
  }

  return agents[0];
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
  variants: ContentVariant[],
): SimulationResults {
  // Calculate engagement metrics
  const totalInteractions = sessions.reduce(
    (sum, session) => sum + session.actions.length,
    0,
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
    >,
  );

  // Calculate conversion rate (simplified)
  const conversionRate =
    sessions.filter((session) =>
      session.actions.some((action) => action.type === "conversion"),
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

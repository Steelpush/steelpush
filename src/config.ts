import dotenv from "dotenv";

dotenv.config();

export const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
  analysis: {
    chunkSize: 4000,
    chunkOverlap: 200,
    modelName: "claude-3-7-sonnet-20250219",
    temperature: 0.2,
  },
};

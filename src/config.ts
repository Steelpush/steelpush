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
    modelName: "claude-opus-4-20250514",
    temperature: 0.2,
  },
};

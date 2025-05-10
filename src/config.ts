import dotenv from "dotenv";

dotenv.config();

export const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  analysis: {
    chunkSize: 4000,
    chunkOverlap: 200,
    modelName: "gpt-4",
    temperature: 0.2,
  },
};

import fs from "fs";
import path from "path";

export async function init(): Promise<void> {
  const config = {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || "",
      model: "gpt-4",
    },
    simulation: {
      defaultVisitorCount: 5,
      defaultPersonaCount: 2,
      defaultDuration: "1h",
    },
    export: {
      defaultFormat: "json",
    },
  };

  const configPath = path.join(process.cwd(), "steelpush.config.json");

  try {
    await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
    console.log("Steelpush configuration initialized successfully!");
  } catch (error) {
    console.error("Failed to initialize configuration:", error);
    throw error;
  }
}

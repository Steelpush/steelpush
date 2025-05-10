import { generateVariants } from "./generators";
import { config } from "./config";
import readline from "readline";

// Function to prompt for API key
async function getApiKey(): Promise<string> {
  // If API key is already set in environment, use it
  if (process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }

  // Otherwise prompt the user
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Please enter your OpenAI API key: ", (apiKey) => {
      rl.close();
      process.env.OPENAI_API_KEY = apiKey;
      resolve(apiKey);
    });
  });
}

async function testGenerator() {
  try {
    console.log("Testing content variant generation with AI SDK...");

    // Ensure API key is set
    await getApiKey();

    // Sample content element to generate variants for
    const element = {
      type: "headline",
      selector: "h1.hero-title",
      content: "Discover the Future of AI-Powered Websites",
      context: "Hero section headline on the homepage",
    };

    console.log(`Generating variants for: "${element.content}"`);

    // Generate variants
    const variants = await generateVariants(element);

    // Display results
    console.log("\nGenerated Variants:");
    variants.forEach((variant, index) => {
      console.log(`\nVariant ${index + 1}: "${variant.content}"`);
      console.log(`Score: ${variant.score}`);
      console.log(`Reasoning: ${variant.reasoning}`);
    });

    console.log("\nTest completed successfully!");
  } catch (error) {
    console.error("Test failed:", error);
  }
}

// Run the test
testGenerator();

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

export interface Element {
  type: string;
  selector: string;
  content: string;
  context: string;
}

export interface Variant {
  content: string;
  score: number;
  reasoning: string;
}

export async function generateVariants(element: Element): Promise<Variant[]> {
  // Create the system and user messages
  const systemMessage =
    "You are an expert copywriter and SEO specialist. Generate 3 optimized variants for the given content element. Consider the context and element type when generating variants.";

  const userMessage = `Element type: ${element.type}
Current content: ${element.content}
Context: ${element.context}

Generate 3 optimized variants with scores and reasoning. Format as JSON with the following structure:
[
  {
    "content": "Variant 1 text",
    "score": 0.95,
    "reasoning": "Why this variant might perform well"
  },
  ...
]`;

  try {
    // Use AI SDK to generate variants
    const completion = await generateText({
      model: openai("gpt-4"),
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
    });

    // Get the text from the completion object
    const responseText = completion.toString();

    // Try to parse JSON from the response
    try {
      const jsonMatch = responseText.match(
        /```(?:json)?\s*([\s\S]*?)\s*```/
      ) || [null, responseText];
      const jsonString = jsonMatch[1].trim();
      const variants = JSON.parse(jsonString);

      // Validate the response format
      if (Array.isArray(variants) && variants.length > 0) {
        return variants.map((v) => ({
          content: v.content,
          score: v.score,
          reasoning: v.reasoning,
        }));
      }

      throw new Error("Response format was not as expected");
    } catch (jsonError) {
      // Fallback to text parsing if JSON parsing fails
      const variants: Variant[] = [];
      const lines = responseText.split("\n");

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("Variant")) {
          const content = lines[i].split(":")[1]?.trim() || "";
          const score = parseFloat(lines[i + 1].split(":")[1]?.trim() || "0");
          const reasoning = lines[i + 2].split(":")[1]?.trim() || "";

          if (content) {
            variants.push({
              content,
              score: isNaN(score) ? 0.5 : score,
              reasoning,
            });
          }

          i += 2;
        }
      }

      return variants;
    }
  } catch (error) {
    console.error("Error generating variants:", error);
    throw error;
  }
}

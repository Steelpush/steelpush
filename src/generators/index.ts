import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  ChatPromptTemplate,
} from "langchain/prompts";

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
  const model = new ChatOpenAI({
    modelName: "gpt-4",
    temperature: 0.7,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(
      "You are an expert copywriter and SEO specialist. Generate 3 optimized variants for the given content element. Consider the context and element type when generating variants.",
    ),
    HumanMessagePromptTemplate.fromTemplate(
      "Element type: {type}\nCurrent content: {content}\nContext: {context}\n\nGenerate 3 optimized variants with scores and reasoning.",
    ),
  ]);

  const response = await model.call(
    await prompt.formatMessages({
      type: element.type,
      content: element.content,
      context: element.context,
    }),
  );

  // Parse the response to extract variants
  const variants: Variant[] = [];
  const content =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("Variant")) {
      const content = lines[i].split(":")[1].trim();
      const score = parseFloat(lines[i + 1].split(":")[1].trim());
      const reasoning = lines[i + 2].split(":")[1].trim();

      variants.push({ content, score, reasoning });
      i += 2;
    }
  }

  return variants;
}

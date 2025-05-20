import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import OpenAI from "openai";

// Load environment variables
dotenv.config();

async function simpleTextScan(url = "https://usetrag.com/") {
  console.log(`Starting simple text scan for ${url}`);
  const startTime = Date.now();

  // Create output directory
  const outputDir = "./outputs";
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Launch browser
  const browser = await chromium.launch({
    headless: false,
    slowMo: 200,
  });
  const page = await browser.newPage();

  try {
    // Navigate to URL
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    // Take initial screenshot
    const initialScreenshotPath = path.join(
      outputDir,
      "initial-screenshot.png"
    );
    await page.screenshot({ path: initialScreenshotPath });
    console.log(`Initial screenshot saved: ${initialScreenshotPath}`);

    // Scroll down to see full page and capture multiple screenshots
    console.log("Scrolling through page...");
    const screenshots = [];

    // Get page height
    const pageHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    const numScreenshots = Math.ceil(pageHeight / viewportHeight);

    console.log(
      `Page height: ${pageHeight}px, taking ${numScreenshots} screenshots`
    );

    for (let i = 0; i < numScreenshots; i++) {
      // Scroll to position
      await page.evaluate((scrollTo) => {
        window.scrollTo(0, scrollTo);
      }, i * viewportHeight);

      // Wait for content to load
      await page.waitForTimeout(500);

      // Take screenshot
      const screenshotPath = path.join(outputDir, `screenshot-${i + 1}.png`);
      await page.screenshot({ path: screenshotPath });
      screenshots.push(screenshotPath);
      console.log(`Screenshot ${i + 1}/${numScreenshots} saved`);
    }

    // Scroll back to top
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });

    // Capture page metadata
    const pageTitle = await page.title();
    const pageUrl = page.url();

    // Extract text content from the page
    console.log("Extracting page content...");
    const textContent = await page.evaluate(() => {
      // Simplified text extraction that doesn't use Node.TEXT_NODE
      function getVisibleText() {
        // Get all text elements
        const textElements = Array.from(
          document.querySelectorAll(
            'h1, h2, h3, h4, h5, h6, p, a, button, span, li, label, input[type="submit"], input[type="button"]'
          )
        );

        // Filter out hidden elements and extract text with context
        return textElements
          .filter((el) => {
            // Check if element is visible
            const style = window.getComputedStyle(el);
            return (
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              el.textContent.trim().length > 0
            );
          })
          .map((el) => {
            // Get element details
            const tag = el.tagName.toLowerCase();
            const id = el.id ? `#${el.id}` : "";
            const classes =
              el.className && typeof el.className === "string"
                ? `.${el.className.split(" ").join(".")}`
                : "";
            const text = el.textContent.trim();

            // Get location context (parent elements)
            let parent = el.parentElement;
            let parentContext = "";
            if (parent && parent !== document.body) {
              parentContext = ` in ${parent.tagName.toLowerCase()}`;
              if (parent.id) parentContext += `#${parent.id}`;
            }

            // Special handling for links and buttons
            let extra = "";
            if (tag === "a" && el.href) {
              extra = ` href="${el.href}"`;
            }
            if (
              tag === "button" ||
              (tag === "input" &&
                (el.type === "submit" || el.type === "button"))
            ) {
              extra = " (button)";
            }

            // Format the output
            return `${tag}${id}${classes}${extra}${parentContext}: "${text}"`;
          })
          .join("\n\n");
      }

      return getVisibleText();
    });

    // Save page text content to file
    const textContentPath = path.join(outputDir, "page-content.txt");
    fs.writeFileSync(textContentPath, textContent);
    console.log(`Page text content saved: ${textContentPath}`);

    // Create an OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Make the analysis request
    console.log("Requesting analysis from OpenAI...");
    const modelName = process.env.OPENAI_MODEL || "gpt-4o-mini";
    console.log(`Using model: ${modelName}`);

    const completion = await openai.chat.completions.create({
      model: modelName,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `You are a conversion optimization expert analyzing ${url}.
          Focus on identifying specific elements that could be improved to increase conversion rates.`,
        },
        {
          role: "user",
          content: `I need your help identifying conversion optimization opportunities for ${pageTitle} (${pageUrl}).

I've extracted the page content which is attached below.

Based on this content, please identify 3-5 specific elements that could be improved for better conversion rates.

For each element:
1. Identify the element type (headline, CTA, button, etc.)
2. Quote the exact current content text
3. Describe where it appears on the page
4. Explain the issue with the current version
5. Provide a specific recommendation for improvement

Here is the page content:
---
${textContent.substring(0, 10000)} 
${textContent.length > 10000 ? "... (content truncated)" : ""}
---

Format your response as a list of numbered optimization opportunities.`,
        },
      ],
    });

    // Save and process results
    const analysisResponse =
      completion.choices[0]?.message?.content || "No response generated";

    const textOutputPath = path.join(outputDir, "analysis-result.md");
    fs.writeFileSync(textOutputPath, analysisResponse);

    // Print summary
    console.log("\nAnalysis completed successfully!");
    console.log(
      `Scan duration: ${Math.round((Date.now() - startTime) / 1000)} seconds`
    );
    console.log(`Results saved to: ${outputDir}`);

    // Print preview
    console.log("\nAnalysis preview:");
    console.log("-----------------");
    console.log(
      analysisResponse.substring(0, 500) +
        (analysisResponse.length > 500 ? "..." : "")
    );
    console.log("-----------------");
  } catch (error) {
    console.error("Scan failed:", error);
  } finally {
    await browser.close();
  }
}

// Run the scan
simpleTextScan().catch(console.error);

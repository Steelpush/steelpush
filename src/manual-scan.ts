import { chromium } from "playwright";
import fs from "fs";
import path from "path";

/**
 * Ultra simple website scanner that just takes screenshots.
 * No fancy extraction, no MCP complexity, just plain screenshots.
 */
async function manualScan(url = "https://usetrag.com/") {
  console.log(`Starting manual scan for ${url}`);

  // Create output directory
  const outputDir = "./outputs";
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Launch browser - non-headless so you can see it
  const browser = await chromium.launch({
    headless: false,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();

  try {
    // Navigate to URL
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    console.log("Page loaded");

    // Take a fullpage screenshot
    const screenshotPath = path.join(outputDir, "fullpage.png");
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
    });
    console.log(`Fullpage screenshot saved to: ${screenshotPath}`);

    // Stay open to allow manual inspection
    console.log("\nBrowser will stay open for manual inspection.");
    console.log("Press Ctrl+C in the terminal when done.");

    // Keep the process running
    await new Promise((resolve) => {
      const interval = setInterval(() => {
        console.log("Browser still open. Press Ctrl+C to close.");
      }, 30000); // Remind every 30 seconds

      process.on("SIGINT", () => {
        clearInterval(interval);
        resolve(null);
      });
    });
  } catch (error) {
    console.error("Scan failed:", error);
  } finally {
    console.log("Closing browser");
    await browser.close();
  }
}

// Run the scan
manualScan().catch(console.error);

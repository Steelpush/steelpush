import {
  scan,
  scanWebsite,
  scanCodebase,
  WebsiteScanResult,
  CodebaseScanResult,
} from "./scanner";
import fs from "fs";
import path from "path";
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

// Function to test scanning
async function testScanner() {
  try {
    // Ensure API key is set
    await getApiKey();

    // Ask for scan type
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const scanType = await new Promise<string>((resolve) => {
      rl.question("Choose scan type (website/codebase): ", (answer) => {
        resolve(answer.toLowerCase());
        rl.close();
      });
    });

    let result;
    if (scanType === "website") {
      const url = await getWebsiteUrl();
      console.log(`Starting website scan for: ${url}`);
      result = await scanWebsite(url);
    } else {
      const directory = await getDirectory();
      console.log(`Starting codebase scan for: ${directory}`);
      result = await scanCodebase(directory);
    }

    // Save results to file
    const outputPath = path.join(process.cwd(), "scan-results.json");
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    console.log(`\nScan completed successfully!`);
    console.log(`Results saved to: ${outputPath}`);
    console.log(`\nSummary:`);

    if (result.type === "website") {
      const websiteResult = result.data as WebsiteScanResult;
      console.log(`- Scanned ${websiteResult.scannedPages.length} pages`);
      console.log(`- Found ${websiteResult.content.length} content items`);
      console.log(
        `- Scan duration: ${Math.round(websiteResult.metadata.scanDuration / 1000)} seconds`
      );

      // Print a sample of content items
      if (websiteResult.content.length > 0) {
        console.log(`\nSample content items:`);
        websiteResult.content.slice(0, 5).forEach((item, i) => {
          console.log(`\n${i + 1}. ${item.type} (${item.importance})`);
          console.log(`   Content: "${item.content}"`);
          console.log(`   Location: ${item.location}`);
        });

        if (websiteResult.content.length > 5) {
          console.log(
            `\n... and ${websiteResult.content.length - 5} more items.`
          );
        }
      }
    } else {
      const codebaseResult = result.data as CodebaseScanResult;
      console.log(`- Scanned ${codebaseResult.scannedFiles.length} files`);
      console.log(`- Found ${codebaseResult.content.length} content items`);
      console.log(
        `- Scan duration: ${Math.round(codebaseResult.metadata.scanDuration / 1000)} seconds`
      );

      // Print file type distribution
      console.log(`\nFile types:`);
      Object.entries(codebaseResult.metadata.fileTypes)
        .sort((a, b) => b[1] - a[1])
        .forEach(([ext, count]) => {
          console.log(`- ${ext}: ${count} files`);
        });

      // Print a sample of content items
      if (codebaseResult.content.length > 0) {
        console.log(`\nSample content items:`);
        codebaseResult.content.slice(0, 5).forEach((item, i) => {
          console.log(`\n${i + 1}. ${item.type} (${item.importance})`);
          console.log(`   Content: "${item.content}"`);
          console.log(`   File: ${item.file}`);
          console.log(`   Location: ${item.location}`);
        });

        if (codebaseResult.content.length > 5) {
          console.log(
            `\n... and ${codebaseResult.content.length - 5} more items.`
          );
        }
      }
    }
  } catch (error) {
    console.error("Test failed:", error);
  }
}

// Helper to get website URL
async function getWebsiteUrl(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<string>((resolve) => {
    rl.question("Enter website URL to scan: ", (url) => {
      rl.close();
      // Add protocol if missing
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url;
      }
      resolve(url);
    });
  });
}

// Helper to get directory path
async function getDirectory(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<string>((resolve) => {
    rl.question(
      "Enter codebase directory path (default: current directory): ",
      (directory) => {
        rl.close();
        resolve(directory || process.cwd());
      }
    );
  });
}

// Run the test
testScanner();

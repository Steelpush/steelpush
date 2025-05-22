import { scanWebsite, WebsiteScanResult } from "./scanner";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function main() {
  try {
    console.log("Starting website analysis for https://usetrag.com/");

    const url = "https://usetrag.com/";
    const result = await scanWebsite(url);

    // Save results to file
    const outputPath = path.join(process.cwd(), "usetrag-analysis.json");
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    console.log(`\nAnalysis completed successfully!`);
    console.log(`Results saved to: ${outputPath}`);

    // Print summary
    const websiteResult = result.data as WebsiteScanResult;
    console.log(`\nSummary:`);
    console.log(`- Scanned ${websiteResult.scannedPages.length} pages`);
    console.log(`- Found ${websiteResult.content.length} content items`);
    console.log(
      `- Scan duration: ${Math.round(websiteResult.metadata.scanDuration / 1000)} seconds`
    );

    // Print sample content items
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
  } catch (error) {
    console.error("Analysis failed:", error);
  }
}

main();

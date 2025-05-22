import { analyzeComponents } from "./analyzer/component-analyzer";
import {
  exportMarketingContent,
  createOptimizationReport,
} from "./exporter/content-exporter";

async function testExporter() {
  try {
    console.log("Starting content analysis and export test...");

    // First, analyze the test project
    const analysisResult = await analyzeComponents("test-project");

    console.log(
      `\nFound ${analysisResult.marketingContent.length} marketing content items in test project`,
    );

    // Now export the results in different formats
    if (analysisResult.marketingContent.length > 0) {
      // Export as JSON
      await exportMarketingContent(analysisResult.marketingContent, {
        format: "json",
        outputPath: "outputs/marketing-content.json",
      });

      // Export as CSV
      await exportMarketingContent(analysisResult.marketingContent, {
        format: "csv",
        outputPath: "outputs/marketing-content.csv",
      });

      // Export as Markdown
      await exportMarketingContent(analysisResult.marketingContent, {
        format: "markdown",
        outputPath: "outputs/marketing-content.md",
      });

      // Create optimization report
      await createOptimizationReport(
        analysisResult.marketingContent,
        "outputs/optimization-report.md",
      );

      console.log(
        "\nExport complete. Check the 'outputs' directory for exported files.",
      );
    } else {
      console.log("No marketing content found to export.");
    }
  } catch (error) {
    console.error("Export failed:", error);
  }
}

testExporter();

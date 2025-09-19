/**
 * Analyze command implementation
 */

import { Command } from "commander";
import * as fs from "fs";
import { scanWebsite } from "../scanner";
import { scanCodebase } from "../scanner/codebase-scanner";
import {
  exportContentToJson,
  exportContentToMarkdown,
  exportContentToCsv,
} from "../exporter";
import { loadConfig } from "../utils/config";
import { convertToREQFormat } from "../utils/format-converter";

export function analyzeCommand(program: Command): Command {
  return program
    .command("analyze <target>")
    .description("Analyze a website or codebase for optimization opportunities")
    .option("-o, --output <path>", "Output file path")
    .option(
      "-f, --format <format>",
      "Output format (json, markdown, csv)",
      "json"
    )
    .option("-m, --max-pages <number>", "Maximum number of pages to scan", "3")
    .option("-d, --max-depth <number>", "Maximum link depth to crawl", "2")
    .option("--screenshots <dir>", "Screenshots directory", "screenshots")
    .option("--no-headless", "Show browser during scanning")
    .option("--no-interactive", "Disable interactive element testing")
    .option("--no-vision", "Disable AI vision analysis")
    .option("--no-report", "Skip comprehensive conversion report generation")
    .action(async (target, options) => {
      console.log(`Analyzing ${target}...`);

      // Check if config exists
      const config = loadConfig();
      if (!config) {
        console.error("Steelpush not initialized. Run 'steelpush init' first.");
        process.exit(1);
      }

      try {
        // Determine if target is a URL or file path
        const isUrl =
          target.startsWith("http://") || target.startsWith("https://");

        let result;
        if (isUrl) {
          // Scan website
          result = await scanWebsite(target, {
            interactiveMode: options.interactive !== false,
            visionMode: options.vision !== false,
            generateReport: options.report !== false,
          });
        } else {
          // Scan codebase
          result = await scanCodebase(target);
        }

        // Determine output path
        const outputPath =
          options.output ||
          `steelpush-analysis-${Date.now()}.${options.format}`;

        // Export results
        switch (options.format) {
          case "markdown":
            await exportContentToMarkdown(result, outputPath);
            break;
          case "csv":
            await exportContentToCsv(result, outputPath);
            break;
          case "json":
          default:
            await exportContentToJson(result, outputPath);
            break;
        }

        // Also export in REQ.md compliant format (always)
        const reqFormat = convertToREQFormat(result);
        const reqPath = outputPath.replace(/\.[^.]+$/, "-req-format.json");
        fs.writeFileSync(reqPath, JSON.stringify(reqFormat, null, 2));

        console.log(`\nAnalysis complete!`);
        console.log(`Results saved to ${outputPath}`);
        console.log(`REQ.md format saved to ${reqPath}`);

        // Output summary stats
        if (
          result &&
          "type" in result &&
          result.type === "website" &&
          "data" in result
        ) {
          const websiteData = result.data as any;
          if (websiteData.pages) {
            const pageCount = websiteData.pages.length;
            const elementCount = websiteData.pages.reduce(
              (sum: number, page: any) =>
                sum + (page.optimizableElements?.length || 0),
              0
            );

            console.log(`\n📊 Analysis Summary:`);
            console.log(`📄 Analyzed ${pageCount} pages`);
            console.log(`🎯 Found ${elementCount} optimizable elements`);
            console.log(
              `✅ Generated ${reqFormat.opportunities.length} structured opportunities for approval`
            );

            // Show enhanced features summary
            const totalInteractions = websiteData.pages.reduce(
              (sum: number, page: any) =>
                sum + (page.interactions?.length || 0),
              0
            );
            const pagesWithVision = websiteData.pages.filter(
              (page: any) => page.visionAnalysis
            ).length;
            const totalScreenshots = websiteData.pages.reduce(
              (sum: number, page: any) => sum + (page.screenshots?.length || 0),
              0
            );

            if (totalInteractions > 0) {
              console.log(
                `🖱️ Performed ${totalInteractions} interactive tests`
              );
            }
            if (pagesWithVision > 0) {
              console.log(`👁️ AI vision analysis on ${pagesWithVision} pages`);
            }
            if (totalScreenshots > 0) {
              console.log(`📸 Captured ${totalScreenshots} screenshots`);
            }

            // Show conversion report summary if available
            if (websiteData.conversionReport) {
              const report = websiteData.conversionReport;
              console.log(`\n🚀 Conversion Optimization Report:`);
              console.log(
                `⚡ High-priority opportunities: ${report.summary.highPriorityOpportunities}`
              );
              console.log(
                `📈 Estimated conversion uplift: ${(report.summary.estimatedConversionUplift * 100).toFixed(1)}%`
              );

              if (report.keyFindings && report.keyFindings.length > 0) {
                console.log(`\n🔍 Key Findings:`);
                report.keyFindings.slice(0, 3).forEach((finding: string) => {
                  console.log(`  • ${finding}`);
                });
              }
            }

            // Show a few examples of optimizable elements
            if (elementCount > 0) {
              const firstPage = websiteData.pages.find(
                (page: any) =>
                  page.optimizableElements &&
                  page.optimizableElements.length > 0
              );

              if (firstPage && firstPage.optimizableElements.length > 0) {
                console.log(`\nSample optimization opportunities:`);

                for (
                  let i = 0;
                  i < Math.min(3, firstPage.optimizableElements.length);
                  i++
                ) {
                  const element = firstPage.optimizableElements[i];
                  console.log(
                    `- ${element.type}: "${element.content.substring(0, 50)}${element.content.length > 50 ? "..." : ""}"`
                  );
                  console.log(`  Issue: ${element.issue}`);
                  console.log(`  Recommendation: ${element.recommendation}`);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Analysis failed:", error);
        process.exit(1);
      }
    });
}

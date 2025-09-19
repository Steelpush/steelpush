/**
 * Approve command implementation - allows human review and approval of optimization opportunities
 */

import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";

interface OptimizationOpportunity {
  id: string;
  element_type: string;
  original_content: string;
  element_selector: string;
  context_description: string;
  optimization_reasoning: string;
  confidence_score: number;
  approved: boolean | null;
}

interface AnalysisData {
  website_url: string;
  analysis_timestamp: string;
  opportunities: OptimizationOpportunity[];
}

export function approveCommand(program: Command): Command {
  return program
    .command("approve <analysis-file>")
    .description(
      "Review and approve optimization opportunities from analysis results"
    )
    .option("-o, --output <path>", "Output file for approved opportunities")
    .option(
      "-a, --auto-approve <threshold>",
      "Auto-approve opportunities above confidence threshold (0-1)"
    )
    .action(async (analysisFile: string, options) => {
      console.log("🔍 Loading optimization opportunities for review...\n");

      // Load analysis file
      if (!fs.existsSync(analysisFile)) {
        console.error(`❌ Analysis file not found: ${analysisFile}`);
        console.log("💡 Run analysis first: steelpush analyze <website-url>");
        process.exit(1);
      }

      let analysisData: AnalysisData;
      try {
        const fileContent = fs.readFileSync(analysisFile, "utf-8");
        const rawData = JSON.parse(fileContent);

        // Convert from internal format to REQ.md format if needed
        analysisData = convertToStandardFormat(rawData);
      } catch (error) {
        console.error("❌ Failed to parse analysis file:", error);
        process.exit(1);
      }

      if (
        !analysisData.opportunities ||
        analysisData.opportunities.length === 0
      ) {
        console.log("ℹ️  No optimization opportunities found in analysis.");
        process.exit(0);
      }

      console.log(
        `📊 Found ${analysisData.opportunities.length} optimization opportunities\n`
      );
      console.log(`🌐 Website: ${analysisData.website_url}`);
      console.log(`📅 Analysis Date: ${analysisData.analysis_timestamp}\n`);

      const { default: inquirer } = await import("inquirer");

      // Auto-approve if threshold is set
      if (options.autoApprove) {
        const threshold = parseFloat(options.autoApprove);
        if (threshold >= 0 && threshold <= 1) {
          analysisData.opportunities.forEach((opp) => {
            if (opp.confidence_score >= threshold) {
              opp.approved = true;
              console.log(
                `✅ Auto-approved: ${opp.element_type} (confidence: ${opp.confidence_score})`
              );
            }
          });
        }
      }

      // Review each opportunity interactively
      for (let i = 0; i < analysisData.opportunities.length; i++) {
        const opportunity = analysisData.opportunities[i];

        // Skip if already auto-approved
        if (opportunity.approved === true) continue;

        console.log("═".repeat(80));
        console.log(
          `📋 Opportunity ${i + 1} of ${analysisData.opportunities.length}`
        );
        console.log(`🆔 ID: ${opportunity.id}`);
        console.log(`🎯 Type: ${opportunity.element_type}`);
        console.log(`📍 Location: ${opportunity.context_description}`);
        console.log(
          `🎚️  Confidence: ${(opportunity.confidence_score * 100).toFixed(1)}%`
        );
        console.log("─".repeat(80));
        console.log(`📝 Current Content:`);
        console.log(`   "${opportunity.original_content}"`);
        console.log("─".repeat(80));
        console.log(`🔧 Issue Identified:`);
        console.log(`   ${opportunity.optimization_reasoning}`);
        console.log("─".repeat(80));
        console.log(`🎯 CSS Selector: ${opportunity.element_selector}`);
        console.log("═".repeat(80));

        const answers = await inquirer.prompt([
          {
            type: "list",
            name: "decision",
            message: "What would you like to do with this opportunity?",
            choices: [
              {
                name: "✅ Approve - Include in optimization",
                value: "approve",
              },
              { name: "❌ Reject - Skip this opportunity", value: "reject" },
              { name: "⏭️  Skip - Decide later", value: "skip" },
              { name: "📋 Show Details Again", value: "details" },
              { name: "🚪 Exit Review", value: "exit" },
            ],
          },
        ]);

        switch (answers.decision) {
          case "approve":
            opportunity.approved = true;
            console.log("✅ Opportunity approved!\n");
            break;
          case "reject":
            opportunity.approved = false;
            console.log("❌ Opportunity rejected.\n");
            break;
          case "skip":
            opportunity.approved = null;
            console.log("⏭️  Skipped for now.\n");
            break;
          case "details":
            i--; // Show this opportunity again
            continue;
          case "exit":
            console.log("🚪 Exiting review...");
            break;
        }

        if (answers.decision === "exit") break;
      }

      // Generate summary
      const approved = analysisData.opportunities.filter(
        (o) => o.approved === true
      );
      const rejected = analysisData.opportunities.filter(
        (o) => o.approved === false
      );
      const pending = analysisData.opportunities.filter(
        (o) => o.approved === null
      );

      console.log("\n📊 Review Summary:");
      console.log(`✅ Approved: ${approved.length}`);
      console.log(`❌ Rejected: ${rejected.length}`);
      console.log(`⏸️  Pending: ${pending.length}`);

      // Save results
      const outputPath =
        options.output || analysisFile.replace(".json", "-approved.json");
      fs.writeFileSync(outputPath, JSON.stringify(analysisData, null, 2));

      console.log(`\n💾 Results saved to: ${outputPath}`);

      if (approved.length > 0) {
        console.log(`\n🎉 Ready for next step! Run:`);
        console.log(`   steelpush generate ${outputPath}`);
      } else {
        console.log(
          `\n💡 No opportunities approved. You can run approve again anytime.`
        );
      }
    });
}

/**
 * Convert internal analysis format to standard REQ.md format
 */
function convertToStandardFormat(rawData: any): AnalysisData {
  const opportunities: OptimizationOpportunity[] = [];
  let website_url = rawData.source || rawData.website_url || "Unknown";

  // Handle different internal formats
  if (rawData.type === "website" && rawData.data) {
    // Handle website scan format
    if (rawData.data.pages) {
      rawData.data.pages.forEach((page: any, pageIndex: number) => {
        if (page.optimizableElements) {
          page.optimizableElements.forEach(
            (element: any, elemIndex: number) => {
              opportunities.push({
                id: `opp_${pageIndex + 1}_${elemIndex + 1}`,
                element_type: element.type || "unknown",
                original_content: element.content || "",
                element_selector: element.selector || generateSelector(element),
                context_description: `${element.location || "page"} on ${page.pageUrl || website_url}`,
                optimization_reasoning:
                  element.issue ||
                  element.recommendation ||
                  "No specific reasoning provided",
                confidence_score: calculateConfidenceScore(element),
                approved: null,
              });
            }
          );
        }
      });
    }

    // Handle content-based format
    if (rawData.data.content) {
      rawData.data.content.forEach((item: any, index: number) => {
        opportunities.push({
          id: `opp_${index + 1}`,
          element_type: item.type || "unknown",
          original_content: item.content || "",
          element_selector: generateSelector(item),
          context_description: `${item.location || "unknown"} on ${item.url || website_url}`,
          optimization_reasoning:
            item.issue ||
            item.recommendation ||
            "No specific reasoning provided",
          confidence_score: calculateConfidenceScore(item),
          approved: null,
        });
      });
    }
  }

  // If already in standard format, use as-is
  if (rawData.opportunities) {
    return {
      website_url: rawData.website_url || website_url,
      analysis_timestamp:
        rawData.analysis_timestamp || new Date().toISOString(),
      opportunities: rawData.opportunities,
    };
  }

  return {
    website_url,
    analysis_timestamp: new Date(rawData.timestamp || Date.now()).toISOString(),
    opportunities,
  };
}

/**
 * Generate a CSS selector for an element
 */
function generateSelector(element: any): string {
  if (element.selector) return element.selector;

  const type = element.type || "unknown";
  switch (type.toLowerCase()) {
    case "heading":
    case "headline":
      return "h1, h2, h3";
    case "cta":
    case "button":
      return "button, .btn, .cta";
    case "form":
      return "form, .form";
    case "paragraph":
      return "p";
    default:
      return "*";
  }
}

/**
 * Calculate confidence score based on element properties
 */
function calculateConfidenceScore(element: any): number {
  let score = 0.5; // Base score

  // Higher score for high importance elements
  if (element.importance === "high") score += 0.3;
  else if (element.importance === "medium") score += 0.1;

  // Higher score for high optimization potential
  if (element.optimizationPotential === "high") score += 0.2;
  else if (element.optimizationPotential === "medium") score += 0.1;

  // Ensure score is between 0 and 1
  return Math.min(Math.max(score, 0), 1);
}

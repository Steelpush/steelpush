import fs from "fs";
import path from "path";
import { MarketingContentItem } from "../analyzer/component-analyzer";

export interface ExportOptions {
  format: "json" | "csv" | "markdown";
  outputPath: string;
  includeContext?: boolean;
}

/**
 * Exports marketing content analysis results to a file
 *
 * @param content The marketing content items to export
 * @param options Export options including format and output path
 * @returns Promise resolving to the path of the exported file
 */
export async function exportMarketingContent(
  content: MarketingContentItem[],
  options: ExportOptions,
): Promise<string> {
  const { format, outputPath, includeContext = true } = options;

  // Create output directory if it doesn't exist
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate content based on format
  let outputContent: string;

  switch (format) {
    case "json":
      outputContent = exportAsJSON(content, includeContext);
      break;
    case "csv":
      outputContent = exportAsCSV(content, includeContext);
      break;
    case "markdown":
      outputContent = exportAsMarkdown(content, includeContext);
      break;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }

  // Write to output file
  fs.writeFileSync(outputPath, outputContent, "utf-8");
  console.log(`Exported marketing content to ${outputPath}`);

  return outputPath;
}

/**
 * Export content as JSON format
 */
function exportAsJSON(
  content: MarketingContentItem[],
  includeContext: boolean,
): string {
  if (!includeContext) {
    // Remove context if not needed, but create a new array with the correct type
    return JSON.stringify(
      content.map(({ context, ...rest }) => ({
        ...rest,
        // Keep context property but set it to empty string when not including it
        context: "",
      })),
      null,
      2,
    );
  }

  return JSON.stringify(content, null, 2);
}

/**
 * Export content as CSV format
 */
function exportAsCSV(
  content: MarketingContentItem[],
  includeContext: boolean,
): string {
  // Define headers based on whether context is included
  const headers = includeContext
    ? ["file", "content", "type", "context", "lineNumber"]
    : ["file", "content", "type", "lineNumber"];

  // Create header row
  let csv = headers.join(",") + "\n";

  // Add content rows
  content.forEach((item) => {
    const escapedContent = item.content.replace(/"/g, '""');

    if (includeContext) {
      const escapedContext = item.context.replace(/"/g, '""');
      csv += `"${item.file}","${escapedContent}","${item.type}","${escapedContext}",${item.lineNumber}\n`;
    } else {
      csv += `"${item.file}","${escapedContent}","${item.type}",${item.lineNumber}\n`;
    }
  });

  return csv;
}

/**
 * Export content as Markdown format
 */
function exportAsMarkdown(
  content: MarketingContentItem[],
  includeContext: boolean,
): string {
  // Create header
  let markdown = "# Marketing Content Analysis\n\n";

  // Group content by file
  const contentByFile: Record<string, MarketingContentItem[]> = {};

  content.forEach((item) => {
    if (!contentByFile[item.file]) {
      contentByFile[item.file] = [];
    }
    contentByFile[item.file].push(item);
  });

  // Generate markdown for each file
  Object.entries(contentByFile).forEach(([file, items]) => {
    markdown += `## ${file}\n\n`;

    // Create table headers
    markdown += includeContext
      ? "| Content | Type | Context | Line |\n| --- | --- | --- | --- |\n"
      : "| Content | Type | Line |\n| --- | --- | --- |\n";

    // Add table rows
    items.forEach((item) => {
      if (includeContext) {
        markdown += `| ${item.content} | ${item.type} | ${item.context} | ${item.lineNumber} |\n`;
      } else {
        markdown += `| ${item.content} | ${item.type} | ${item.lineNumber} |\n`;
      }
    });

    markdown += "\n";
  });

  // Add summary
  markdown += `## Summary\n\n`;
  markdown += `- Total content items: ${content.length}\n`;
  markdown += `- Files with content: ${Object.keys(contentByFile).length}\n`;
  markdown += `- Content types: ${[...new Set(content.map((item) => item.type))].join(", ")}\n`;

  return markdown;
}

/**
 * Creates a formatted report of marketing content optimization opportunities
 */
export async function createOptimizationReport(
  content: MarketingContentItem[],
  outputPath: string,
): Promise<string> {
  // Group by content type
  const contentByType: Record<string, MarketingContentItem[]> = {};

  content.forEach((item) => {
    if (!contentByType[item.type]) {
      contentByType[item.type] = [];
    }
    contentByType[item.type].push(item);
  });

  // Create report
  let report = "# Marketing Content Optimization Opportunities\n\n";

  // Executive summary
  report += "## Executive Summary\n\n";
  report += `This report identified ${content.length} pieces of marketing content across ${Object.keys(contentByType).length} different types.\n\n`;
  report += "The following optimization opportunities were identified:\n\n";

  // Type summaries
  report += "## Content by Type\n\n";

  Object.entries(contentByType).forEach(([type, items]) => {
    report += `### ${type} (${items.length} items)\n\n`;

    // Get optimization suggestions based on type
    const suggestions = getOptimizationSuggestions(type);
    report += `${suggestions}\n\n`;

    // Sample items (limit to 3)
    report += "**Examples:**\n\n";
    items.slice(0, 3).forEach((item) => {
      report += `- **${item.content}** (${item.file}, line ${item.lineNumber})\n`;
    });

    report += "\n";
  });

  // Write to output file
  fs.writeFileSync(outputPath, report, "utf-8");
  console.log(`Created optimization report at ${outputPath}`);

  return outputPath;
}

/**
 * Returns optimization suggestions based on content type
 */
function getOptimizationSuggestions(type: string): string {
  const suggestions: Record<string, string> = {
    heading:
      "Headings should be concise, benefit-oriented, and contain relevant keywords. Consider A/B testing variations to improve engagement.",
    tagline:
      "Taglines should quickly communicate your unique value proposition. They should be memorable and address customer pain points.",
    description:
      "Descriptions should be clear, focused on benefits rather than features, and include strong action words. Keep sentences short and impactful.",
    cta: "CTAs should use action verbs, create urgency, and communicate value. Test different variations to optimize conversion rates.",
    feature:
      "Feature descriptions should focus on benefits to the user rather than technical details. Use customer-centric language.",
    benefit:
      "Benefit statements should be specific, measurable, and address direct customer needs. Use concrete examples when possible.",
    testimonial:
      "Testimonials should be authentic, specific, and include measurable results. Include customer names and titles for credibility when possible.",
  };

  return (
    suggestions[type] ||
    "Consider testing alternative wording to improve clarity and impact. Focus on customer benefits and use action-oriented language."
  );
}

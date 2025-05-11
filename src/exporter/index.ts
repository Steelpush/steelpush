import {
  exportMarketingContent,
  createOptimizationReport,
} from "./content-exporter";

export async function exportContentToJson(
  content: any,
  outputPath: string
): Promise<string> {
  return exportMarketingContent(content, {
    format: "json",
    outputPath,
  });
}

export async function exportContentToMarkdown(
  content: any,
  outputPath: string
): Promise<string> {
  return exportMarketingContent(content, {
    format: "markdown",
    outputPath,
  });
}

export async function exportContentToCsv(
  content: any,
  outputPath: string
): Promise<string> {
  return exportMarketingContent(content, {
    format: "csv",
    outputPath,
  });
}

export { exportMarketingContent, createOptimizationReport };

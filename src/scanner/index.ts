import type { CodeContent, CodebaseScanResult } from "./codebase-scanner";
import { scanCodebase as scanCodebaseInternal } from "./codebase-scanner";
import {
  scanWebsiteAdvanced,
  PageContent,
  OptimizableElement,
} from "./advanced-scanner";

// Define compatible types based on advanced-scanner
export interface WebsiteContent {
  url: string;
  type: string;
  content: string;
  location: string;
  importance: string;
  optimizationPotential: string;
  issue?: string;
  recommendation?: string;
}

export interface WebsiteScanResult {
  pages: Array<{
    pageUrl: string;
    pageTitle: string;
    optimizableElements: OptimizableElement[];
  }>;
}

export { CodeContent, CodebaseScanResult };

/**
 * Main interface for the scanner module
 */
export interface ScannerOptions {
  maxPages?: number;
  maxFiles?: number;
  includeHiddenContent?: boolean;
  maxDepth?: number; // Maximum depth for website crawling
  headless?: boolean; // Whether to run browser in headless mode
  timeout?: number; // Timeout for scanning operations in milliseconds
  interactiveMode?: boolean; // Enable button clicking and interactions
  visionMode?: boolean; // Enable AI vision analysis
  generateReport?: boolean; // Generate comprehensive conversion report
}

/**
 * Combined scan result format
 */
export interface ScanResult {
  type: "website" | "codebase";
  source: string;
  timestamp: number;
  data: WebsiteScanResult | CodebaseScanResult;
}

/**
 * Scans a website for content using the advanced scanner
 *
 * @param url The URL to scan
 * @param options Scanning options
 * @returns A promise resolving to the scan results
 */
export async function scanWebsite(
  url: string,
  options?: ScannerOptions
): Promise<ScanResult> {
  console.log("Using advanced scanner with vision and interactions");

  const advancedResult = await scanWebsiteAdvanced(url, {
    maxPages: options?.maxPages,
    maxDepth: options?.maxDepth,
    headless: options?.headless !== false,
    timeout: options?.timeout,
    interactiveMode: options?.interactiveMode !== false,
    visionMode: options?.visionMode !== false,
    generateReport: options?.generateReport !== false,
  });

  // Convert to WebsiteScanResult format
  const result: WebsiteScanResult = {
    pages: advancedResult.data.pages.map((page) => ({
      pageUrl: page.pageUrl,
      pageTitle: page.pageTitle,
      optimizableElements: page.optimizableElements,
    })),
  };

  return {
    type: "website",
    source: url,
    timestamp: Date.now(),
    data: result,
  };
}

/**
 * Scans a codebase directory for content
 *
 * @param directoryPath The path to the codebase directory
 * @param options Scanning options
 * @returns A promise resolving to the scan results
 */
export async function scanCodebase(
  directoryPath: string,
  options?: ScannerOptions
): Promise<ScanResult> {
  const result = await scanCodebaseInternal(directoryPath);

  return {
    type: "codebase",
    source: directoryPath,
    timestamp: Date.now(),
    data: result,
  };
}

/**
 * Determines the best scanning method based on the input
 *
 * @param input A URL or directory path to scan
 * @param options Scanning options
 * @returns A promise resolving to the scan results
 */
export async function scan(
  input: string,
  options?: ScannerOptions
): Promise<ScanResult> {
  // Determine if input is a URL or file path
  const isUrl = input.startsWith("http://") || input.startsWith("https://");

  if (isUrl) {
    return scanWebsite(input, options);
  } else {
    return scanCodebase(input, options);
  }
}

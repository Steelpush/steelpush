import type { WebsiteContent, WebsiteScanResult } from "./website-scanner";
import type { CodeContent, CodebaseScanResult } from "./codebase-scanner";
import { scanWebsite as scanWebsiteInternal } from "./website-scanner";
import { scanCodebase as scanCodebaseInternal } from "./codebase-scanner";
import { scanWebsiteWithMcp } from "./mcp-website-scanner";
import { scanWebsiteWithDirectMcp } from "./direct-mcp-scanner";
import { scanWebsiteWithEnhancedMcp } from "./enhanced-mcp-scanner";

export { WebsiteContent, WebsiteScanResult, CodeContent, CodebaseScanResult };

/**
 * Main interface for the scanner module
 */
export interface ScannerOptions {
  maxPages?: number;
  maxFiles?: number;
  includeHiddenContent?: boolean;
  useMcp?: boolean; // Option to use MCP for website scanning
  useDirectMcp?: boolean; // Option to use the simplified direct MCP scanner
  useEnhancedMcp?: boolean; // Option to use the enhanced MCP scanner with improved navigation
  maxDepth?: number; // Maximum depth for website crawling
  headless?: boolean; // Whether to run browser in headless mode
  timeout?: number; // Timeout for scanning operations in milliseconds
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
 * Scans a website for content using browser automation
 *
 * @param url The URL to scan
 * @param options Scanning options
 * @returns A promise resolving to the scan results
 */
export async function scanWebsite(
  url: string,
  options?: ScannerOptions
): Promise<ScanResult> {
  // Choose the appropriate scanner implementation
  let result: WebsiteScanResult;

  if (options?.useEnhancedMcp) {
    // Use the enhanced MCP implementation with improved interaction capabilities
    console.log("Using enhanced MCP scanner with improved interactions");
    result = await scanWebsiteWithEnhancedMcp(url, {
      maxPages: options.maxPages,
      maxDepth: options.maxDepth,
      headless: options.headless !== false, // Default to true if not specified
      timeout: options.timeout,
    });
  } else if (options?.useDirectMcp) {
    // Use the direct MCP implementation (recommended for stability)
    console.log("Using direct MCP scanner");
    result = await scanWebsiteWithDirectMcp(url);
  } else if (options?.useMcp) {
    // Use the multi-turn MCP implementation
    console.log("Using multi-turn MCP scanner");
    result = await scanWebsiteWithMcp(url);
  } else {
    // Use the standard website scanner
    console.log("Using standard website scanner");
    result = await scanWebsiteInternal(url);
  }

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

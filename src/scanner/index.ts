import type { WebsiteContent, WebsiteScanResult } from "./website-scanner";
import type { CodeContent, CodebaseScanResult } from "./codebase-scanner";
import { scanWebsite as scanWebsiteInternal } from "./website-scanner";
import { scanCodebase as scanCodebaseInternal } from "./codebase-scanner";

export { WebsiteContent, WebsiteScanResult, CodeContent, CodebaseScanResult };

/**
 * Main interface for the scanner module
 */
export interface ScannerOptions {
  maxPages?: number;
  maxFiles?: number;
  includeHiddenContent?: boolean;
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
  const result = await scanWebsiteInternal(url);

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

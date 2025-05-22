/**
 * Advanced website scanner that uses Playwright to crawl and analyze websites
 */

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { loadConfig } from '../utils/config';

// Types
export interface ScanOptions {
  maxPages?: number;
  maxDepth?: number;
  headless?: boolean;
  timeout?: number;
  screenshotsDir?: string;
}

export interface PageContent {
  pageUrl: string;
  pageTitle: string;
  optimizableElements: OptimizableElement[];
}

export interface OptimizableElement {
  type: string;
  selector: string;
  content: string;
  location: string;
  importance: 'high' | 'medium' | 'low';
  optimizationPotential: 'high' | 'medium' | 'low';
  issue: string;
  recommendation: string;
}

export interface ScanResult {
  type: 'website';
  source: string;
  timestamp: number;
  data: {
    pages: PageContent[];
  };
}

/**
 * Scan a website using a recursive crawl approach
 */
export async function scanWebsiteAdvanced(
  url: string,
  options: ScanOptions = {}
): Promise<ScanResult> {
  const maxPages = options.maxPages || 3;
  const maxDepth = options.maxDepth || 2;
  const headless = options.headless !== false; // Default to true
  const timeout = options.timeout || 60000;
  const screenshotsDir = options.screenshotsDir || 'screenshots';
  
  console.log(`Starting scan of ${url} (max ${maxPages} pages, depth ${maxDepth})`);
  
  // Create screenshots directory if it doesn't exist
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
  
  // Get AI configuration
  const config = loadConfig();
  let model;
  
  if (!config) {
    throw new Error('Config not found. Run steelpush init first.');
  }
  
  if (config.ai.provider === 'anthropic') {
    if (!process.env.ANTHROPIC_API_KEY && !config.ai.apiKey) {
      throw new Error('ANTHROPIC_API_KEY not found in environment or config');
    }
    model = anthropic(config.ai.model || 'claude-3-7-sonnet-20250219');
    console.log('Using Anthropic model:', config.ai.model || 'claude-3-7-sonnet-20250219');
  } else {
    if (!process.env.OPENAI_API_KEY && !config.ai.apiKey) {
      throw new Error('OPENAI_API_KEY not found in environment or config');
    }
    model = openai(config.ai.model || 'gpt-4');
    console.log('Using OpenAI model:', config.ai.model || 'gpt-4');
  }
  
  // Initialize browser
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Keep track of visited pages
  const visitedUrls = new Set<string>();
  const pages: PageContent[] = [];
  
  /**
   * Helper function to take screenshot
   */
  async function takeScreenshot(page: any, name: string): Promise<string> {
    const screenshotPath = path.join(screenshotsDir, `${name}-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath });
    return screenshotPath;
  }
  
  /**
   * Analyze a webpage using AI
   */
  async function analyzeWebpage(
    url: string,
    html: string,
    title: string
  ): Promise<PageContent> {
    console.log(`\nAnalyzing page: ${title}`);
    
    try {
      // Create the prompt for the AI
      const prompt = `
        Analyze this webpage at ${url} for conversion optimization opportunities.

        URL: ${url}
        Title: ${title}
        
        I'll provide you with relevant parts of the HTML content to analyze.
        \`\`\`html
        ${html.substring(0, 20000)} ${html.length > 20000 ? '... (truncated)' : ''}
        \`\`\`

        You are an expert in website conversion rate optimization (CRO). Your task is to analyze this page
        and identify 3-5 specific elements that could be improved to increase conversions. Focus on:
        
        1. Headlines and value propositions
        2. Call to action buttons
        3. Forms and input fields
        4. Navigation and user flow
        5. Trust indicators and social proof
        
        For each element, provide:
        - Type (headline, CTA, form, etc.)
        - Selector (CSS selector or description of where to find it)
        - Content (the actual text)
        - Location on the page (header, middle section, footer, etc.)
        - Importance (high, medium, low)
        - Optimization potential (high, medium, low)
        - Specific issue with the current implementation
        - Recommendation for improvement
        
        Format your response as a JSON object like this:
        {
          "pageUrl": "${url}",
          "pageTitle": "${title}",
          "optimizableElements": [
            {
              "type": "headline",
              "selector": "h1.hero-title",
              "content": "Current headline text",
              "location": "Hero section",
              "importance": "high",
              "optimizationPotential": "medium",
              "issue": "Too technical, doesn't focus on benefits",
              "recommendation": "Change to benefit-oriented headline that addresses customer pain points"
            },
            // More elements...
          ]
        }
      `;

      // Generate analysis using AI model
      const completion = await generateText({
        model: model,
        messages: [
          { role: "user", content: prompt }
        ],
        temperature: 0.2,
      });

      // Get the response text
      let responseText;
      try {
        responseText = completion.toString();
      } catch (error) {
        responseText = completion.text || JSON.stringify(completion);
      }
      
      // Parse the response
      let analysisResult;
      try {
        // Try extracting JSON from code blocks
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          analysisResult = JSON.parse(jsonMatch[1].trim());
        } else {
          // Try parsing the whole response
          analysisResult = JSON.parse(responseText);
        }
      } catch (error) {
        console.log('Error parsing AI response as JSON, creating fallback structure');
        // Create fallback structure
        analysisResult = {
          pageUrl: url,
          pageTitle: title,
          optimizableElements: [{
            type: 'headline',
            selector: 'h1',
            content: title,
            location: 'Header',
            importance: 'high',
            optimizationPotential: 'medium',
            issue: 'Current headline may not clearly communicate unique value proposition',
            recommendation: 'Make the headline more benefit-focused and specific to target audience'
          }]
        };
      }
      
      return analysisResult;
    } catch (error) {
      console.error(`Error analyzing page: ${error.message}`);
      // Return minimal structure on error
      return {
        pageUrl: url,
        pageTitle: title,
        optimizableElements: [{
          type: 'error',
          selector: 'body',
          content: `Error analyzing: ${error.message}`,
          location: 'N/A',
          importance: 'medium',
          optimizationPotential: 'medium',
          issue: 'Failed to analyze page',
          recommendation: 'Try again or analyze manually'
        }]
      };
    }
  }
  
  /**
   * Process a page and its links recursively
   */
  async function processPage(pageUrl: string, depth = 0): Promise<void> {
    // Skip if already visited or max pages reached
    if (visitedUrls.has(pageUrl) || pages.length >= maxPages) {
      return;
    }
    
    // Add to visited URLs
    visitedUrls.add(pageUrl);
    
    // Navigate to the page
    console.log(`\nNavigating to page ${pages.length + 1}: ${pageUrl} (depth: ${depth})`);
    try {
      await page.goto(pageUrl, { timeout, waitUntil: 'networkidle' });
    } catch (error) {
      console.error(`Error navigating to ${pageUrl}: ${error.message}`);
      return;
    }
    
    const pageTitle = await page.title();
    console.log(`Page loaded: ${pageTitle}`);
    
    // Take initial screenshot
    const pageNumber = pages.length + 1;
    await takeScreenshot(page, `page-${pageNumber}-initial`);
    
    // Scroll through the page
    console.log('Scrolling through page...');
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      return new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 300;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve(true);
          }
        }, 100);
      });
    });
    
    // Take scrolled screenshot
    await takeScreenshot(page, `page-${pageNumber}-scrolled`);
    
    // Get the HTML content
    const html = await page.content();
    
    // Analyze the page
    const pageResult = await analyzeWebpage(pageUrl, html, pageTitle);
    
    // Add to pages collection
    pages.push(pageResult);
    
    // Take final screenshot
    await takeScreenshot(page, `page-${pageNumber}-final`);
    
    // Collect links if we're not at max depth
    if (depth < maxDepth && pages.length < maxPages) {
      console.log(`Collecting links from ${pageUrl}...`);
      
      // Get all links
      const links = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        return anchors.map(a => ({
          href: a.href,
          text: a.textContent.trim(),
          isNavigation: a.closest('nav, header') !== null
        }));
      });
      
      // Filter links to same domain
      const sameHostLinks = links.filter(link => {
        try {
          const linkUrl = new URL(link.href);
          const baseUrl = new URL(url);
          return linkUrl.hostname === baseUrl.hostname;
        } catch (e) {
          return false;
        }
      });
      
      // Prioritize navigation links
      const prioritizedLinks = [
        ...sameHostLinks.filter(link => link.isNavigation),
        ...sameHostLinks.filter(link => !link.isNavigation)
      ];
      
      // Get unique links
      const uniqueLinks = [...new Set(prioritizedLinks.map(link => link.href))];
      
      // Process links recursively
      for (const nextUrl of uniqueLinks) {
        if (visitedUrls.has(nextUrl) || pages.length >= maxPages) {
          continue;
        }
        
        // Skip fragment links
        if (nextUrl.includes('#')) {
          continue;
        }
        
        await processPage(nextUrl, depth + 1);
        
        if (pages.length >= maxPages) {
          break;
        }
      }
    }
  }
  
  try {
    // Start processing with the main URL
    await processPage(url);
    
    // Close the browser
    await browser.close();
    
    // Return the scan result
    return {
      type: 'website',
      source: url,
      timestamp: Date.now(),
      data: {
        pages
      }
    };
  } catch (error) {
    console.error(`Scan error: ${error.message}`);
    await browser.close();
    throw error;
  }
}
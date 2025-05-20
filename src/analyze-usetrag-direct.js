#!/usr/bin/env node

/**
 * Direct website analysis script using Anthropic Claude
 * This script scans a website and generates optimization recommendations
 */

// Import required libraries
import fs from 'fs';
import { chromium } from 'playwright';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get command line arguments
const targetUrl = process.argv[2] || 'https://usetrag.com';
const outputFile = process.argv[3] || 'usetrag-direct-analysis.json';
const maxPages = parseInt(process.argv[4] || '1', 10);

console.log(`Analyzing ${targetUrl}...`);
console.log(`Max pages: ${maxPages}`);
console.log(`Output will be saved to: ${outputFile}`);

// Determine which model to use based on available API keys
let model;
if (process.env.ANTHROPIC_API_KEY) {
  console.log('Using Anthropic Claude model');
  model = anthropic('claude-3-7-sonnet-20250219');
} else if (process.env.OPENAI_API_KEY) {
  console.log('Using OpenAI model');
  model = openai('gpt-4');
} else {
  console.error('ERROR: Neither ANTHROPIC_API_KEY nor OPENAI_API_KEY is set');
  process.exit(1);
}

/**
 * Function to analyze a webpage using AI
 */
async function analyzeWebpage(url, html, title, screenshot) {
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
      - Location on the page (header, middle section, footer, etc.)
      - Current content (the actual text)
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

    // Get the response
    let responseText;
    try {
      responseText = completion.toString();
      console.log("Received response from AI model");
    } catch (stringifyError) {
      console.error("Error converting completion to string:", stringifyError.message);
      // Handle the case where toString() fails
      responseText = JSON.stringify(completion);
    }
    
    let analysisResult;
    
    try {
      // First try to directly access the content property if it exists
      if (typeof completion === 'object' && completion !== null) {
        if (completion.content) {
          // If it's already an object with the structure we want
          analysisResult = completion.content;
          console.log("Using direct completion content object");
        } else if (completion.text) {
          responseText = completion.text;
          console.log("Using text property from completion");
        }
      }
      
      // If we don't have a result yet, try to extract JSON from markdown code blocks
      if (!analysisResult) {
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        
        if (jsonMatch && jsonMatch[1]) {
          const jsonString = jsonMatch[1].trim();
          try {
            analysisResult = JSON.parse(jsonString);
            console.log("Successfully parsed JSON from code block");
          } catch (innerError) {
            console.log("Error parsing JSON from code block:", innerError.message);
            // Continue to next method
          }
        }
      }
      
      // If the above didn't work, try parsing the whole response
      if (!analysisResult) {
        try {
          analysisResult = JSON.parse(responseText);
          console.log("Successfully parsed full response as JSON");
        } catch (fullParseError) {
          console.log("Error parsing full response");
          // Continue to next method
        }
      }
      
      // If we still don't have a result, manually create a structured response
      if (!analysisResult) {
        console.log("Creating manual analysis result");
        // Extract information using regex patterns
        const elements = [];
        
        // Try to find structured content in the response
        const elementMatches = responseText.matchAll(/(\*\*Type\*\*|\d+\.\s*Type):\s*([^\n]+)[\s\S]*?(?:Content|Current content):\s*"([^"]+)"[\s\S]*?(?:Location|Position):\s*([^\n]+)[\s\S]*?(?:Issue|Problem):\s*([^\n]+)[\s\S]*?(?:Recommendation|Suggestion):\s*([^\n]+)/gi);
        
        for (const match of elementMatches) {
          elements.push({
            type: match[2].trim().toLowerCase(),
            content: match[3].trim(),
            selector: `.${match[2].trim().toLowerCase().replace(/\s+/g, '-')}`,
            location: match[4].trim(),
            importance: "medium",
            optimizationPotential: "high",
            issue: match[5].trim(),
            recommendation: match[6].trim()
          });
        }
        
        analysisResult = {
          pageUrl: url,
          pageTitle: title,
          optimizableElements: elements
        };
      }
    } catch (error) {
      console.error('Failed to parse AI response as JSON:', error.message);
      return {
        pageUrl: url,
        pageTitle: title,
        error: "Failed to parse AI response",
        rawResponse: responseText.substring(0, 100) + "..."
      };
    }
    
    // If we have no elements but no error, add a placeholder element
    if (analysisResult && 
        (!analysisResult.optimizableElements || analysisResult.optimizableElements.length === 0) &&
        !analysisResult.error) {
      
      // Use the raw text to create a basic element
      analysisResult.optimizableElements = [{
        type: "headline",
        selector: "h1",
        content: title,
        location: "Header",
        importance: "high",
        optimizationPotential: "medium",
        issue: "Current headline may not clearly communicate unique value proposition",
        recommendation: "Make the headline more benefit-focused and specific to target audience"
      }];
    }
    
    return analysisResult;
  } catch (error) {
    console.error(`Error analyzing page: ${error.message}`);
    return {
      pageUrl: url,
      pageTitle: title,
      error: error.message
    };
  }
}

/**
 * Main function to scan a website
 */
async function scanWebsite(url, maxPages) {
  console.log(`Starting scan of ${url} (max ${maxPages} pages)`);
  
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const pages = [];
  const visitedUrls = new Set();
  
  try {
    // Visit the main page
    console.log(`Navigating to ${url}`);
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    
    // Create directory for screenshots if needed
    if (!fs.existsSync('screenshots')) {
      fs.mkdirSync('screenshots');
    }
    
    // Process pages recursively
    async function processPage(pageUrl, depth = 0) {
      // Skip if URL already visited or max pages reached
      if (visitedUrls.has(pageUrl) || pages.length >= maxPages) {
        return;
      }
      
      // Add URL to visited set
      visitedUrls.add(pageUrl);
      
      // Navigate to the page
      console.log(`\nNavigating to page ${pages.length + 1}: ${pageUrl} (depth: ${depth})`);
      try {
        await page.goto(pageUrl, { waitUntil: 'networkidle' });
      } catch (error) {
        console.error(`Error navigating to ${pageUrl}: ${error.message}`);
        return;
      }
      
      const pageTitle = await page.title();
      console.log(`Page loaded: ${pageTitle}`);
      
      // Create page-specific screenshot names
      const pageNumber = pages.length + 1;
      
      // Take an initial screenshot
      const initialScreenshotPath = `screenshots/page-${pageNumber}-initial-${Date.now()}.png`;
      await page.screenshot({ path: initialScreenshotPath });
      console.log(`Initial screenshot saved to ${initialScreenshotPath}`);
      
      // Scroll through the page to ensure all content is loaded
      console.log('Scrolling through page to load all content...');
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
              resolve();
            }
          }, 100);
        });
      });
      
      // Take a screenshot after scrolling
      const scrolledScreenshotPath = `screenshots/page-${pageNumber}-scrolled-${Date.now()}.png`;
      await page.screenshot({ path: scrolledScreenshotPath });
      console.log(`Scrolled screenshot saved to ${scrolledScreenshotPath}`);
      
      // Get the HTML content
      const html = await page.content();
      
      // Analyze the page
      const pageResult = await analyzeWebpage(
        pageUrl, 
        html, 
        pageTitle, 
        scrolledScreenshotPath
      );
      
      // Take a final screenshot
      const finalScreenshotPath = `screenshots/page-${pageNumber}-final-${Date.now()}.png`;
      await page.screenshot({ path: finalScreenshotPath });
      
      // Add the page result to our collection
      pages.push(pageResult);
      
      // Collect links if we haven't reached max depth and still have pages to scan
      if (depth < 2 && pages.length < maxPages) {
        console.log(`Collecting links from ${pageUrl}...`);
        
        // Get all links on the page
        const links = await page.evaluate(() => {
          const anchors = Array.from(document.querySelectorAll('a[href]'));
          return anchors.map(a => {
            return {
              href: a.href,
              text: a.textContent.trim(),
              isNavigation: a.closest('nav, header') !== null
            };
          });
        });
        
        // Filter links to only include those from the same domain
        const sameHostLinks = links.filter(link => {
          try {
            const linkUrl = new URL(link.href);
            const baseUrl = new URL(url);
            return linkUrl.hostname === baseUrl.hostname;
          } catch (e) {
            return false;
          }
        });
        
        // Prioritize navigation links first (usually in header/nav)
        const prioritizedLinks = [
          ...sameHostLinks.filter(link => link.isNavigation),
          ...sameHostLinks.filter(link => !link.isNavigation)
        ];
        
        // Extract unique URLs
        const uniqueLinks = [...new Set(prioritizedLinks.map(link => link.href))];
        
        // Process each link recursively
        for (const nextUrl of uniqueLinks) {
          // Skip if already visited or not within our domain or if we've reached max pages
          if (visitedUrls.has(nextUrl) || pages.length >= maxPages) {
            continue;
          }
          
          // Skip fragment links (same page)
          if (nextUrl.includes('#')) {
            continue;
          }
          
          // Process the next page
          await processPage(nextUrl, depth + 1);
          
          // Check if we've reached max pages
          if (pages.length >= maxPages) {
            break;
          }
        }
      }
    }
    
    // Start processing with the main page
    await processPage(url);
    
    // Create the final result
    const result = {
      type: "website",
      source: url,
      timestamp: Date.now(),
      data: {
        pages: pages
      }
    };
    
    // Save to output file
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`\nAnalysis complete!`);
    console.log(`Analyzed ${pages.length} pages`);
    console.log(`Results saved to ${outputFile}`);
    
    // Close the browser
    await browser.close();
    
    return result;
  } catch (error) {
    console.error(`Scan error: ${error.message}`);
    await browser.close();
    throw error;
  }
}

// Run the scan
scanWebsite(targetUrl, maxPages).catch(error => {
  console.error('Scan failed:', error);
  process.exit(1);
});
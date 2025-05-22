# Model Context Protocol (MCP) Integration

## Overview

Steelpush uses the Model Context Protocol (MCP) to enable AI agents to directly control web browsers for advanced website analysis. This integration allows the AI to perform complex interactions similar to how a human would navigate a website.

## MCP Scanner Variants

Steelpush provides four MCP scanner variants, each with different capabilities and use cases:

### 1. Mini MCP Scanner (Recommended)

**Command:** `npm run dev:scan:mini`

**Features:**
- Single-page focused analysis
- Streamlined, reliable browser automation
- Simplified scrolling behavior
- Robust error handling and timeouts
- Support for faster, more efficient AI models
- Automatic fallback content extraction

**Use When:**
- You need quick, reliable analysis of a single page
- You want fastest possible analysis time
- You're experiencing issues with other scanners
- You want the most stable experience

### 2. Enhanced MCP Scanner

**Command:** `npm run dev:scan:enhanced`

**Features:**
- Multi-page navigation with breadth-first exploration
- Deep scrolling with content observation
- Form interaction and validation
- Click-based exploration and navigation
- Element extraction and analysis
- Structured data processing
- Screenshot capture for visual reference

**Use When:**
- You need thorough analysis of complex websites
- You want to explore multiple pages of a site
- You need detailed interaction with forms and UI elements
- You want to see screenshots of the analysis process

### 3. Direct MCP Scanner

**Command:** `npm run dev:scan:direct`

**Features:**
- Single-page analysis
- Direct browser control
- Simple scrolling behavior
- Snapshot-based analysis
- Less conversational, more direct approach

**Use When:**
- You want quick analysis of a single page
- You need stable, predictable behavior
- You're experiencing issues with more complex scanners

### 4. Multi-turn MCP Scanner

**Command:** `npm run dev:scan:mcp`

**Features:**
- Conversational multi-turn exploration
- Sequential page analysis
- Stateful conversation with AI agent
- Deeper turn-by-turn analysis

**Use When:**
- You want a more thorough, iterative analysis
- You're analyzing complex sites with multiple sections

## How MCP Works

The Model Context Protocol enables LLMs to:

1. **Observe the environment** - The AI can see what's on the screen via screenshots and DOM structures
2. **Plan interactions** - The AI can reason about what to do next based on what it observes
3. **Take actions** - The AI can directly control the browser using specialized tools
4. **Evaluate results** - The AI can see the results of its actions and adapt accordingly

## MCP Tool Capabilities

The MCP integration gives the AI agent access to these browser control tools:

- `browser_navigate`: Navigate to a specific URL
- `browser_extract_text`: Extract text from specific elements
- `browser_click`: Click on a specific element
- `browser_scroll_down/up`: Scroll the page to see more content
- `browser_take_screenshot`: Capture the current page state
- `browser_back`: Go back to the previous page
- `browser_extract_links`: Extract links from the page

## Setup Requirements

To use the MCP scanners, you need:

1. Node.js 18+ with npm or pnpm installed
2. Playwright installed (`npm install playwright`)
3. An OpenAI or Anthropic API key (set in `.env` or provide when prompted)

## Troubleshooting

If you encounter issues with MCP scanning:

1. **Check API Keys**: Ensure your API key is valid and has sufficient credits
2. **Check Network**: Ensure you have a stable internet connection
3. **Try Different Scanners**: If one scanner fails, try another variant
4. **Check NPX Installation**: The scanners use npx to run MCP servers
5. **Review Logs**: Check the logs in the `screenshots` directory
6. **Verify URLs**: Make sure you're scanning accessible URLs

## Output

MCP scanners produce these outputs:

1. A JSON file with analysis results
2. Screenshots in the `screenshots` directory showing the analysis process
3. Log files with detailed information about the scan

## Examples

### Basic Usage

```bash
# Run the enhanced scanner on a specific URL
npm run dev:scan:enhanced https://example.com
```

### Viewing Results

After scanning, Steelpush will print a summary to the console and save full results to a JSON file. You can use this file with other Steelpush tools to generate content variants or simulate conversions.
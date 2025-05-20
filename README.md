# Steelpush: AI-Powered Website Content Optimization

Steelpush analyzes websites for conversion optimization opportunities, generates content variants, and provides recommendations to improve engagement, conversion rates, and overall user experience.

## Features

- **Website Analysis**: Scan websites to find content optimization opportunities
- **Content Generation**: Create variants of existing content using AI
- **Performance Evaluation**: Test content variants against each other to determine effectiveness
- **Recommendations**: Get AI-powered recommendations for improvement
- **Conversion Simulation**: Simulate how content variants might perform with different user personas

## Getting Started

### Prerequisites

- Node.js 18+
- TypeScript
- An OpenAI or Anthropic API key

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with your API keys:
   ```
   OPENAI_API_KEY=your-api-key-here
   ```

## Quick Demo

To quickly test the functionality without scanning a live site, use these scripts:

```bash
# Generate mock website analysis with content variants
./generate-mock-variants.sh

# Simulate conversion rates for the variants
./simulate-conversions.sh
```

This will:
1. Use mock website analysis data
2. Generate content variants using AI
3. Simulate how different variants might affect conversion rates
4. Provide recommendations on which variants are most likely to improve conversions

## Usage

### Website Analysis

Steelpush offers multiple analysis engines to scan websites for optimization opportunities:

#### Standard Analysis
```bash
npm run dev:scan
```

#### Mini MCP Analysis (Recommended)
```bash
npm run dev:scan:mini
```
A streamlined, fast and reliable scanner with focused analysis:
- Single-page deep analysis
- Reliable browser automation
- Faster model options
- Robust error handling and timeouts
- Screenshot capture and automatic fallbacks

#### Enhanced MCP Analysis
```bash
npm run dev:scan:enhanced
```
Our most advanced scanner with improved web interaction capabilities:
- Multi-page navigation with automatic link discovery
- Deep scrolling and content analysis
- Form interaction and validation
- Screenshot capture for visual analysis

#### Direct MCP Analysis
```bash
npm run dev:scan:direct
```

#### Multi-turn MCP Analysis
```bash
npm run dev:scan:mcp
```

See [MCP Integration Documentation](docs/MCP-INTEGRATION.md) for detailed information about all MCP scanner variants.

All analysis methods will:
1. Prompt for an API key if not set (OpenAI or Anthropic)
2. Load a browser to analyze the target website
3. Use AI to identify content that could be improved
4. Generate a report with recommendations

### Content Variant Generation

To generate variants for content:

```bash
npx ts-node --esm src/generate-variants.ts <analysis-file.json>
```

This takes the output from the analysis step and generates alternative content for each item.

### Conversion Simulation

To simulate conversion rates with different variants:

```bash
npx ts-node --esm src/simulator/simulate-conversions.ts <variants-file.json>
```

This simulates how different content variants might perform with different user personas, helping you select the best variants to implement.

### Source Code Analysis

Steelpush can also analyze source code repositories for marketing content:

```bash
npm run dev:source analyze <directory-path>
```

This will:
1. Scan all relevant source files in the directory
2. Find marketing content in code, strings, and data files
3. Generate a report of all marketing content detected
4. Support multiple output formats (markdown, JSON, CSV)

You can choose output format:
```bash
npm run dev:source analyze <directory-path> --format markdown
```

## Project Structure

- `src/` - Source code
  - `analyzer/` - Content and code analysis tools
    - `website-analyzer.ts` - Analyzes websites for marketing content
    - `source-code-analyzer.ts` - Analyzes source code for marketing content
  - `browser/` - Browser automation utilities
  - `scanner/` - Website and codebase scanning
    - `website-scanner.ts` - Standard website scanner
    - `direct-mcp-scanner.ts` - Simplified MCP scanner
    - `mcp-website-scanner.ts` - Multi-turn MCP scanner
    - `enhanced-mcp-scanner.ts` - Advanced MCP scanner with improved navigation
    - `codebase-scanner.ts` - Scanner for source code repositories
  - `simulator/` - Traffic simulation tools
  - `generators/` - Content generation utilities
  - `exporter/` - Export formats and templates
  - `core/` - Shared utilities and types
  - `cli-source-analyzer.ts` - CLI for source code analysis

## Output Examples

Steelpush generates several output files:

- `mock-website-analysis.json` - Initial website analysis with optimization recommendations
- `website-variants.json` - Generated content variants for each optimization opportunity
- `website-conversion-simulation.json` - Simulation results showing estimated conversion improvements

## License

MIT

## Acknowledgements

This project uses several open-source technologies:
- Mastra for AI agents
- Playwright for browser automation
- OpenAI/Anthropic for AI capabilities

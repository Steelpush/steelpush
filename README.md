<div align="center" style="margin-bottom: 20px">
  <img src="steelpush_emblem.png" alt="Steelpush Logo" width="100" />
</div>

# Steelpush

A CLI tool for programmatic website conversion optimization. Steelpush automates the process of identifying, evaluating, and generating optimized website content through structured analysis and approval workflows.

## What it does

Steelpush provides a command-line interface for:

1. **Website scanning** - Analyzes web pages to identify optimization opportunities
2. **Human approval workflow** - Interactive review of identified opportunities  
3. **Content generation** - Produces optimized variants for approved opportunities

The tool outputs structured JSON data that follows a defined schema, making it suitable for integration into existing development and optimization workflows.

## Architecture

### Core Components

- **Scanner modules** (`src/scanner/`) - Website analysis engines using browser automation
- **Format converter** (`src/utils/format-converter.ts`) - Normalizes scan results to REQ format
- **CLI commands** (`src/commands/`) - Command implementations for analyze, approve, generate
- **Export system** (`src/exporter/`) - Multiple output formats (JSON, Markdown, CSV)

### Data Flow

```
Website URL → Scanner → Raw Results → Format Converter → REQ JSON → Human Approval → Content Generation
```

### REQ Format Schema

Each optimization opportunity contains:

```json
{
  "id": "opp_001",
  "element_type": "headline|cta_button|cta_link|form_element|text_content|testimonial|pricing_element|nav_element",
  "original_content": "string",
  "element_selector": "string",
  "context_description": "string", 
  "optimization_reasoning": "string",
  "confidence_score": 0.85,
  "approved": null|true|false
}
```

**Note:** Precise element targeting is currently basic. A browser extension for accurate element selection will be available soon.

## Installation

```bash
npm install -g steelpush
steelpush init
```

Requires Node.js 16+ and either OpenAI or Anthropic API credentials.

## Usage

### 1. Analyze a website

```bash
steelpush analyze https://example.com
```

Outputs:
- `steelpush-analysis-[timestamp].json` - Full scan results
- `steelpush-analysis-[timestamp]-req-format.json` - REQ format for approval workflow

Options:
- `--max-pages <number>` - Pages to scan (default: 3)
- `--max-depth <number>` - Link crawl depth (default: 2)  
- `--format <json|markdown|csv>` - Output format
- `--output <path>` - Custom output file
- `--screenshots <dir>` - Screenshot directory

### 2. Review and approve opportunities

```bash
steelpush approve steelpush-analysis-[timestamp]-req-format.json
```

Interactive CLI for reviewing each opportunity:
- Shows original content and optimization reasoning
- Prompts for approve/reject/skip decision
- Updates the JSON file with approval status

### 3. Generate optimized content

```bash
steelpush generate steelpush-analysis-[timestamp]-req-format.json
```

Processes only approved opportunities and outputs optimized content variants.

## Scanner Implementations

### Direct MCP Scanner (`direct-mcp-scanner.ts`)

Uses Model Context Protocol (MCP) with browser automation:
- Takes screenshots of target pages
- Sends visual context to LLM via MCP tools
- Extracts structured optimization opportunities
- Supports OpenAI and Anthropic models

### Advanced Scanner (`advanced-scanner.ts`)

DOM-based analysis with multiple strategies:
- Crawls site structure
- Extracts text content and metadata
- Applies heuristic analysis for optimization opportunities
- Faster but less context-aware than MCP scanner

## Content Generation

The generate command creates optimized variants for identified opportunities. Current capabilities include:

- **Content optimization**: Headlines, CTAs, form labels, and body text
- **Messaging refinement**: Value propositions and benefit-focused language
- **User experience improvements**: Friction reduction and clarity enhancements

**Future optimization opportunities:**
- **Pricing strategies**: A/B testing different price points and packaging
- **Product positioning**: Feature emphasis and competitive differentiation  
- **Modal and popup content**: Exit-intent offers and engagement flows
- **Navigation and information architecture**: Menu structure and user paths
- **Social proof elements**: Testimonials, reviews, and trust indicators
- **Conversion funnels**: Multi-step form optimization and checkout flows

Generation uses rule-based logic and can be extended with API-based LLM calls for more sophisticated optimization strategies.

**Implementation:** Currently requires manual element identification. A browser extension for precise element targeting and automated implementation will be available soon.

## Configuration

Config stored in `.steelpush/config.json`:

```json
{
  "apiKey": "your-api-key",
  "provider": "anthropic|openai",
  "defaultModel": "claude-opus-4-20250514|gpt-4",
  "screenshotsDir": "screenshots"
}
```

## Integration

### CI/CD Integration

```bash
# In build pipeline
steelpush analyze $STAGING_URL --format json --output analysis.json
steelpush generate analysis.json --output optimizations.json

# Process results programmatically
node process-optimizations.js optimizations.json
```

### Programmatic Usage

```javascript
import { convertToREQFormat } from './src/utils/format-converter.js';
import { scanWebsiteAdvanced } from './src/scanner/advanced-scanner.js';

const result = await scanWebsiteAdvanced('https://example.com');
const reqFormat = convertToREQFormat(result);
// Process reqFormat.opportunities array
// Note: Element selectors may require manual refinement for precise targeting
```

## Development

```bash
git clone https://github.com/yourusername/steelpush.git
cd steelpush
pnpm install

# Run in development
pnpm dev

# Build for production  
pnpm build

# Run tests
pnpm test
```

### File Structure

```
src/
├── cli/           # CLI entry point and argument parsing
├── commands/      # Command implementations (analyze, approve, generate)
├── scanner/       # Website analysis engines
├── utils/         # Format conversion and utilities
├── exporter/      # Output format handlers
└── types/         # TypeScript type definitions
```

### Adding New Scanners

Implement the `WebsiteScanner` interface:

```typescript
interface WebsiteScanner {
  scan(url: string, options?: ScanOptions): Promise<WebsiteScanResult>;
}
```

The format converter handles normalization to REQ format automatically.

## Dependencies

Core dependencies:
- `playwright` - Browser automation for scanning
- `commander` - CLI framework
- `inquirer` - Interactive prompts for approval workflow

The tool is designed to work offline after initial setup, with optional API calls for enhanced content generation.

## License

MIT

---

Built with [Anthropic's Claude](https://anthropic.com) and [Playwright](https://playwright.dev)

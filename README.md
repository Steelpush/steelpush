<h1 align="center">Steelpush</h1>

<p align="center">
  <strong>Website content scanner and source code analysis utility</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#website-analysis">Website Analysis</a> •
  <a href="#source-code-analysis">Source Code Analysis</a> •
  <a href="#examples">Examples</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#license">License</a>
</p>

---

## Introduction

Steelpush is a command-line utility for scanning websites and source code repositories to locate, categorize, and analyze content. It helps developers find and classify text content across websites and codebases.

Built with [Mastra](https://github.com/mastraai/mastra) and [Model Context Protocol (MCP)](https://github.com/mastraai/mcp), Steelpush automates the process of finding and organizing content across different types of files and web pages.

## Features

### Website Analysis

- **Content Scanning**: Crawl websites and extract text content
- **Pattern Identification**: Find recurring content patterns in websites
- **Content Variations**: Generate alternative text content
- **User Simulation**: Test user flows with automated browsers
- **MCP Support**: Use Model Context Protocol for advanced browser automation
- **Reports**: Export findings in structured formats

### Source Code Analysis

- **Content Location**: Find text content within source code
- **Content Mapping**: Create maps of where content appears in codebases
- **Content Categorization**: Organize content by type (headings, buttons, etc.)
- **Report Generation**: Create structured reports in multiple formats
- **Localization Analysis**: Scan translation files and compare content

## Installation

### Prerequisites

- Node.js 18.x or higher
- npm, yarn, or pnpm
- OpenAI API key or Anthropic API key for MCP features

### Global Installation

```bash
# Using npm
npm install -g steelpush

# Using yarn
yarn global add steelpush

# Using pnpm
pnpm add -g steelpush
```

### Local Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/steelpush.git
cd steelpush

# Install dependencies
pnpm install

# Build the project
pnpm build

# Set up environment variables
cp .env.example .env
# Edit .env and add your API keys
```

## Configuration

Create a `.env` file in the root of your project with the following variables:

```env
# Choose one or both API keys depending on features you need
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

Optional configuration:

```env
# Model configuration
MODEL_NAME=gpt-4-turbo  # Default model for OpenAI
ANTHROPIC_MODEL=claude-3-opus-20240229  # Default model for Anthropic
TEMPERATURE=0.2  # Temperature setting

# Analysis settings
CHUNK_SIZE=4000  # Size of text chunks for analysis
CHUNK_OVERLAP=200  # Overlap between chunks
```

## Usage

Steelpush consists of multiple command-line tools:

- `steelpush` - For website content analysis
- `steelpush-source` - For source code content analysis

### Testing Scripts

For development and testing, the repository includes several test scripts:

```bash
# Test the scanner with interactive prompts
pnpm dev

# Test source code analyzer
pnpm dev:source

# Run MCP-based analysis on a specific website
npx tsx src/analyze-usetrag-mcp.ts

# Run standard analysis on a specific website
npx tsx src/analyze-usetrag.ts
```

### Website Analysis

Commands for website content analysis:

```bash
# Initialize steelpush (first time only)
steelpush init

# Analyze a website (standard mode)
steelpush analyze https://example.com

# Analyze a website with MCP
steelpush analyze https://example.com --use-mcp

# Generate content alternatives
steelpush generate

# Run automated user flows
steelpush simulate --visitors 10 --personas 3

# Export analysis results
steelpush export --format json
```

### Source Code Analysis

Commands for codebase content analysis:

```bash
# Analyze a project directory
steelpush-source analyze ./my-project

# Generate a detailed report
steelpush-source report --type detailed --format markdown --output content-report.md
```

## MCP Integration

Steelpush supports the [Model Context Protocol (MCP)](https://github.com/mastraai/mcp) for advanced browser automation. MCP allows the scanner to use autonomous navigation and content extraction with direct browser control.

When using MCP features:

1. You need an Anthropic API key (Claude models are recommended)
2. The system will automatically install and use the required MCP servers
3. Analysis will be more thorough but may take longer to complete

```bash
# Run MCP-based analysis
npx tsx src/analyze-usetrag-mcp.ts
```

## Examples

### Website Analysis Example

```bash
# Analyze a website
steelpush analyze https://example.com
```

Output:

```json
{
  "locations": [
    {
      "file": "index.html",
      "type": "component",
      "content": "Our product helps businesses grow",
      "context": "<h1>Our product helps businesses grow</h1>",
      "lineNumber": 42
    },
    // Additional content locations
  ],
  "patterns": [
    {
      "type": "heading_structure",
      "description": "Main headings focus on business growth",
      "examples": [
        "Our product helps businesses grow",
        "See measurable results"
      ]
    },
    // Additional patterns
  ]
}
```

### Source Code Analysis Example

```bash
# Analyze source code content
steelpush-source analyze ./my-project
```

Output:

```json
{
  "marketingContent": [
    {
      "file": "en.json",
      "path": "src/locales/en.json",
      "content": "Welcome to Our Product",
      "type": "heading",
      "context": "homepage.title",
      "lineNumber": 3
    },
    // Additional content items
  ],
  "fileMap": [
    {
      "path": "src/locales/en.json",
      "type": "JSON",
      "hasMarketingContent": true
    },
    // Additional files
  ]
}
```

## Integration with Development Workflow

Steelpush can be added to development workflows in several ways:

### CI/CD Integration

Add to GitHub Actions workflow:

```yaml
name: Content Analysis

on:
  pull_request:
    branches: [ main ]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install -g steelpush
      - run: steelpush-source analyze . --output json > content-analysis.json
      - uses: actions/upload-artifact@v3
        with:
          name: content-analysis
          path: content-analysis.json
```

### Pre-commit Hook

Add a pre-commit hook to scan for content before committing:

```bash
#!/bin/sh
# .git/hooks/pre-commit

steelpush-source analyze . --fast
```

## Development

```bash
# Run in development mode (test scanner)
pnpm dev

# Run source analyzer in development mode
pnpm dev:source

# Test MCP scanning
npx tsx src/analyze-usetrag-mcp.ts

# Lint the codebase
pnpm lint

# Format code
pnpm format
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -m 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Dependencies

- [Mastra](https://github.com/mastraai/mastra) - Agent framework
- [MCP](https://github.com/mastraai/mcp) - Model Context Protocol
- [Playwright](https://playwright.dev/) - Browser automation
- [OpenAI](https://openai.com/) - Text processing models
- [Anthropic](https://anthropic.com/) - Claude models for MCP
- [Commander.js](https://github.com/tj/commander.js/) - Command-line interface
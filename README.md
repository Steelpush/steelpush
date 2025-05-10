# Steelpush

<p align="center">
  <img src="https://via.placeholder.com/200x200?text=Steelpush" alt="Steelpush Logo" width="200" />
</p>

<p align="center">
  <strong>An AI-powered website optimization and source code analysis tool.</strong>
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

## 🚀 Introduction

Steelpush is a powerful tool that leverages AI to optimize websites and analyze source code for marketing content. It helps developers and marketers identify, analyze, and improve content across their digital properties.

Built with [Mastra](https://github.com/mastraai/mastra), Steelpush provides intelligent analysis of web content and codebase, generating actionable insights and optimization recommendations.

## ✨ Features

### Website Analysis

- 🔍 **Content Analysis**: Crawl websites and analyze content elements
- 🧠 **Pattern Recognition**: Identify content patterns and structures
- 🔄 **Content Variants**: Generate optimized content alternatives
- 👥 **Traffic Simulation**: Simulate user interactions with AI agents
- 📊 **Recommendations**: Get actionable optimization suggestions

### Source Code Analysis

- 📝 **Marketing Content Detection**: Find marketing copy in your codebase
- 🗺️ **Content Mapping**: Generate a map of marketing content locations
- 🏷️ **Content Classification**: Categorize content by type (headings, CTAs, etc.)
- 📄 **Detailed Reports**: Generate comprehensive reports in multiple formats
- 🌐 **Localization Support**: Analyze translation files for marketing content

## 📦 Installation

### Prerequisites

- Node.js 18.x or higher
- npm, yarn, or pnpm
- An OpenAI API key for AI functionality

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
# Edit .env and add your OpenAI API key
```

## 🔧 Configuration

Create a `.env` file in the root of your project with the following variables:

```env
OPENAI_API_KEY=your_openai_api_key
```

Optional configuration:

```env
# Model configuration
MODEL_NAME=gpt-4-turbo  # Default model to use
TEMPERATURE=0.2         # Temperature setting for AI responses

# Analysis settings
CHUNK_SIZE=4000         # Size of text chunks for analysis
CHUNK_OVERLAP=200       # Overlap between chunks
```

## 📖 Usage

Steelpush provides two main command-line tools:

- `steelpush` - For website analysis and optimization
- `steelpush-source` - For source code marketing content analysis

### Website Analysis

Analyze a website for optimization opportunities:

```bash
# Initialize steelpush (first time only)
steelpush init

# Analyze a website
steelpush analyze https://example.com

# Generate content variants
steelpush generate

# Simulate traffic
steelpush simulate --visitors 10 --personas 3

# Export optimization recommendations
steelpush export --format json
```

### Source Code Analysis

Analyze your codebase for marketing content:

```bash
# Analyze a project directory
steelpush-source analyze ./my-project

# Generate a detailed report
steelpush-source report --type detailed --format markdown --output marketing-report.md
```

## 📋 Examples

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
      "content": "Transform your business with our cutting-edge solution",
      "context": "<h1>Transform your business with our cutting-edge solution</h1>",
      "lineNumber": 42
    },
    // More content locations...
  ],
  "patterns": [
    {
      "type": "heading_structure",
      "description": "Main headings focus on transformation and results",
      "examples": [
        "Transform your business with our cutting-edge solution",
        "See real results in half the time"
      ]
    },
    // More patterns...
  ],
  "recommendations": [
    {
      "type": "headline_optimization",
      "description": "Use more specific numbers in headlines to increase credibility",
      "priority": "high"
    },
    // More recommendations...
  ]
}
```

### Source Code Analysis Example

```bash
# Analyze source code for marketing content
steelpush-source analyze ./my-project
```

Output:

```json
{
  "marketingContent": [
    {
      "file": "en.json",
      "path": "src/locales/en.json",
      "content": "Welcome to Our Amazing Product",
      "type": "heading",
      "context": "homepage.title",
      "lineNumber": 3
    },
    {
      "file": "Header.tsx",
      "path": "src/components/Header.tsx",
      "content": "Empower Your Business with Cutting-Edge Technology",
      "type": "heading",
      "context": "<h2>Empower Your Business with Cutting-Edge Technology</h2>",
      "lineNumber": 27
    },
    // More marketing content items...
  ],
  "fileMap": [
    {
      "path": "src/locales/en.json",
      "type": "JSON",
      "hasMarketingContent": true
    },
    {
      "path": "src/components/Header.tsx",
      "type": "React TypeScript",
      "hasMarketingContent": true
    },
    // More files...
  ]
}
```

## 🧩 Integration with Development Workflow

Steelpush can be integrated into your development workflow in several ways:

### CI/CD Integration

Add to your GitHub Actions workflow:

```yaml
name: Marketing Content Analysis

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
      - run: steelpush-source analyze . --output json > marketing-analysis.json
      - uses: actions/upload-artifact@v3
        with:
          name: marketing-analysis
          path: marketing-analysis.json
```

### Pre-commit Hook

Add a pre-commit hook to analyze marketing content before committing:

```bash
#!/bin/sh
# .git/hooks/pre-commit

steelpush-source analyze . --fast
```

## 📝 Development

```bash
# Run in development mode
pnpm dev

# Run source analyzer in development mode
pnpm dev:source

# Lint the codebase
pnpm lint

# Format code
pnpm format
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgements

- [Mastra](https://github.com/mastraai/mastra) - AI agent framework
- [Playwright](https://playwright.dev/) - Browser automation
- [OpenAI](https://openai.com/) - AI models
- [Commander.js](https://github.com/tj/commander.js/) - Command-line interface
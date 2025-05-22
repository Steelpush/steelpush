# Steelpush: AI Growth Engineer

Steelpush is an open-source tool that uses AI agents to analyze websites, generate content variants, 
simulate user behavior, and provide optimization recommendations - all without requiring backend infrastructure.

## Features

- 🔍 **Website Analysis**: AI-powered scanning of websites to identify optimization opportunities
- ✍️ **Content Generation**: Create compelling variants for headlines, CTAs, and other content elements
- 🧪 **User Simulation**: Simulate visitor behavior with different personas
- 📊 **Results Analysis**: Data-driven optimization recommendations with confidence scores
- 🚀 **Export Tools**: Generate implementation code for your website improvements

## Installation

```bash
# Install the package
npm install -g steelpush

# Initialize with your API key
steelpush init
```

## Usage

### Analyze a Website

```bash
# Basic analysis
steelpush analyze https://example.com

# With options
steelpush analyze https://example.com --max-pages 5 --format markdown --output analysis.md
```

### Generate Content Variants

```bash
# Generate variants from analysis
steelpush generate --input analysis.json
```

### Simulate User Behavior

```bash
# Run simulation on variants
steelpush simulate --input variants.json
```

### View Results

```bash
# Get optimization recommendations
steelpush results --input simulation.json
```

### Export Implementation

```bash
# Export implementation code
steelpush export --input results.json --format code
```

## Requirements

- Node.js 16+
- Either an OpenAI API key or an Anthropic API key

## Configuration

Steelpush supports both OpenAI and Anthropic Claude models. By default, it uses Anthropic's Claude.

```bash
# Configure with OpenAI
steelpush init --provider openai --api-key YOUR_API_KEY

# Configure with Anthropic (default)
steelpush init --provider anthropic --api-key YOUR_API_KEY
```

## Development

```bash
# Clone the repository
git clone https://github.com/yourusername/steelpush.git
cd steelpush

# Install dependencies
npm install

# Build the project
npm run build

# Run the CLI
npm start
```

## License

MIT

---

Built with [Anthropic's Claude](https://anthropic.com) and [Playwright](https://playwright.dev)

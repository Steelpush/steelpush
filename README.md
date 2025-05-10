# SteelPush

AI-powered website optimization and source code analysis tool.

## Installation

```bash
npm install -g steelpush
# or
yarn global add steelpush
# or
pnpm add -g steelpush
```

## Features

### Website Analysis

- Analyze websites for optimization opportunities
- Generate content variants for optimizable elements
- Simulate traffic with AI agents
- Export optimization recommendations

### Source Code Analysis

- Analyze source code for marketing content
- Generate a map of files with marketing content
- Identify various types of marketing content (headings, CTAs, features, etc.)
- Create detailed reports in different formats

## Usage

### Website Analysis

```bash
# Analyze a website
steelpush analyze https://example.com

# Generate content variants
steelpush generate

# Simulate traffic
steelpush simulate --visitors 10

# Export recommendations
steelpush export --format json
```

### Source Code Analysis

```bash
# Analyze a codebase for marketing content
steelpush-source analyze ./my-project

# Generate a report
steelpush-source report --type detailed --format markdown --output marketing-report.md
```

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run in development mode
pnpm dev

# Run source analyzer in development mode
pnpm dev:source
```

## License

MIT
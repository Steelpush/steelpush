# Steelpush: Open Source AI Growth Engineer

## Product Overview
Steelpush is an open-source tool that uses AI agents to analyze websites, generate content variants, simulate user behavior, and provide optimization recommendations - all without requiring backend infrastructure.

## Core Value Proposition
Enable developers to optimize website content for better conversions using AI agents that:
1. Intelligently analyze website content and structure
2. Generate compelling content alternatives
3. Simulate realistic user behavior
4. Provide data-driven optimization recommendations

## Key Requirements

### 1. Website Analysis Capabilities
- AI agents should analyze any website URL provided by the user
- Agents must intelligently identify key content elements (headlines, CTAs, value propositions)
- Analysis should focus on understanding content meaning and purpose, not just DOM structure
- The system should create a structured representation of site content for optimization

### 2. Content Generation Capabilities
- Generate multiple variants for each identified content element
- Variants should be designed to improve conversion metrics
- Content generation should maintain brand voice and purpose
- The system should support generating different types of content (headlines, CTAs, descriptions)

### 3. User Simulation Capabilities
- Create multiple user personas that represent different audience segments
- Simulate how users would interact with different content variants
- Track engagement and conversion metrics during simulations
- Enable comparison of performance across different content variants

### 4. Results Analysis Capabilities
- Analyze simulation data using statistical methods
- Identify top-performing content variants
- Calculate confidence levels for recommendations
- Present actionable optimization recommendations

### 5. CLI Interface Requirements
- Provide a simple command-line interface for all operations
- Support commands: init, analyze, generate, simulate, results, export
- Display results and recommendations in a clear, readable format
- Handle configuration management for API keys and settings

## User Flows

### Initial Setup Flow
1. User installs the tool: `npm install -g steelpush`
2. User initializes the tool: `steelpush init`
3. User provides necessary API keys and configurations
4. Configuration is saved for future use

### Website Analysis Flow
1. User runs the analyze command: `steelpush analyze https://example.com`
2. AI agents analyze the website content
3. Optimizable elements are identified
4. Analysis results are saved for content generation

### Content Generation Flow
1. User runs the generate command: `steelpush generate`
2. The system loads previous analysis results
3. For each optimizable element, multiple variants are generated
4. Generated variants are saved for simulation

### Simulation Flow
1. User runs the simulate command: `steelpush simulate`
2. AI agents with different personas simulate user behavior
3. Each agent interacts with the website and content variants
4. Interaction data and conversion metrics are collected
5. Simulation results are saved for analysis

### Results Flow
1. User runs the results command: `steelpush results`
2. The system analyzes simulation data
3. Best-performing variants are identified
4. Results and recommendations are displayed to the user

### Export Flow
1. User runs the export command: `steelpush export`
2. The system generates implementation code or instructions
3. Exportable assets are created for website updates

## Technical Integration Requirements

### AI Agent Requirements
- Agents must be capable of understanding website content intelligently
- Agents should simulate realistic user behavior
- Support for different persona types with varying behaviors
- Agent decisions should be explainable and logged

### Browser Automation Requirements
- Support for visiting any public website
- Capability to interact with page elements as a user would
- Ability to render and process JavaScript-heavy sites
- Support for capturing page content and structure

### Content Optimization Requirements
- Focus on elements that impact conversion rates
- Support for A/B testing principles
- Statistical analysis to determine significance
- Confidence scoring for recommendations

## Data Requirements

### Configuration Data
- API keys for AI services
- Simulation settings (visitor count, persona count)
- Analysis settings (element types, confidence thresholds)
- User preferences and defaults

### Analysis Data
- Website URL and metadata
- Identified content elements and their contexts
- Element classifications and purposes
- Site structure relevant to optimization

### Variant Data
- Original content for each element
- Generated variants with different approaches
- Metadata about generation parameters
- Relationships between variants and original content

### Simulation Data
- Persona definitions and behaviors
- Interaction logs for each simulated visit
- Conversion and engagement metrics
- Performance data for different variants

### Results Data
- Statistical comparisons between variants
- Confidence scores and significance metrics
- Optimized content recommendations
- Implementation guidance

## Performance Requirements
- Analysis of a typical website should complete within 5 minutes
- Content generation should take less than 1 minute per element
- Simulations should run efficiently (at least 10 simulated users per minute)
- The tool should be usable on standard developer hardware

## Constraints and Limitations
- The tool will operate as a CLI tool without a GUI in the MVP
- Initial version focuses on content optimization (not layout or design)
- Users are responsible for implementing recommendations on their websites
- The tool requires API keys for LLM services (OpenAI, etc.)

## Success Criteria
- Successfully analyze websites with complex structures
- Generate content variants that maintain brand voice
- Simulate realistic user behavior with different personas
- Provide statistically significant optimization recommendations
- Deliver a tool that developers can use without backend infrastructure
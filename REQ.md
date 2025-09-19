# Steelpush Week 1: AI Website Analysis Engine

## Objective
Build an AI system that automatically scans any website, analyzes both visual content and source code, identifies optimization opportunities, and presents recommendations to humans for approval.

## Core Requirements

### 1. Website Scanning Capability
- Accept any website URL as input
- Use Playwright MCP to visit and capture the website
- Capture both screenshot and full HTML source code
- Handle JavaScript-rendered content properly
- Extract page structure and element positioning data

### 2. AI Analysis Engine
- Analyze screenshot to understand visual layout and content hierarchy
- Parse HTML source code to understand element structure and context
- Identify conversion-critical elements including:
  - Headlines (H1, H2, primary text)
  - Call-to-action buttons and links
  - Value proposition statements
  - Form elements and surrounding text
  - Navigation elements that drive conversions

### 3. Opportunity Detection
- For each identified element, determine:
  - **Element type** (headline, CTA, value prop, etc.)
  - **Context** (above fold, near forms, primary vs secondary placement)
  - **Optimization potential** (why this element matters for conversions)
  - **Confidence score** (how certain the AI is about optimization value)
- Generate human-readable explanations for each recommendation

### 4. Human Approval Interface
- Present discovered opportunities in a clear, structured format
- Show for each opportunity:
  - Element content (original text)
  - Element location (description of where it appears)
  - Optimization reasoning (why it should be optimized)
  - Approval checkbox or Y/N option
- Allow human to approve/reject individual optimization opportunities

## Technical Specifications

### Input Requirements
- Website URL (string)
- Optional configuration for analysis depth

### Output Requirements
```json
{
  "website_url": "https://example.com",
  "analysis_timestamp": "2024-01-01T12:00:00Z",
  "opportunities": [
    {
      "id": "opp_001",
      "element_type": "headline",
      "original_content": "Welcome to Our Product",
      "element_selector": "h1.hero-title",
      "context_description": "Main headline above fold, center of hero section",
      "optimization_reasoning": "Generic welcome message could be more benefit-focused to improve conversions",
      "confidence_score": 0.85,
      "approved": null
    },
    {
      "id": "opp_002", 
      "element_type": "cta_button",
      "original_content": "Sign Up Today",
      "element_selector": "button.primary-cta",
      "context_description": "Primary CTA button, prominent placement below hero text",
      "optimization_reasoning": "Generic CTA could specify value proposition or urgency",
      "confidence_score": 0.92,
      "approved": null
    }
  ]
}
```

### Implementation Requirements

#### Website Scanner Module
- Initialize Playwright browser instance
- Navigate to provided URL
- Wait for page load completion (including JavaScript)
- Capture full-page screenshot
- Extract complete HTML source including computed styles
- Identify viewport and above-the-fold content
- Handle errors gracefully (invalid URLs, timeouts, blocked content)

#### Analysis Module  
- Process screenshot using vision AI (GPT-4V or similar)
- Parse HTML structure to identify semantic elements
- Cross-reference visual and code analysis for accuracy
- Apply conversion optimization heuristics to score elements
- Generate contextual descriptions of element placement and importance

#### Opportunity Generator
- Create structured list of optimization opportunities
- Include reasoning based on conversion optimization principles
- Assign confidence scores based on element importance and placement
- Generate human-readable explanations for each recommendation

#### Human Interface Module
- Display opportunities in readable format (CLI or simple web interface)
- Allow individual approval/rejection of opportunities
- Save approved opportunities for next phase (variant generation)
- Provide clear feedback on approval status

## Success Criteria

### Functional Requirements
1. Successfully scan and analyze any public website
2. Identify at least 3-5 meaningful optimization opportunities per typical website
3. Generate clear, actionable explanations for each opportunity
4. Allow human to approve/reject opportunities with simple interface
5. Output structured data suitable for next phase (variant generation)

### Quality Requirements
1. Analysis completes within 30 seconds for typical websites
2. Confidence scores correlate with actual conversion impact potential
3. Reasoning explanations are clear and specific (not generic)
4. No false positives for non-conversion elements (decorative text, footers, etc.)
5. Handle edge cases gracefully (single-page apps, heavy JavaScript, etc.)

## Implementation Validation

To validate successful implementation:

1. **Test with 5 different website types**:
   - E-commerce product page
   - SaaS landing page  
   - Blog/content site
   - Service business homepage
   - Mobile app landing page

2. **Verify analysis quality**:
   - Each test should identify 3-5 relevant opportunities
   - Confidence scores should be reasonable (0.7+ for obvious elements)
   - Reasoning should be specific and actionable
   - No critical conversion elements should be missed

3. **Confirm interface usability**:
   - Human can easily understand each recommendation
   - Approval/rejection process is intuitive
   - Output data is properly structured for next phase

## Technical Constraints
- Use Playwright MCP for browser automation
- Integrate with OpenAI or similar for AI analysis
- Keep processing time under 30 seconds per website
- Handle websites that require JavaScript rendering
- Graceful error handling for inaccessible sites

## Next Phase Preparation
The output of this week's implementation (approved optimization opportunities) will feed into Week 2's variant generation system. Ensure the output format supports:
- Element identification for variant injection
- Context preservation for relevant variant generation
- Approval status tracking for implementation

## Definition of Done
- [ ] System can scan any website URL
- [ ] AI identifies conversion-critical elements automatically
- [ ] Human receives clear optimization recommendations
- [ ] Human can approve/reject recommendations
- [ ] System outputs structured data for approved opportunities
- [ ] All edge cases handled gracefully
- [ ] Performance requirements met (under 30 seconds)
- [ ] Tested successfully on 5 different website types
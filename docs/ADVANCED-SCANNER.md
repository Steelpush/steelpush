# Advanced Website Scanner

The advanced scanner is Steelpush's most powerful website analysis tool, featuring:

## 🚀 Key Features

### Vision-Enabled Analysis
- **AI Vision Mode**: Analyzes screenshots using multimodal AI models
- **Visual Hierarchy Assessment**: Evaluates layout effectiveness
- **Mobile Optimization Check**: Assesses responsive design
- **Accessibility Evaluation**: Checks for accessibility issues

### Interactive Navigation
- **Button Clicking**: Automatically discovers and clicks interactive elements
- **Form Interaction**: Tests form usability and conversion flow
- **Navigation Testing**: Explores website structure and user journeys
- **Screenshot Capture**: Documents before/after states of interactions

### Deep Conversion Analysis
- **CRO-Focused Prompts**: Optimized for conversion rate optimization
- **Testing Priority Scoring**: Ranks opportunities by impact potential
- **Conversion Impact Estimation**: Estimates potential uplift percentage
- **Supabase-Ready Output**: Structured for database storage

## 📊 Output Structure

### Page Analysis
```typescript
interface PageContent {
  pageUrl: string;
  pageTitle: string;
  screenshots: string[];              // Captured screenshots
  interactions: InteractionResult[];  // Button clicks, form interactions
  optimizableElements: OptimizableElement[];
  visionAnalysis?: VisionAnalysis;    // AI vision insights
}
```

### Optimization Opportunities
```typescript
interface OptimizableElement {
  type: string;                       // headline, CTA, form, etc.
  selector: string;                   // CSS selector
  content: string;                    // Current content
  location: string;                   // Page location
  importance: 'high' | 'medium' | 'low';
  optimizationPotential: 'high' | 'medium' | 'low';
  issue: string;                      // Specific problem identified
  recommendation: string;             // Improvement suggestion
  conversionImpact?: number;          // Estimated impact (0-1)
  testingPriority?: 'critical' | 'high' | 'medium' | 'low';
}
```

### Conversion Report
```typescript
interface ConversionReport {
  summary: {
    totalPages: number;
    totalElements: number;
    highPriorityOpportunities: number;
    estimatedConversionUplift: number;
  };
  keyFindings: string[];
  prioritizedOpportunities: OptimizableElement[];
  userJourneyAnalysis: string[];
  technicalRecommendations: string[];
  supabasePayload: any;              // Ready for database upload
}
```

## 🛠️ Usage

### Basic Usage
```typescript
import { scanWebsiteAdvanced } from './src/scanner/advanced-scanner';

const result = await scanWebsiteAdvanced('https://example.com', {
  maxPages: 5,
  maxDepth: 2,
  interactiveMode: true,
  visionMode: true,
  generateReport: true
});
```

### Configuration Options
```typescript
interface ScanOptions {
  maxPages?: number;           // Max pages to scan (default: 5)
  maxDepth?: number;          // Max crawl depth (default: 2)
  headless?: boolean;         // Browser visibility (default: true)
  timeout?: number;           // Navigation timeout (default: 60000)
  screenshotsDir?: string;    // Screenshot directory (default: 'screenshots')
  interactiveMode?: boolean;  // Enable interactions (default: true)
  visionMode?: boolean;       // Enable AI vision (default: true)
  generateReport?: boolean;   // Generate report (default: true)
}
```

### Integration with CLI
The advanced scanner is the default scanner used by the CLI:

```bash
# Use advanced scanner (default)
steelpush analyze https://example.com

# Explicitly use advanced scanner
steelpush analyze https://example.com --scanner advanced

# With custom options
steelpush analyze https://example.com --max-pages 10 --interactive --vision
```

## 🎯 Conversion Focus

The scanner is optimized for identifying high-impact conversion opportunities:

### High-Priority Elements
- Headlines and value propositions
- Call-to-action buttons
- Forms and checkout flows
- Trust indicators and social proof
- Pricing and offer presentations

### Testing Recommendations
- A/B test variants for critical elements
- Multivariate tests for complex pages
- User journey optimization
- Mobile-first improvements

## 📈 Supabase Integration

The scanner generates data ready for Supabase upload:

```typescript
const supabasePayload = {
  scan_timestamp: string;
  website_url: string;
  total_pages: number;
  total_opportunities: number;
  high_priority_count: number;
  estimated_uplift: number;
  pages_data: PageData[];
  report_summary: ReportSummary;
};
```

### Database Schema (Recommended)
```sql
CREATE TABLE website_scans (
  id SERIAL PRIMARY KEY,
  scan_timestamp TIMESTAMP WITH TIME ZONE,
  website_url TEXT NOT NULL,
  total_pages INTEGER,
  total_opportunities INTEGER,
  high_priority_count INTEGER,
  estimated_uplift FLOAT,
  pages_data JSONB,
  report_summary JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🔧 Technical Details

### AI Models Supported
- **Anthropic Claude**: Best for vision analysis and detailed reasoning
- **OpenAI GPT-4**: Good alternative with vision capabilities

### Browser Automation
- **Playwright**: Reliable cross-browser automation
- **Full-page Screenshots**: Captures entire page content
- **Responsive Testing**: Tests mobile and desktop views

### Performance Considerations
- **Concurrent Analysis**: Processes multiple elements simultaneously
- **Smart Filtering**: Focuses on conversion-relevant elements
- **Error Handling**: Graceful degradation for problematic pages

## 🚀 Next Steps

After scanning, use the results for:

1. **A/B Test Planning**: Prioritize tests by conversion impact
2. **Content Generation**: Create variants for high-priority elements
3. **Performance Tracking**: Monitor conversion improvements
4. **Continuous Optimization**: Regular re-scanning for new opportunities

## 🤝 Contributing

To improve the advanced scanner:

1. Add new interaction types (hover, scroll patterns)
2. Enhance vision analysis prompts
3. Improve conversion impact estimation
4. Add industry-specific optimization rules
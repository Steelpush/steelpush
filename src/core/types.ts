export interface OptimizableElement {
  type: 'headline' | 'cta' | 'value-prop' | 'product-desc' | 'form';
  selector: string;
  content: string;
  context: string;
}

export interface ContentVariant {
  original: string;
  variant: string;
  style: string;
  confidence: number;
}

export interface AnalysisResult {
  url: string;
  pageTitle: string;
  optimizableElements: OptimizableElement[];
  metadata: {
    loadTime: number;
    wordCount: number;
    links: number;
  };
}

export interface SimulationOptions {
  visitorCount: number;
  personaCount: number;
  duration: string;
}

export interface SimulationResults {
  variants: ContentVariant[];
  metrics: {
    engagement: number;
    conversion: number;
    timeOnPage: number;
  };
  personaBreakdown: Record<string, {
    engagement: number;
    conversion: number;
  }>;
} 
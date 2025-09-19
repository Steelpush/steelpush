/**
 * Utility to convert scan results to REQ.md compliant format
 */

export interface REQOpportunity {
  id: string;
  element_type: string;
  original_content: string;
  element_selector: string;
  context_description: string;
  optimization_reasoning: string;
  confidence_score: number;
  approved: boolean | null;
}

export interface REQAnalysisResult {
  website_url: string;
  analysis_timestamp: string;
  opportunities: REQOpportunity[];
}

/**
 * Convert internal scan result to REQ.md format
 */
export function convertToREQFormat(scanResult: any): REQAnalysisResult {
  const opportunities: REQOpportunity[] = [];
  const website_url = scanResult.source || scanResult.baseUrl || "Unknown";
  const analysis_timestamp = new Date(
    scanResult.timestamp || Date.now()
  ).toISOString();

  let opportunityCounter = 1;

  // Handle different scan result formats
  if (scanResult.type === "website" && scanResult.data) {
    // Handle pages format
    if (scanResult.data.pages) {
      scanResult.data.pages.forEach((page: any, pageIndex: number) => {
        if (page.optimizableElements) {
          page.optimizableElements.forEach((element: any) => {
            opportunities.push(
              createREQOpportunity(
                element,
                page.pageUrl || website_url,
                opportunityCounter++
              )
            );
          });
        }
      });
    }

    // Handle content format
    if (scanResult.data.content) {
      scanResult.data.content.forEach((item: any) => {
        opportunities.push(
          createREQOpportunity(
            item,
            item.url || website_url,
            opportunityCounter++
          )
        );
      });
    }
  }

  // Handle direct WebsiteScanResult format
  if (scanResult.content) {
    scanResult.content.forEach((item: any) => {
      opportunities.push(
        createREQOpportunity(
          item,
          item.url || website_url,
          opportunityCounter++
        )
      );
    });
  }

  return {
    website_url,
    analysis_timestamp,
    opportunities,
  };
}

/**
 * Create a single REQ opportunity from internal format
 */
function createREQOpportunity(
  element: any,
  url: string,
  counter: number
): REQOpportunity {
  return {
    id: `opp_${counter.toString().padStart(3, "0")}`,
    element_type: normalizeElementType(element.type || "unknown"),
    original_content: element.content || "",
    element_selector: generateCSSSelectorFromElement(element),
    context_description: createContextDescription(element, url),
    optimization_reasoning: createOptimizationReasoning(element),
    confidence_score: calculateConfidenceScore(element),
    approved: null,
  };
}

/**
 * Normalize element types to standard values
 */
function normalizeElementType(type: string): string {
  const normalized = type.toLowerCase().trim();

  const typeMap: Record<string, string> = {
    heading: "headline",
    headline: "headline",
    h1: "headline",
    h2: "headline",
    h3: "headline",
    button: "cta_button",
    cta: "cta_button",
    cta_button: "cta_button",
    link: "cta_link",
    form: "form_element",
    input: "form_element",
    textarea: "form_element",
    paragraph: "text_content",
    text: "text_content",
    testimonial: "testimonial",
    pricing: "pricing_element",
    navigation: "nav_element",
  };

  return typeMap[normalized] || "text_content";
}

/**
 * Generate CSS selector from element information
 */
function generateCSSSelectorFromElement(element: any): string {
  // If selector is already provided, use it
  if (element.selector) return element.selector;

  // Generate based on element type
  const type = element.type?.toLowerCase() || "unknown";

  switch (type) {
    case "heading":
    case "headline":
    case "h1":
      return "h1";
    case "h2":
      return "h2";
    case "h3":
      return "h3";
    case "button":
    case "cta":
      return "button, .btn, .cta-button";
    case "form":
      return "form";
    case "input":
      return "input";
    case "textarea":
      return "textarea";
    case "link":
      return "a.cta, a.button";
    case "navigation":
      return "nav a, .nav-link";
    case "testimonial":
      return ".testimonial, .review";
    case "pricing":
      return ".price, .pricing";
    default:
      return "p, div, span";
  }
}

/**
 * Create context description
 */
function createContextDescription(element: any, url: string): string {
  const location = element.location || "page";
  const urlPart = url !== "Unknown" ? ` on ${new URL(url).pathname}` : "";

  // Enhance location description
  let enhancedLocation = location;
  if (location.toLowerCase().includes("hero")) {
    enhancedLocation = "Main hero section above the fold";
  } else if (location.toLowerCase().includes("header")) {
    enhancedLocation = "Header area";
  } else if (location.toLowerCase().includes("nav")) {
    enhancedLocation = "Navigation menu";
  } else if (location.toLowerCase().includes("footer")) {
    enhancedLocation = "Footer section";
  } else if (location.toLowerCase().includes("sidebar")) {
    enhancedLocation = "Sidebar area";
  }

  return `${enhancedLocation}${urlPart}`;
}

/**
 * Create optimization reasoning
 */
function createOptimizationReasoning(element: any): string {
  let reasoning = "";

  if (element.issue && element.recommendation) {
    reasoning = `${element.issue}. ${element.recommendation}`;
  } else if (element.issue) {
    reasoning = element.issue;
  } else if (element.recommendation) {
    reasoning = element.recommendation;
  } else {
    // Generate generic reasoning based on element type
    const type = element.type?.toLowerCase() || "unknown";
    switch (type) {
      case "heading":
      case "headline":
        reasoning =
          "Headline could be more compelling and benefit-focused to improve conversion rates";
        break;
      case "button":
      case "cta":
        reasoning =
          "Call-to-action button could be more specific about the value proposition and create urgency";
        break;
      case "form":
        reasoning =
          "Form could be optimized to reduce friction and improve completion rates";
        break;
      default:
        reasoning =
          "Content could be optimized to better engage visitors and drive conversions";
    }
  }

  return reasoning;
}

/**
 * Calculate confidence score (0-1)
 */
function calculateConfidenceScore(element: any): number {
  let score = 0.5; // Base score

  // Factor in importance
  const importance = element.importance?.toLowerCase();
  if (importance === "high") score += 0.25;
  else if (importance === "medium") score += 0.15;
  else if (importance === "low") score += 0.05;

  // Factor in optimization potential
  const potential = element.optimizationPotential?.toLowerCase();
  if (potential === "high") score += 0.2;
  else if (potential === "medium") score += 0.1;
  else if (potential === "low") score += 0.05;

  // Factor in element type (some types are more reliable)
  const type = element.type?.toLowerCase() || "";
  if (["heading", "headline", "cta", "button"].includes(type)) {
    score += 0.1; // High confidence for conversion-critical elements
  }

  // Factor in content quality
  if (element.content && element.content.length > 5) {
    score += 0.05; // Slight boost for having content
  }

  // Ensure score is between 0.1 and 1.0
  return Math.min(Math.max(score, 0.1), 1.0);
}

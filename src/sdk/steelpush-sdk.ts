/**
 * Steelpush SDK - Enables dynamic content optimization on websites
 */

interface OptimizationConfig {
  element_id: string;
  original_content: string;
  optimized_content: string;
  element_type: string;
  test_percentage?: number;
  enabled?: boolean;
}

interface SteelpushConfig {
  project_id: string;
  optimizations: OptimizationConfig[];
  debug?: boolean;
}

class SteelpushSDK {
  private config: SteelpushConfig;
  private isInitialized = false;
  private activeTests = new Map<string, boolean>();

  constructor(config: SteelpushConfig) {
    this.config = config;
  }

  /**
   * Initialize the SDK and apply optimizations
   */
  init(): void {
    if (this.isInitialized) return;

    this.log("Initializing Steelpush SDK...");

    // Wait for DOM to be ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () =>
        this.applyOptimizations()
      );
    } else {
      this.applyOptimizations();
    }

    this.isInitialized = true;
  }

  /**
   * Apply all enabled optimizations
   */
  private applyOptimizations(): void {
    this.config.optimizations.forEach((optimization) => {
      if (optimization.enabled !== false) {
        this.applyOptimization(optimization);
      }
    });
  }

  /**
   * Apply a single optimization
   */
  private applyOptimization(optimization: OptimizationConfig): void {
    const element = this.findElement(optimization.element_id);

    if (!element) {
      this.log(`Element not found: ${optimization.element_id}`);
      return;
    }

    // Determine if user should see optimization (A/B testing)
    const shouldOptimize = this.shouldApplyOptimization(optimization);

    if (shouldOptimize) {
      this.updateElementContent(element, optimization);
      this.activeTests.set(optimization.element_id, true);
      this.log(`Applied optimization: ${optimization.element_id}`);
    } else {
      this.activeTests.set(optimization.element_id, false);
      this.log(`Control group: ${optimization.element_id}`);
    }

    // Track the test
    this.trackOptimization(optimization.element_id, shouldOptimize);
  }

  /**
   * Find element by steelpush ID or CSS selector
   */
  private findElement(elementId: string): Element | null {
    // Try steelpush data attribute first
    let element = document.querySelector(`[data-steelpush-id="${elementId}"]`);

    if (!element) {
      // Fall back to CSS selector
      element = document.querySelector(elementId);
    }

    return element;
  }

  /**
   * Update element content based on type
   */
  private updateElementContent(
    element: Element,
    optimization: OptimizationConfig
  ): void {
    switch (optimization.element_type) {
      case "headline":
      case "text_content":
        element.textContent = optimization.optimized_content;
        break;

      case "cta_button":
        if (element.tagName === "BUTTON") {
          element.textContent = optimization.optimized_content;
        } else if (element.tagName === "INPUT") {
          (element as HTMLInputElement).value = optimization.optimized_content;
        }
        break;

      case "cta_link":
        element.textContent = optimization.optimized_content;
        break;

      case "form_element":
        if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
          (element as HTMLInputElement).placeholder =
            optimization.optimized_content;
        }
        break;

      default:
        element.textContent = optimization.optimized_content;
    }

    // Add steelpush marker
    element.setAttribute("data-steelpush-optimized", "true");
    element.setAttribute("data-steelpush-id", optimization.element_id);
  }

  /**
   * Determine if optimization should be applied (A/B testing)
   */
  private shouldApplyOptimization(optimization: OptimizationConfig): boolean {
    const testPercentage = optimization.test_percentage || 50;

    // Use deterministic randomization based on user session
    const userId = this.getUserId();
    const hash = this.simpleHash(userId + optimization.element_id);
    const percentage = hash % 100;

    return percentage < testPercentage;
  }

  /**
   * Get or create user ID for consistent A/B testing
   */
  private getUserId(): string {
    let userId = localStorage.getItem("steelpush_user_id");

    if (!userId) {
      userId = "user_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("steelpush_user_id", userId);
    }

    return userId;
  }

  /**
   * Simple hash function for consistent randomization
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Track optimization view/conversion
   */
  private trackOptimization(elementId: string, isOptimized: boolean): void {
    // Send tracking event to analytics
    const event = {
      type: "steelpush_view",
      element_id: elementId,
      variant: isOptimized ? "optimized" : "control",
      timestamp: Date.now(),
      project_id: this.config.project_id,
    };

    this.sendEvent(event);
  }

  /**
   * Track conversion events
   */
  trackConversion(conversionType: string = "default"): void {
    this.activeTests.forEach((isOptimized, elementId) => {
      const event = {
        type: "steelpush_conversion",
        element_id: elementId,
        variant: isOptimized ? "optimized" : "control",
        conversion_type: conversionType,
        timestamp: Date.now(),
        project_id: this.config.project_id,
      };

      this.sendEvent(event);
    });
  }

  /**
   * Send event to analytics endpoint
   */
  private sendEvent(event: any): void {
    // In production, this would send to your analytics service
    if (this.config.debug) {
      console.log("Steelpush Event:", event);
    }

    // Example: Send to your analytics
    fetch("/api/steelpush/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }).catch((err) => this.log("Tracking failed:", err));
  }

  /**
   * Debug logging
   */
  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log("[Steelpush]", ...args);
    }
  }

  /**
   * Manual optimization control
   */
  enableOptimization(elementId: string): void {
    const optimization = this.config.optimizations.find(
      (opt) => opt.element_id === elementId
    );
    if (optimization) {
      optimization.enabled = true;
      this.applyOptimization(optimization);
    }
  }

  disableOptimization(elementId: string): void {
    const optimization = this.config.optimizations.find(
      (opt) => opt.element_id === elementId
    );
    if (optimization) {
      optimization.enabled = false;
      // Revert to original content
      const element = this.findElement(elementId);
      if (element) {
        this.updateElementContent(element, {
          ...optimization,
          optimized_content: optimization.original_content,
        });
      }
    }
  }
}

// Global SDK instance
declare global {
  interface Window {
    Steelpush: typeof SteelpushSDK;
    steelpush: SteelpushSDK | undefined;
  }
}

// Export for module usage
export { SteelpushSDK };

// Browser global usage
if (typeof window !== "undefined") {
  window.Steelpush = SteelpushSDK;
}

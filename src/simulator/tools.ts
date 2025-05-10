import { Tool } from "langchain/tools";
import { Page } from "playwright";

export class BrowserNavigationTool extends Tool {
  name = "browser_navigation";
  description = "Navigate to a URL in the browser";

  constructor(private page: Page) {
    super();
  }

  async _call(url: string): Promise<string> {
    try {
      await this.page.goto(url);
      return `Successfully navigated to ${url}`;
    } catch (error: any) {
      return `Failed to navigate to ${url}: ${error?.message || "Unknown error"}`;
    }
  }
}

export class ClickElementTool extends Tool {
  name = "click_element";
  description = "Click on an element in the page";

  constructor(private page: Page) {
    super();
  }

  async _call(selector: string): Promise<string> {
    try {
      await this.page.click(selector);
      return `Successfully clicked element ${selector}`;
    } catch (error: any) {
      return `Failed to click element ${selector}: ${error?.message || "Unknown error"}`;
    }
  }
}

export class TypeTextTool extends Tool {
  name = "type_text";
  description = "Type text into an input field";

  constructor(private page: Page) {
    super();
  }

  async _call(input: { selector: string; text: string }): Promise<string> {
    try {
      await this.page.fill(input.selector, input.text);
      return `Successfully typed text into ${input.selector}`;
    } catch (error: any) {
      return `Failed to type text into ${input.selector}: ${error?.message || "Unknown error"}`;
    }
  }
}

export class GetElementTextTool extends Tool {
  name = "get_element_text";
  description = "Get the text content of an element";

  constructor(private page: Page) {
    super();
  }

  async _call(selector: string): Promise<string> {
    try {
      const text = await this.page.textContent(selector);
      return text || `No text found in ${selector}`;
    } catch (error: any) {
      return `Failed to get text from ${selector}: ${error?.message || "Unknown error"}`;
    }
  }
}

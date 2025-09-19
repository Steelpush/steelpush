/**
 * Deploy command - Creates deployable artifacts for optimizations
 */

import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { REQAnalysisResult } from "../utils/format-converter";

interface DeploymentStrategy {
  type: "sdk" | "patch" | "preview";
  config: any;
}

export function deployCommand(program: Command): Command {
  return program
    .command("deploy <generated-file>")
    .description("Deploy optimizations using various strategies")
    .option(
      "-s, --strategy <strategy>",
      "Deployment strategy: sdk, patch, preview",
      "sdk"
    )
    .option("-o, --output <path>", "Output directory for deployment artifacts")
    .option("--project-id <id>", "Project ID for SDK deployment")
    .option("--test-percentage <percent>", "A/B test traffic percentage", "50")
    .action(async (generatedFile, options) => {
      console.log(`🚀 Deploying optimizations from ${generatedFile}...`);

      try {
        // Load generated content
        const generatedData = JSON.parse(
          fs.readFileSync(generatedFile, "utf-8")
        );

        const strategy: DeploymentStrategy = {
          type: options.strategy,
          config: {
            projectId: options.projectId || "default-project",
            testPercentage: parseInt(options.testPercentage),
            outputDir: options.output || "steelpush-deploy",
          },
        };

        switch (strategy.type) {
          case "sdk":
            await deployWithSDK(generatedData, strategy.config);
            break;
          case "patch":
            await deployWithPatches(generatedData, strategy.config);
            break;
          case "preview":
            await deployPreview(generatedData, strategy.config);
            break;
          default:
            throw new Error(`Unknown strategy: ${strategy.type}`);
        }
      } catch (error) {
        console.error("Deployment failed:", error);
        process.exit(1);
      }
    });
}

/**
 * Deploy using SDK approach
 */
async function deployWithSDK(generatedData: any, config: any): Promise<void> {
  const outputDir = config.outputDir;

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate SDK configuration
  const sdkConfig = {
    project_id: config.projectId,
    debug: true,
    optimizations: generatedData.generated_content.map(
      (item: any, index: number) => ({
        element_id: `steelpush-${index + 1}`,
        original_content: item.original_content,
        optimized_content: item.optimized_content,
        element_type: item.opportunity_id.split("_")[0], // Extract type from ID
        test_percentage: config.testPercentage,
        enabled: true,
      })
    ),
  };

  // Save SDK config
  const configPath = path.join(outputDir, "steelpush-config.json");
  fs.writeFileSync(configPath, JSON.stringify(sdkConfig, null, 2));

  // Copy SDK file
  const sdkSource = path.join(__dirname, "../sdk/steelpush-sdk.ts");
  const sdkDist = path.join(outputDir, "steelpush.js");

  // In real implementation, you'd compile TypeScript to JavaScript
  fs.copyFileSync(sdkSource, sdkDist);

  // Generate integration HTML
  const integrationHTML = generateIntegrationCode(sdkConfig);
  fs.writeFileSync(path.join(outputDir, "integration.html"), integrationHTML);

  // Generate implementation guide
  const guide = generateImplementationGuide(generatedData, "sdk");
  fs.writeFileSync(path.join(outputDir, "IMPLEMENTATION.md"), guide);

  console.log("✅ SDK deployment artifacts created:");
  console.log(`📁 ${outputDir}/`);
  console.log(`  ├── steelpush-config.json - SDK configuration`);
  console.log(`  ├── steelpush.js - SDK library`);
  console.log(`  ├── integration.html - Integration example`);
  console.log(`  └── IMPLEMENTATION.md - Setup instructions`);
}

/**
 * Deploy using code patches
 */
async function deployWithPatches(
  generatedData: any,
  config: any
): Promise<void> {
  const outputDir = config.outputDir;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate patches for each optimization
  const patches: string[] = [];

  generatedData.generated_content.forEach((item: any, index: number) => {
    // This would need the implementation_target data from our enhanced REQ format
    const patchContent = generateCodePatch(item);
    const patchFile = path.join(outputDir, `patch-${index + 1}.patch`);

    fs.writeFileSync(patchFile, patchContent);
    patches.push(patchFile);
  });

  // Generate application script
  const applyScript = generatePatchApplicationScript(patches);
  fs.writeFileSync(path.join(outputDir, "apply-patches.sh"), applyScript);

  // Generate implementation guide
  const guide = generateImplementationGuide(generatedData, "patch");
  fs.writeFileSync(path.join(outputDir, "IMPLEMENTATION.md"), guide);

  console.log("✅ Patch deployment artifacts created:");
  console.log(`📁 ${outputDir}/`);
  patches.forEach((patch, index) => {
    console.log(`  ├── patch-${index + 1}.patch`);
  });
  console.log(`  ├── apply-patches.sh - Automated application`);
  console.log(`  └── IMPLEMENTATION.md - Setup instructions`);
}

/**
 * Deploy preview version
 */
async function deployPreview(generatedData: any, config: any): Promise<void> {
  const outputDir = config.outputDir;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate preview HTML page
  const previewHTML = generatePreviewPage(generatedData);
  fs.writeFileSync(path.join(outputDir, "preview.html"), previewHTML);

  // Generate comparison view
  const comparisonHTML = generateComparisonView(generatedData);
  fs.writeFileSync(path.join(outputDir, "comparison.html"), comparisonHTML);

  console.log("✅ Preview deployment created:");
  console.log(`📁 ${outputDir}/`);
  console.log(`  ├── preview.html - Preview optimized version`);
  console.log(`  └── comparison.html - Side-by-side comparison`);
  console.log(`\n🌐 Open preview.html in browser to see optimizations`);
}

/**
 * Generate SDK integration code
 */
function generateIntegrationCode(config: any): string {
  return `<!DOCTYPE html>
<html>
<head>
    <title>Steelpush Integration Example</title>
</head>
<body>
    <!-- Add data attributes to elements you want to optimize -->
    <h1 data-steelpush-id="steelpush-1">Original Headline</h1>
    <button data-steelpush-id="steelpush-2">Original Button Text</button>
    
    <!-- Include Steelpush SDK -->
    <script src="steelpush.js"></script>
    <script>
        // Initialize with your configuration
        const steelpush = new Steelpush(${JSON.stringify(config, null, 8)});
        steelpush.init();
        
        // Track conversions on form submit, purchase, etc.
        document.querySelector('form')?.addEventListener('submit', () => {
            steelpush.trackConversion('form_submit');
        });
    </script>
</body>
</html>`;
}

/**
 * Generate code patch for direct implementation
 */
function generateCodePatch(optimization: any): string {
  // This would use the implementation_target data to create actual patches
  return `--- a/src/components/Example.tsx
+++ b/src/components/Example.tsx
@@ -10,7 +10,7 @@
   return (
     <div>
-      <h1>${optimization.original_content}</h1>
+      <h1>${optimization.optimized_content}</h1>
     </div>
   );
 }`;
}

/**
 * Generate patch application script
 */
function generatePatchApplicationScript(patches: string[]): string {
  return `#!/bin/bash
echo "Applying Steelpush optimizations..."

${patches.map((patch) => `git apply ${path.basename(patch)}`).join("\n")}

echo "✅ All patches applied successfully!"
echo "🚀 Ready to deploy optimized version"
`;
}

/**
 * Generate implementation guide
 */
function generateImplementationGuide(
  generatedData: any,
  strategy: string
): string {
  const baseGuide = `# Steelpush Implementation Guide

## Strategy: ${strategy.toUpperCase()}

Generated optimizations for ${generatedData.website_url}
Generated at: ${generatedData.generation_timestamp}

## Optimizations Summary
${generatedData.generated_content
  .map(
    (item: any, index: number) => `
### Optimization ${index + 1}
- **Original**: "${item.original_content}"
- **Optimized**: "${item.optimized_content}"
- **Reasoning**: ${item.generation_reasoning}
`
  )
  .join("")}
`;

  if (strategy === "sdk") {
    return (
      baseGuide +
      `
## SDK Implementation Steps

1. **Add the SDK to your website:**
   \`\`\`html
   <script src="steelpush.js"></script>
   \`\`\`

2. **Add data attributes to elements:**
   \`\`\`html
   <h1 data-steelpush-id="steelpush-1">Your headline</h1>
   <button data-steelpush-id="steelpush-2">Your button</button>
   \`\`\`

3. **Initialize the SDK:**
   \`\`\`javascript
   const steelpush = new Steelpush(config);
   steelpush.init();
   \`\`\`

4. **Track conversions:**
   \`\`\`javascript
   steelpush.trackConversion('purchase');
   \`\`\`

## Benefits
- ✅ A/B testing built-in
- ✅ Easy to enable/disable optimizations  
- ✅ Analytics tracking included
- ✅ No code changes required
`
    );
  }

  if (strategy === "patch") {
    return (
      baseGuide +
      `
## Patch Implementation Steps

1. **Review patches:**
   Check each .patch file for the changes

2. **Apply patches:**
   \`\`\`bash
   bash apply-patches.sh
   \`\`\`

3. **Test changes:**
   Verify optimizations work as expected

4. **Deploy:**
   Push changes to production

## Benefits
- ✅ Direct code implementation
- ✅ No runtime dependencies
- ✅ Full control over changes
- ✅ Version control friendly
`
    );
  }

  return baseGuide;
}

/**
 * Generate preview page
 */
function generatePreviewPage(generatedData: any): string {
  return `<!DOCTYPE html>
<html>
<head>
    <title>Steelpush Preview - Optimized Version</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .optimization { margin: 20px 0; padding: 20px; border: 1px solid #ddd; }
        .original { background: #fff3cd; }
        .optimized { background: #d4edda; }
    </style>
</head>
<body>
    <h1>🚀 Steelpush Optimization Preview</h1>
    <p>Website: ${generatedData.website_url}</p>
    
    ${generatedData.generated_content
      .map(
        (item: any, index: number) => `
    <div class="optimization">
        <h3>Optimization ${index + 1}</h3>
        <div class="original">
            <strong>Original:</strong> "${item.original_content}"
        </div>
        <div class="optimized">
            <strong>Optimized:</strong> "${item.optimized_content}"
        </div>
        <p><em>Reasoning:</em> ${item.generation_reasoning}</p>
    </div>
    `
      )
      .join("")}
</body>
</html>`;
}

/**
 * Generate comparison view
 */
function generateComparisonView(generatedData: any): string {
  return `<!DOCTYPE html>
<html>
<head>
    <title>Steelpush Comparison</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .comparison { display: flex; gap: 20px; margin: 20px 0; }
        .version { flex: 1; padding: 20px; border: 1px solid #ddd; }
        .control { background: #f8f9fa; }
        .variant { background: #e8f5e8; }
    </style>
</head>
<body>
    <h1>📊 A/B Test Comparison</h1>
    
    ${generatedData.generated_content
      .map(
        (item: any, index: number) => `
    <div class="comparison">
        <div class="version control">
            <h3>Control (Original)</h3>
            <p>"${item.original_content}"</p>
        </div>
        <div class="version variant">
            <h3>Variant (Optimized)</h3>
            <p>"${item.optimized_content}"</p>
        </div>
    </div>
    `
      )
      .join("")}
</body>
</html>`;
}

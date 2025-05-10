#!/usr/bin/env node

import { Command } from "commander";
import { analyzeSourceCode } from "./analyzer/source-code-analyzer";
import fs from "fs";
import path from "path";

const program = new Command();

// State management
const STATE_FILE = path.join(process.cwd(), "steelpush-sourcecode-state.json");

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    }
  } catch (error) {
    console.warn("Failed to load state:", error);
  }
  return {
    analysis: null,
  };
}

function saveState(state: any) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.warn("Failed to save state:", error);
  }
}

program
  .name("steelpush-source-analyzer")
  .description("AI-powered source code analysis for marketing content")
  .version("0.1.0");

program
  .command("analyze")
  .description("Analyze source code for marketing content")
  .argument("<directory>", "Directory path to analyze")
  .option("-o, --output <format>", "Output format (json, table)", "json")
  .action(async (directory: string, options) => {
    const state = loadState();
    console.log(`Analyzing source code in: ${directory}`);

    const result = await analyzeSourceCode(directory);
    state.analysis = result;
    saveState(state);

    if (options.output === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("=== Marketing Content Analysis ===\n");
      console.log(`Found ${result.marketingContent.length} marketing content items in ${result.fileMap.filter(f => f.hasMarketingContent).length} files\n`);
      
      console.log("Top 10 marketing content items:\n");
      result.marketingContent.slice(0, 10).forEach((item, index) => {
        console.log(`${index + 1}. ${item.type.toUpperCase()} in ${item.file}:${item.lineNumber}`);
        console.log(`   "${item.content.substring(0, 80)}${item.content.length > 80 ? '...' : ''}"`); 
        console.log("");
      });
      
      const fileTypeStats = result.fileMap.reduce((acc, file) => {
        if (!acc[file.type]) {
          acc[file.type] = { total: 0, withContent: 0 };
        }
        acc[file.type].total++;
        if (file.hasMarketingContent) {
          acc[file.type].withContent++;
        }
        return acc;
      }, {} as Record<string, { total: number, withContent: number }>);
      
      console.log("\n=== File Type Statistics ===\n");
      console.log("File Type | Total Files | With Marketing Content | Percentage");
      console.log("---------|-------------|---------------------|------------");
      Object.entries(fileTypeStats).sort((a, b) => b[1].withContent - a[1].withContent).forEach(([type, stats]) => {
        const percentage = ((stats.withContent / stats.total) * 100).toFixed(1);
        console.log(`${type.padEnd(10)} | ${String(stats.total).padEnd(11)} | ${String(stats.withContent).padEnd(19)} | ${percentage}%`);
      });
    }
  });

program
  .command("report")
  .description("Generate a report from the previous analysis")
  .option("-t, --type <type>", "Report type (summary, detailed)", "summary")
  .option("-f, --format <format>", "Output format (text, json, html, markdown)", "markdown")
  .option("-o, --output <file>", "Output file")
  .action(async (options) => {
    const state = loadState();
    if (!state.analysis) {
      console.error("No analysis found. Please run 'analyze' command first.");
      process.exit(1);
    }

    const result = state.analysis;
    let report = '';
    
    if (options.format === 'markdown') {
      report = generateMarkdownReport(result, options.type);
    } else if (options.format === 'json') {
      report = JSON.stringify(result, null, 2);
    } else if (options.format === 'html') {
      report = generateHtmlReport(result, options.type);
    } else {
      report = generateTextReport(result, options.type);
    }
    
    if (options.output) {
      fs.writeFileSync(options.output, report);
      console.log(`Report saved to ${options.output}`);
    } else {
      console.log(report);
    }
  });

function generateMarkdownReport(result: any, type: string): string {
  const { marketingContent, fileMap } = result;
  const filesWithContent = fileMap.filter((f: any) => f.hasMarketingContent);
  
  let report = '# Source Code Marketing Content Analysis\n\n';
  
  report += `## Summary\n\n`;
  report += `- **Total Files Analyzed**: ${fileMap.length}\n`;
  report += `- **Files With Marketing Content**: ${filesWithContent.length} (${((filesWithContent.length / fileMap.length) * 100).toFixed(1)}%)\n`;
  report += `- **Total Marketing Content Items**: ${marketingContent.length}\n\n`;
  
  // Content type distribution
  const typeDistribution = marketingContent.reduce((acc: any, item: any) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});
  
  report += `## Content Type Distribution\n\n`;
  report += `| Type | Count | Percentage |\n`;
  report += `|------|-------|------------|\n`;
  
  Object.entries(typeDistribution)
    .sort((a: any, b: any) => b[1] - a[1])
    .forEach(([type, count]: [string, any]) => {
      const percentage = ((count / marketingContent.length) * 100).toFixed(1);
      report += `| ${type} | ${count} | ${percentage}% |\n`;
    });
  
  report += `\n`;
  
  // File type statistics
  const fileTypeStats = fileMap.reduce((acc: any, file: any) => {
    if (!acc[file.type]) {
      acc[file.type] = { total: 0, withContent: 0 };
    }
    acc[file.type].total++;
    if (file.hasMarketingContent) {
      acc[file.type].withContent++;
    }
    return acc;
  }, {});
  
  report += `## File Type Statistics\n\n`;
  report += `| File Type | Total Files | With Marketing Content | Percentage |\n`;
  report += `|-----------|-------------|----------------------|------------|\n`;
  
  Object.entries(fileTypeStats)
    .sort((a: any, b: any) => b[1].withContent - a[1].withContent)
    .forEach(([type, stats]: [string, any]) => {
      const percentage = ((stats.withContent / stats.total) * 100).toFixed(1);
      report += `| ${type} | ${stats.total} | ${stats.withContent} | ${percentage}% |\n`;
    });
  
  report += `\n`;
  
  if (type === 'detailed') {
    // Top marketing content items
    report += `## Top Marketing Content Items\n\n`;
    
    marketingContent.slice(0, 50).forEach((item: any, index: number) => {
      report += `### ${index + 1}. ${item.type} in ${item.file}:${item.lineNumber}\n\n`;
      report += `**Content**: \`${item.content}\`\n\n`;
      report += `**Context**:\n\n\`\`\`\n${item.context}\n\`\`\`\n\n`;
    });
    
    // Files with marketing content
    report += `## Files With Marketing Content\n\n`;
    report += `| File Path | Type | Content Count |\n`;
    report += `|-----------|------|--------------|\n`;
    
    filesWithContent.forEach((file: any) => {
      const contentCount = marketingContent.filter((item: any) => item.path === file.path).length;
      report += `| ${file.path} | ${file.type} | ${contentCount} |\n`;
    });
  }
  
  return report;
}

function generateHtmlReport(result: any, type: string): string {
  // Basic HTML conversion from markdown
  const markdown = generateMarkdownReport(result, type);
  let html = '<!DOCTYPE html>\n<html>\n<head>\n';
  html += '<meta charset="UTF-8">\n';
  html += '<title>Marketing Content Analysis</title>\n';
  html += '<style>\n';
  html += 'body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 1200px; margin: 0 auto; padding: 20px; }\n';
  html += 'table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }\n';
  html += 'th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }\n';
  html += 'th { background-color: #f2f2f2; }\n';
  html += 'tr:nth-child(even) { background-color: #f9f9f9; }\n';
  html += 'h1, h2, h3 { color: #333; }\n';
  html += 'code { background-color: #f5f5f5; padding: 2px 4px; border-radius: 4px; }\n';
  html += 'pre { background-color: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; }\n';
  html += '</style>\n';
  html += '</head>\n<body>\n';
  
  // Very simple markdown to HTML conversion
  let content = markdown
    .replace(/^# (.*)/gm, '<h1>$1</h1>')
    .replace(/^## (.*)/gm, '<h2>$1</h2>')
    .replace(/^### (.*)/gm, '<h3>$1</h3>')
    .replace(/^\| .*\|$/gm, (match) => {
      // Convert markdown table to HTML table
      if (match.includes('---')) {
        return ''; // Skip the separator line
      }
      
      const cells = match.split('|').slice(1, -1).map(cell => cell.trim());
      
      if (match.includes('Type | Count')) {
        return '<table><thead><tr>' + cells.map(cell => `<th>${cell}</th>`).join('') + '</tr></thead><tbody>';
      } else if (match.includes('File Type | Total')) {
        return '<table><thead><tr>' + cells.map(cell => `<th>${cell}</th>`).join('') + '</tr></thead><tbody>';
      } else if (match.includes('File Path | Type')) {
        return '<table><thead><tr>' + cells.map(cell => `<th>${cell}</th>`).join('') + '</tr></thead><tbody>';
      } else {
        return '<tr>' + cells.map(cell => `<td>${cell}</td>`).join('') + '</tr>';
      }
    })
    .replace(/^([^<].*)/gm, '<p>$1</p>') // Simple paragraph conversion
    .replace(/`([^`]+)`/g, '<code>$1</code>') // Inline code
    .replace(/```\n([\s\S]*?)\n```/g, '<pre>$1</pre>') // Code blocks
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'); // Bold text
  
  // Replace consecutive </tr><tr> with just </tr><tr>
  content = content.replace(/<\/tr><p><tr>/g, '</tr><tr>');
  
  // Add closing tbody and table tags
  content = content.replace(/<\/tr>(?!<tr>)/g, '</tr></tbody></table>');
  
  html += content;
  html += '\n</body>\n</html>';
  
  return html;
}

function generateTextReport(result: any, type: string): string {
  const { marketingContent, fileMap } = result;
  const filesWithContent = fileMap.filter((f: any) => f.hasMarketingContent);
  
  let report = 'SOURCE CODE MARKETING CONTENT ANALYSIS\n\n';
  
  report += `SUMMARY\n${'-'.repeat(30)}\n`;
  report += `Total Files Analyzed: ${fileMap.length}\n`;
  report += `Files With Marketing Content: ${filesWithContent.length} (${((filesWithContent.length / fileMap.length) * 100).toFixed(1)}%)\n`;
  report += `Total Marketing Content Items: ${marketingContent.length}\n\n`;
  
  // Content type distribution
  const typeDistribution = marketingContent.reduce((acc: any, item: any) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});
  
  report += `CONTENT TYPE DISTRIBUTION\n${'-'.repeat(30)}\n`;
  report += `Type       | Count | Percentage\n`;
  report += `${'-'.repeat(10)}|${'-'.repeat(7)}|${'-'.repeat(12)}\n`;
  
  Object.entries(typeDistribution)
    .sort((a: any, b: any) => b[1] - a[1])
    .forEach(([type, count]: [string, any]) => {
      const percentage = ((count / marketingContent.length) * 100).toFixed(1);
      report += `${type.padEnd(10)} | ${String(count).padEnd(5)} | ${percentage}%\n`;
    });
  
  report += `\n`;
  
  // File type statistics
  const fileTypeStats = fileMap.reduce((acc: any, file: any) => {
    if (!acc[file.type]) {
      acc[file.type] = { total: 0, withContent: 0 };
    }
    acc[file.type].total++;
    if (file.hasMarketingContent) {
      acc[file.type].withContent++;
    }
    return acc;
  }, {});
  
  report += `FILE TYPE STATISTICS\n${'-'.repeat(30)}\n`;
  report += `File Type  | Total | With Content | Percentage\n`;
  report += `${'-'.repeat(10)}|${'-'.repeat(7)}|${'-'.repeat(14)}|${'-'.repeat(12)}\n`;
  
  Object.entries(fileTypeStats)
    .sort((a: any, b: any) => b[1].withContent - a[1].withContent)
    .forEach(([type, stats]: [string, any]) => {
      const percentage = ((stats.withContent / stats.total) * 100).toFixed(1);
      report += `${type.padEnd(10)} | ${String(stats.total).padEnd(5)} | ${String(stats.withContent).padEnd(12)} | ${percentage}%\n`;
    });
  
  report += `\n`;
  
  if (type === 'detailed') {
    // Top marketing content items
    report += `TOP MARKETING CONTENT ITEMS\n${'-'.repeat(30)}\n`;
    
    marketingContent.slice(0, 30).forEach((item: any, index: number) => {
      report += `${index + 1}. ${item.type.toUpperCase()} in ${item.file}:${item.lineNumber}\n`;
      report += `   "${item.content}"\n`;
      report += `   Context: ${item.context.split('\n')[0]}...\n\n`;
    });
    
    // Files with marketing content
    report += `FILES WITH MARKETING CONTENT\n${'-'.repeat(30)}\n`;
    report += `Path${' '.repeat(50)} | Type${' '.repeat(8)} | Content Count\n`;
    report += `${'-'.repeat(54)}|${'-'.repeat(12)}|${'-'.repeat(14)}\n`;
    
    filesWithContent.forEach((file: any) => {
      const contentCount = marketingContent.filter((item: any) => item.path === file.path).length;
      const path = file.path.length > 50 ? file.path.substring(0, 47) + '...' : file.path.padEnd(54);
      report += `${path} | ${file.type.padEnd(12)} | ${contentCount}\n`;
    });
  }
  
  return report;
}

program.parse();
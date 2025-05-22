/**
 * Initialize Steelpush configuration command
 */

import { Command } from 'commander';
import fs from 'fs';
import { getConfigPath, saveConfig } from '../utils/config';

export function initCommand(program: Command): Command {
  const configPath = getConfigPath();
  
  return program
    .command('init')
    .description('Initialize Steelpush configuration')
    .option('-k, --api-key <key>', 'API key for the selected provider')
    .option('-p, --provider <provider>', 'AI provider (anthropic or openai)', 'anthropic')
    .option('-m, --model <model>', 'AI model to use')
    .action(async (options) => {
      console.log('Initializing Steelpush...');
      
      // Set default model based on provider
      const defaultModel = options.provider === 'anthropic' ? 
        'claude-3-7-sonnet-20250219' : 
        'gpt-4-turbo';
      
      const model = options.model || defaultModel;
      
      // Determine which environment variable to check
      const envVarName = options.provider === 'anthropic' ? 
        'ANTHROPIC_API_KEY' : 
        'OPENAI_API_KEY';
        
      // Get API key if not provided
      let apiKey = options.apiKey || process.env[envVarName];
      if (!apiKey) {
        const { default: inquirer } = await import('inquirer');
        const answers = await inquirer.prompt([
          {
            type: 'password',
            name: 'apiKey',
            message: `Enter your ${options.provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API key:`,
            validate: (input: string) =>
              input.length > 0 ? true : 'API key is required',
          },
        ]);
        apiKey = answers.apiKey;
      }

      // Create config
      const config = {
        ai: {
          provider: options.provider,
          model: model,
          apiKey,
        },
        simulation: {
          visitorCount: 10,
          personaCount: 3,
        },
        analysis: {
          optimizableElements: ['headlines', 'cta', 'value-props'],
          confidenceThreshold: 0.85,
        },
      };

      // Save config
      saveConfig(config);
      console.log(`Configuration saved to ${configPath}`);

      // Also save to .env for current session
      fs.writeFileSync('.env', `${envVarName}=${apiKey}\n`);
      console.log(`API key saved to .env as ${envVarName} for current session`);

      console.log('\nSteelpush initialized successfully!');
      console.log(`Using provider: ${options.provider}`);
      console.log(`Using model: ${model}`);
    });
}
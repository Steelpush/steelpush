/**
 * Configuration utilities
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Gets the configuration directory path
 */
export function getConfigDir(): string {
  const configDir = path.join(
    process.env.HOME || process.env.USERPROFILE || os.homedir(),
    '.steelpush'
  );
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  return configDir;
}

/**
 * Gets the configuration file path
 */
export function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.json');
}

/**
 * Loads the configuration
 */
export function loadConfig(): any {
  const configPath = getConfigPath();
  
  if (!fs.existsSync(configPath)) {
    return null;
  }
  
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (error) {
    console.error('Error loading config:', error);
    return null;
  }
}

/**
 * Saves the configuration
 */
export function saveConfig(config: any): void {
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}
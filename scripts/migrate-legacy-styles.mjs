#!/usr/bin/env node

/**
 * Migrate legacy Tailwind color classes to semantic design system tokens
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color mapping: legacy → semantic
const replacements = [
  // Backgrounds
  { pattern: /bg-blue-(500|600|700)/g, replacement: 'bg-brand' },
  { pattern: /bg-purple-(500|600|700)/g, replacement: 'bg-brand' },
  { pattern: /bg-gray-50\b/g, replacement: 'bg-surface-2' },
  { pattern: /bg-gray-100\b/g, replacement: 'bg-surface-2' },
  { pattern: /bg-gray-200\b/g, replacement: 'bg-surface-3' },
  { pattern: /bg-white\b/g, replacement: 'bg-surface-1' },
  { pattern: /bg-green-(50|100)/g, replacement: 'bg-success-soft' },
  { pattern: /bg-red-(50|100)/g, replacement: 'bg-danger-soft' },
  { pattern: /bg-yellow-(50|100)/g, replacement: 'bg-warn-soft' },
  { pattern: /bg-amber-(50|100)/g, replacement: 'bg-warn-soft' },
  { pattern: /bg-blue-(50|100)/g, replacement: 'bg-brand-soft' },
  
  // Text colors
  { pattern: /text-blue-(600|700|800|900)/g, replacement: 'text-brand' },
  { pattern: /text-purple-(600|700|800|900)/g, replacement: 'text-brand' },
  { pattern: /text-gray-900\b/g, replacement: '' }, // default ink color
  { pattern: /text-gray-(600|700)/g, replacement: 'muted' },
  { pattern: /text-gray-(400|500)/g, replacement: 'subtle' },
  { pattern: /text-green-(600|700|800)/g, replacement: 'text-success' },
  { pattern: /text-red-(600|700|800)/g, replacement: 'text-danger' },
  { pattern: /text-yellow-(600|700|800)/g, replacement: 'text-warn' },
  { pattern: /text-amber-(600|700|800)/g, replacement: 'text-warn' },
  
  // Borders
  { pattern: /border-gray-(200|300)/g, replacement: 'border-border' },
  { pattern: /border-blue-(300|400|500)/g, replacement: 'border-brand' },
  { pattern: /border-green-(200|300)/g, replacement: 'border-success' },
  { pattern: /border-red-(200|300)/g, replacement: 'border-danger' },
  { pattern: /border-yellow-(200|300)/g, replacement: 'border-warn' },
  { pattern: /border-amber-(200|300)/g, replacement: 'border-warn' },
  
  // Hover states
  { pattern: /hover:bg-blue-(600|700|800)/g, replacement: 'hover:bg-brand' },
  { pattern: /hover:text-blue-(700|800|900)/g, replacement: 'hover:text-brand' },
  { pattern: /hover:border-blue-(400|500)/g, replacement: 'hover:border-brand' },
  { pattern: /hover:bg-gray-50\b/g, replacement: 'hover:bg-surface-2' },
  { pattern: /hover:bg-gray-100\b/g, replacement: 'hover:bg-surface-2' },
  
  // Focus states
  { pattern: /focus:ring-blue-(500|600)/g, replacement: 'focus:ring-brand' },
  { pattern: /focus:border-blue-(500|600)/g, replacement: 'focus:border-brand' },
  
  // Pills/badges
  { pattern: /bg-green-100 text-green-800/g, replacement: 'pill-success' },
  { pattern: /bg-red-100 text-red-800/g, replacement: 'pill-danger' },
  { pattern: /bg-yellow-100 text-yellow-800/g, replacement: 'pill-warn' },
  { pattern: /bg-amber-100 text-amber-800/g, replacement: 'pill-warn' },
  { pattern: /bg-blue-100 text-blue-800/g, replacement: 'pill-brand' },
  { pattern: /bg-purple-100 text-purple-700/g, replacement: 'pill-brand' },
  
  // Buttons
  { pattern: /bg-blue-600 hover:bg-blue-700 text-white/g, replacement: 'btn-primary' },
  { pattern: /text-blue-600 hover:text-blue-900/g, replacement: 'text-brand hover:underline' },
];

function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules') {
        walkDir(filePath, callback);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      callback(filePath);
    }
  }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  for (const { pattern, replacement } of replacements) {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Updated: ${path.relative(process.cwd(), filePath)}`);
    return 1;
  }
  
  return 0;
}

// Process app directory
const appDir = path.join(__dirname, '../apps/app/src');

console.log(`Scanning ${appDir}...\n`);

let updatedCount = 0;
walkDir(appDir, (file) => {
  updatedCount += processFile(file);
});

console.log(`\n✨ Complete! Updated ${updatedCount} files with semantic design tokens.`);


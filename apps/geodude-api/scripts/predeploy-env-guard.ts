#!/usr/bin/env tsx

/**
 * Predeploy Environment Guard
 * 
 * This script prevents deployment when there's a mismatch between:
 * - wrangler.toml configuration
 * - running worker's /admin/env-check
 * 
 * Usage: tsx scripts/predeploy-env-guard.ts <environment>
 * Example: tsx scripts/predeploy-env-guard.ts production
 */

import { parse } from '@iarna/toml';
import { readFileSync } from 'fs';
import { join } from 'path';

interface WranglerConfig {
  env?: {
    [key: string]: {
      vars?: Record<string, string>;
    };
  };
}

interface EnvCheckResponse {
  environment: string;
  config: Record<string, string>;
  missing: string[];
  errors: string[];
}

async function main() {
  const targetEnv = process.argv[2];

  if (!targetEnv) {
    console.error('❌ Error: Environment argument required');
    console.error('Usage: tsx scripts/predeploy-env-guard.ts <environment>');
    console.error('Example: tsx scripts/predeploy-env-guard.ts production');
    process.exit(1);
  }

  console.log(`🔍 Checking environment configuration for: ${targetEnv}`);

  try {
    // 1. Load wrangler.toml configuration
    const wranglerPath = join(process.cwd(), 'wrangler.toml');
    const wranglerContent = readFileSync(wranglerPath, 'utf-8');
    const wranglerConfig = parse(wranglerContent) as WranglerConfig;

    // 2. Get environment variables from wrangler.toml
    const wranglerVars = wranglerConfig.env?.[targetEnv]?.vars || {};

    if (Object.keys(wranglerVars).length === 0) {
      console.error(`❌ Error: No variables found for environment '${targetEnv}' in wrangler.toml`);
      process.exit(1);
    }

    console.log(`📋 Found ${Object.keys(wranglerVars).length} variables in wrangler.toml`);

    // 3. Get current worker configuration via /admin/env-check
    const envCheckUrl = getEnvCheckUrl(targetEnv);
    console.log(`🔗 Checking worker at: ${envCheckUrl}`);

    const response = await fetch(envCheckUrl);

    if (!response.ok) {
      console.error(`❌ Error: Failed to fetch /admin/env-check from ${envCheckUrl}`);
      console.error(`Status: ${response.status} ${response.statusText}`);
      process.exit(1);
    }

    const envCheck: EnvCheckResponse = await response.json();
    console.log(`✅ Worker responded with ${Object.keys(envCheck.config).length} variables`);

    // 4. Compare configurations
    const drift = compareConfigurations(wranglerVars, envCheck.config);

    if (drift.length > 0) {
      console.error('\n❌ CONFIGURATION DRIFT DETECTED!');
      console.error('The following variables have different values:');

      drift.forEach(({ key, wranglerValue, workerValue }) => {
        console.error(`  ${key}:`);
        console.error(`    wrangler.toml: "${wranglerValue}"`);
        console.error(`    worker:        "${workerValue}"`);
      });

      console.error('\n🚫 Deployment aborted. Please fix the configuration drift first.');
      console.error('This usually means:');
      console.error('  1. Variables were changed in Cloudflare dashboard');
      console.error('  2. wrangler.toml is out of sync');
      console.error('  3. Worker needs to be redeployed with current config');

      process.exit(1);
    }

    console.log('\n✅ No configuration drift detected');
    console.log('🚀 Ready to deploy!');

  } catch (error) {
    console.error('❌ Error during environment check:', error);
    process.exit(1);
  }
}

function getEnvCheckUrl(environment: string): string {
  const baseUrls = {
    production: 'https://api.optiview.ai',
    staging: 'https://staging.api.optiview.ai',
    test: 'http://127.0.0.1:8787'
  };

  const baseUrl = baseUrls[environment as keyof typeof baseUrls];
  if (!baseUrl) {
    throw new Error(`Unknown environment: ${environment}`);
  }

  return `${baseUrl}/admin/env-check`;
}

function compareConfigurations(
  wranglerVars: Record<string, string>,
  workerVars: Record<string, string>
): Array<{ key: string; wranglerValue: string; workerValue: string }> {
  const drift: Array<{ key: string; wranglerValue: string; workerValue: string }> = [];

  // Check for differences in wrangler.toml variables
  for (const [key, wranglerValue] of Object.entries(wranglerVars)) {
    const workerValue = workerVars[key];

    if (workerValue === undefined) {
      console.warn(`⚠️  Warning: Variable '${key}' not found in worker (may be new)`);
      continue;
    }

    if (wranglerValue !== workerValue) {
      drift.push({ key, wranglerValue, workerValue });
    }
  }

  return drift;
}

// Run the script
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

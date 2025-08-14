/**
 * Centralized Configuration Management
 * 
 * This file centralizes all environment variable handling, provides type safety,
 * and validates required configuration on startup.
 */

export interface Config {
  // Core settings
  NODE_ENV: 'development' | 'production' | 'test';
  CSP_MODE: 'development' | 'production';
  TEST_MODE: boolean;
  DEV_MAIL_ECHO: boolean;
  
  // URLs
  PUBLIC_APP_URL: string;
  PUBLIC_BASE_URL: string;
  
  // Auth & session
  SESSION_TTL_HOURS: number;
  OTP_EXP_MIN: number;
  MAGIC_LINK_EXP_MIN: number;
  MAGIC_LINK_RPM_PER_IP: number;
  MAGIC_LINK_RPD_PER_EMAIL: number;
  INVITE_EXP_DAYS: number;
  ADMIN_RPM_PER_IP: number;
  
  // Rate limiting
  INGEST_RATE_LIMIT_RPS: number;
  INGEST_RATE_LIMIT_BURST: number;
  RATE_LIMIT_RETRY_AFTER: number;
  CSV_EXPORT_RATE_LIMIT_RPS: number;
  RULES_REFRESH_TTL_SEC: number;
  
  // Email settings
  EMAIL_SENDER_NAME: string;
  EMAIL_FROM: string;
  
  // Secrets (optional, may be undefined)
  SESSION_SECRET?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SLACK_WEBHOOK_URL?: string;
}

// Default configuration values
const DEFAULT_CONFIG: Partial<Config> = {
  NODE_ENV: 'development',
  CSP_MODE: 'development',
  TEST_MODE: true,
  DEV_MAIL_ECHO: true,
  
  PUBLIC_APP_URL: 'http://localhost:3000',
  PUBLIC_BASE_URL: 'http://127.0.0.1:8787',
  
  SESSION_TTL_HOURS: 24,
  OTP_EXP_MIN: 60,
  MAGIC_LINK_EXP_MIN: 60,
  MAGIC_LINK_RPM_PER_IP: 50,
  MAGIC_LINK_RPD_PER_EMAIL: 200,
  INVITE_EXP_DAYS: 7,
  ADMIN_RPM_PER_IP: 300,
  
  INGEST_RATE_LIMIT_RPS: 100,
  INGEST_RATE_LIMIT_BURST: 500,
  RATE_LIMIT_RETRY_AFTER: 1,
  CSV_EXPORT_RATE_LIMIT_RPS: 20,
  RULES_REFRESH_TTL_SEC: 30,
  
  EMAIL_SENDER_NAME: 'Optiview (Test)',
  EMAIL_FROM: 'test@optiview.ai',
};

// Required configuration keys for production
const REQUIRED_PRODUCTION_KEYS: (keyof Config)[] = [
  'SESSION_SECRET',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
];

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(env: Record<string, any>): Config {
  const config: Config = { ...DEFAULT_CONFIG } as Config;
  
  // Helper function to parse string values
  const parseString = (key: string, value: string | undefined): string => {
    if (!value) {
      throw new Error(`Missing required configuration: ${key}`);
    }
    return value;
  };
  
  const parseNumber = (key: string, value: string | undefined, defaultValue: number): number => {
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new Error(`Invalid number for configuration ${key}: ${value}`);
    }
    return parsed;
  };
  
  const parseBoolean = (key: string, value: string | undefined, defaultValue: boolean): boolean => {
    if (!value) return defaultValue;
    return value === '1' || value === 'true';
  };
  
  // Load and parse configuration values
  config.NODE_ENV = parseString('NODE_ENV', env.NODE_ENV) as Config['NODE_ENV'];
  config.CSP_MODE = parseString('CSP_MODE', env.CSP_MODE) as Config['CSP_MODE'];
  config.TEST_MODE = parseBoolean('TEST_MODE', env.TEST_MODE, config.TEST_MODE);
  config.DEV_MAIL_ECHO = parseBoolean('DEV_MAIL_ECHO', env.DEV_MAIL_ECHO, config.DEV_MAIL_ECHO);
  
  config.PUBLIC_APP_URL = parseString('PUBLIC_APP_URL', env.PUBLIC_APP_URL);
  config.PUBLIC_BASE_URL = parseString('PUBLIC_BASE_URL', env.PUBLIC_BASE_URL);
  
  config.SESSION_TTL_HOURS = parseNumber('SESSION_TTL_HOURS', env.SESSION_TTL_HOURS, config.SESSION_TTL_HOURS);
  config.OTP_EXP_MIN = parseNumber('OTP_EXP_MIN', env.OTP_EXP_MIN, config.OTP_EXP_MIN);
  config.MAGIC_LINK_EXP_MIN = parseNumber('MAGIC_LINK_EXP_MIN', env.MAGIC_LINK_EXP_MIN, config.MAGIC_LINK_EXP_MIN);
  config.MAGIC_LINK_RPM_PER_IP = parseNumber('MAGIC_LINK_RPM_PER_IP', env.MAGIC_LINK_RPM_PER_IP, config.MAGIC_LINK_RPM_PER_IP);
  config.MAGIC_LINK_RPD_PER_EMAIL = parseNumber('MAGIC_LINK_RPD_PER_EMAIL', env.MAGIC_LINK_RPD_PER_EMAIL, config.MAGIC_LINK_RPD_PER_EMAIL);
  config.INVITE_EXP_DAYS = parseNumber('INVITE_EXP_DAYS', env.INVITE_EXP_DAYS, config.INVITE_EXP_DAYS);
  config.ADMIN_RPM_PER_IP = parseNumber('ADMIN_RPM_PER_IP', env.ADMIN_RPM_PER_IP, config.ADMIN_RPM_PER_IP);
  
  config.INGEST_RATE_LIMIT_RPS = parseNumber('INGEST_RATE_LIMIT_RPS', env.INGEST_RATE_LIMIT_RPS, config.INGEST_RATE_LIMIT_RPS);
  config.INGEST_RATE_LIMIT_BURST = parseNumber('INGEST_RATE_LIMIT_BURST', env.INGEST_RATE_LIMIT_BURST, config.INGEST_RATE_LIMIT_BURST);
  config.RATE_LIMIT_RETRY_AFTER = parseNumber('RATE_LIMIT_RETRY_AFTER', env.RATE_LIMIT_RETRY_AFTER, config.RATE_LIMIT_RETRY_AFTER);
  config.CSV_EXPORT_RATE_LIMIT_RPS = parseNumber('CSV_EXPORT_RATE_LIMIT_RPS', env.CSV_EXPORT_RATE_LIMIT_RPS, config.CSV_EXPORT_RATE_LIMIT_RPS);
  config.RULES_REFRESH_TTL_SEC = parseNumber('RULES_REFRESH_TTL_SEC', env.RULES_REFRESH_TTL_SEC, config.RULES_REFRESH_TTL_SEC);
  
  config.EMAIL_SENDER_NAME = parseString('EMAIL_SENDER_NAME', env.EMAIL_SENDER_NAME);
  config.EMAIL_FROM = parseString('EMAIL_FROM', env.EMAIL_FROM);
  
  // Optional secrets
  config.SESSION_SECRET = env.SESSION_SECRET;
  config.SMTP_HOST = env.SMTP_HOST;
  config.SMTP_PORT = env.SMTP_PORT;
  config.SMTP_USER = env.SMTP_USER;
  config.SMTP_PASS = env.SMTP_PASS;
  config.SLACK_WEBHOOK_URL = env.SLACK_WEBHOOK_URL;
  
  // Validate production requirements
  if (config.NODE_ENV === 'production') {
    const missingKeys = REQUIRED_PRODUCTION_KEYS.filter(key => !config[key]);
    if (missingKeys.length > 0) {
      throw new Error(`Production environment missing required secrets: ${missingKeys.join(', ')}`);
    }
  }
  
  return config;
}

/**
 * Get configuration for environment check endpoint
 */
export function getConfigForEnvCheck(config: Config): Record<string, string> {
  const envCheck: Record<string, string> = {};
  
  // Add all non-secret configuration values
  Object.entries(config).forEach(([key, value]) => {
    if (value !== undefined && !isSecretKey(key)) {
      envCheck[key] = String(value);
    }
  });
  
  return envCheck;
}

/**
 * Check if a configuration key contains sensitive information
 */
function isSecretKey(key: string): boolean {
  const secretKeys = [
    'SESSION_SECRET',
    'SMTP_HOST',
    'SMTP_PORT', 
    'SMTP_USER',
    'SMTP_PASS',
    'SLACK_WEBHOOK_URL',
  ];
  
  return secretKeys.includes(key);
}

/**
 * Get missing required configuration keys
 */
export function getMissingConfigKeys(config: Config): string[] {
  if (config.NODE_ENV !== 'production') {
    return [];
  }
  
  return REQUIRED_PRODUCTION_KEYS.filter(key => !config[key]);
}

/**
 * Get configuration errors
 */
export function getConfigErrors(config: Config): string[] {
  const errors: string[] = [];
  
  // Check for missing production secrets
  if (config.NODE_ENV === 'production') {
    const missingSecrets = getMissingConfigKeys(config);
    if (missingSecrets.length > 0) {
      errors.push(`Missing required secrets: ${missingSecrets.join(', ')}`);
    }
  }
  
  // Validate URL formats
  try {
    new URL(config.PUBLIC_APP_URL);
  } catch {
    errors.push(`Invalid PUBLIC_APP_URL: ${config.PUBLIC_APP_URL}`);
  }
  
  try {
    new URL(config.PUBLIC_BASE_URL);
  } catch {
    errors.push(`Invalid PUBLIC_BASE_URL: ${config.PUBLIC_BASE_URL}`);
  }
  
  // Validate numeric ranges
  if (config.SESSION_TTL_HOURS < 1 || config.SESSION_TTL_HOURS > 8760) {
    errors.push(`SESSION_TTL_HOURS must be between 1 and 8760, got: ${config.SESSION_TTL_HOURS}`);
  }
  
  if (config.MAGIC_LINK_EXP_MIN < 1 || config.MAGIC_LINK_EXP_MIN > 1440) {
    errors.push(`MAGIC_LINK_EXP_MIN must be between 1 and 1440, got: ${config.MAGIC_LINK_EXP_MIN}`);
  }
  
  return errors;
}

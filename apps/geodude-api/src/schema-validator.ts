// Schema validation utilities for strict API payload validation
// Enforces field allowlists, size limits, and enum validation

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedData?: any;
}

export interface FieldRule {
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  maxLength?: number;
  enum?: string[];
  nestedRules?: Record<string, FieldRule | number>;
}

export interface EndpointSchema {
  maxBodySizeKB: number;
  allowedFields: Record<string, FieldRule>;
  requiredFields: string[];
}

// Schema definitions for each endpoint
export const ENDPOINT_SCHEMAS: Record<string, EndpointSchema> = {
  '/api/events': {
    maxBodySizeKB: 1,
    allowedFields: {
      project_id: { required: true, type: 'number' },
      property_id: { required: true, type: 'number' },
      content_id: { required: false, type: 'number' },
      ai_source_id: { required: false, type: 'number' },
      event_type: { 
        required: true, 
        type: 'string',
        enum: ['view', 'click', 'purchase', 'custom']
      },
      metadata: { 
        required: false, 
        type: 'object',
        maxLength: 512, // 512 chars for metadata
        nestedRules: {
          // Limit metadata keys and values
          _maxKeys: 20,
          _maxValueLength: 200
        }
      }
    },
    requiredFields: ['project_id', 'property_id', 'event_type']
  },

  '/api/referrals': {
    maxBodySizeKB: 1,
    allowedFields: {
      ai_source_id: { required: true, type: 'number' },
      content_id: { required: false, type: 'number' },
      ref_type: { 
        required: true, 
        type: 'string',
        enum: ['direct', 'summary', 'citation', 'observation']
      },
      detected_at: { required: false, type: 'number' }
    },
    requiredFields: ['ai_source_id', 'ref_type']
  },

  '/api/content': {
    maxBodySizeKB: 1,
    allowedFields: {
      property_id: { required: true, type: 'number' },
      url: { required: true, type: 'string', maxLength: 500 },
      type: { required: false, type: 'string', maxLength: 50 },
      metadata: { 
        required: false, 
        type: 'object',
        maxLength: 512,
        nestedRules: {
          _maxKeys: 20,
          _maxValueLength: 200
        }
      }
    },
    requiredFields: ['property_id', 'url']
  }
};

/**
 * Validate request body against endpoint schema
 */
export function validateRequestBody(
  endpoint: string, 
  body: any, 
  bodySize: number
): ValidationResult {
  const schema = ENDPOINT_SCHEMAS[endpoint];
  if (!schema) {
    return {
      valid: false,
      errors: [`Unknown endpoint: ${endpoint}`]
    };
  }

  const errors: string[] = [];

  // Check body size
  if (bodySize > schema.maxBodySizeKB * 1024) {
    errors.push(`Request body too large: ${Math.round(bodySize / 1024)}KB (max ${schema.maxBodySizeKB}KB)`);
  }

  // Check required fields
  for (const field of schema.requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate and sanitize allowed fields
  const sanitizedData: any = {};
  for (const [field, rule] of Object.entries(schema.allowedFields)) {
    if (body[field] !== undefined) {
      const validation = validateField(field, body[field], rule);
      if (validation.valid) {
        sanitizedData[field] = validation.value;
      } else {
        errors.push(...validation.errors);
      }
    }
  }

  // Check for unknown fields
  const allowedFieldNames = Object.keys(schema.allowedFields);
  for (const field of Object.keys(body)) {
    if (!allowedFieldNames.includes(field)) {
      errors.push(`Unknown field: ${field}`);
    }
  }

  // Check for PII-looking keys in metadata
  if (body.metadata && typeof body.metadata === 'object') {
    const piiKeys = detectPIIKeys(body.metadata);
    if (piiKeys.length > 0) {
      errors.push(`PII-looking keys detected and dropped: ${piiKeys.join(', ')}`);
      // Remove PII keys from sanitized data
      if (sanitizedData.metadata) {
        piiKeys.forEach(key => delete sanitizedData.metadata[key]);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitizedData: errors.length === 0 ? sanitizedData : undefined
  };
}

/**
 * Validate a single field against its rules
 */
function validateField(fieldName: string, value: any, rule: FieldRule): { valid: boolean; value: any; errors: string[] } {
  const errors: string[] = [];

  // Type validation
  if (!validateType(value, rule.type)) {
    errors.push(`Field ${fieldName} must be of type ${rule.type}`);
    return { valid: false, value: undefined, errors };
  }

  // String length validation
  if (rule.type === 'string' && rule.maxLength && typeof value === 'string') {
    if (value.length > rule.maxLength) {
      errors.push(`Field ${fieldName} too long: ${value.length} chars (max ${rule.maxLength})`);
      return { valid: false, value: undefined, errors };
    }
  }

  // Enum validation
  if (rule.enum && !rule.enum.includes(value)) {
    errors.push(`Field ${fieldName} must be one of: ${rule.enum.join(', ')}`);
    return { valid: false, value: undefined, errors };
  }

  // Nested object validation
  if (rule.type === 'object' && rule.nestedRules && typeof value === 'object') {
    const nestedValidation = validateNestedObject(value, rule.nestedRules);
    if (!nestedValidation.valid) {
      errors.push(...nestedValidation.errors);
      return { valid: false, value: undefined, errors };
    }
  }

  return { valid: true, value, errors };
}

/**
 * Validate nested object against nested rules
 */
function validateNestedObject(obj: any, rules: Record<string, FieldRule | number>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check max keys
  const maxKeys = rules._maxKeys as number;
  if (maxKeys && Object.keys(obj).length > maxKeys) {
    errors.push(`Too many metadata keys: ${Object.keys(obj).length} (max ${maxKeys})`);
  }

  // Check max value length
  const maxValueLength = rules._maxValueLength as number;
  if (maxValueLength) {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && value.length > maxValueLength) {
        errors.push(`Metadata value too long for key '${key}': ${value.length} chars (max ${maxValueLength})`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate value type
 */
function validateType(value: any, expectedType: string): boolean {
  switch (expectedType) {
    case 'string': return typeof value === 'string';
    case 'number': return typeof value === 'number' && !isNaN(value);
    case 'boolean': return typeof value === 'boolean';
    case 'object': return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array': return Array.isArray(value);
    default: return false;
  }
}

/**
 * Detect PII-looking keys in metadata
 */
function detectPIIKeys(metadata: any): string[] {
  const piiPatterns = [
    /email/i, /phone/i, /ssn/i, /credit.?card/i, /password/i, /token/i,
    /address/i, /zip/i, /postal/i, /city/i, /state/i, /country/i,
    /first.?name/i, /last.?name/i, /full.?name/i, /username/i
  ];

  const piiKeys: string[] = [];
  for (const key of Object.keys(metadata)) {
    if (piiPatterns.some(pattern => pattern.test(key))) {
      piiKeys.push(key);
    }
  }

  return piiKeys;
}

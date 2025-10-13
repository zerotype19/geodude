/**
 * Schema Fitness Validator - Phase Next
 * Validates JSON-LD schema based on page type and required properties
 */

export interface SchemaFitnessResult {
  fitness: number; // 0-100%
  type: string;
  valid: boolean;
  requiredProps: string[];
  missingProps: string[];
  errors: string[];
}

export function validateSchemaFitness(
  html: string,
  pageType: string
): SchemaFitnessResult {
  const jsonLdBlocks = extractJsonLdBlocks(html);
  const schemas = parseJsonLdSchemas(jsonLdBlocks);
  
  if (schemas.length === 0) {
    return {
      fitness: 0,
      type: 'none',
      valid: false,
      requiredProps: [],
      missingProps: [],
      errors: ['No JSON-LD schemas found']
    };
  }
  
  // Find the most relevant schema for the page type
  const relevantSchema = findRelevantSchema(schemas, pageType);
  
  if (!relevantSchema) {
    return {
      fitness: 0,
      type: 'mismatch',
      valid: false,
      requiredProps: [],
      missingProps: [],
      errors: [`No schema found for page type: ${pageType}`]
    };
  }
  
  // Validate against type requirements
  const validation = validateSchemaType(relevantSchema, pageType);
  
  return {
    fitness: validation.fitness,
    type: relevantSchema['@type'] || 'unknown',
    valid: validation.valid,
    requiredProps: validation.requiredProps,
    missingProps: validation.missingProps,
    errors: validation.errors
  };
}

function extractJsonLdBlocks(html: string): string[] {
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis;
  const blocks: string[] = [];
  let match;
  
  while ((match = jsonLdRegex.exec(html)) !== null) {
    blocks.push(match[1].trim());
  }
  
  return blocks;
}

function parseJsonLdSchemas(blocks: string[]): any[] {
  const schemas: any[] = [];
  
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block);
      if (Array.isArray(parsed)) {
        schemas.push(...parsed);
      } else {
        schemas.push(parsed);
      }
    } catch (error) {
      // Skip invalid JSON
      continue;
    }
  }
  
  return schemas;
}

function findRelevantSchema(schemas: any[], pageType: string): any | null {
  const typeMapping: Record<string, string[]> = {
    'article': ['Article', 'NewsArticle', 'BlogPosting'],
    'product': ['Product', 'IndividualProduct'],
    'faq': ['FAQPage', 'Question'],
    'howto': ['HowTo', 'Recipe'],
    'about': ['Organization', 'Person', 'AboutPage'],
    'qapage': ['QAPage', 'Question', 'Answer']
  };
  
  const expectedTypes = typeMapping[pageType] || [];
  
  // Find schema with matching type
  for (const schema of schemas) {
    const schemaType = schema['@type'];
    if (schemaType && expectedTypes.some(type => schemaType.includes(type))) {
      return schema;
    }
  }
  
  // Fallback to first schema
  return schemas[0] || null;
}

function validateSchemaType(schema: any, pageType: string): {
  fitness: number;
  valid: boolean;
  requiredProps: string[];
  missingProps: string[];
  errors: string[];
} {
  const requirements = getSchemaRequirements(pageType);
  const requiredProps = requirements.required;
  const optionalProps = requirements.optional;
  
  const missingProps: string[] = [];
  const errors: string[] = [];
  
  // Check required properties
  for (const prop of requiredProps) {
    if (!hasProperty(schema, prop)) {
      missingProps.push(prop);
    }
  }
  
  // Check property validity
  for (const prop of [...requiredProps, ...optionalProps]) {
    if (hasProperty(schema, prop)) {
      const validation = validateProperty(schema, prop, requirements.validators[prop]);
      if (!validation.valid) {
        errors.push(`${prop}: ${validation.error}`);
      }
    }
  }
  
  // Calculate fitness score
  const totalProps = requiredProps.length + optionalProps.length;
  const presentProps = totalProps - missingProps.length;
  const fitness = totalProps > 0 ? (presentProps / totalProps) * 100 : 0;
  
  return {
    fitness,
    valid: missingProps.length === 0 && errors.length === 0,
    requiredProps,
    missingProps,
    errors
  };
}

function getSchemaRequirements(pageType: string): {
  required: string[];
  optional: string[];
  validators: Record<string, (value: any) => { valid: boolean; error?: string }>;
} {
  const requirements: Record<string, any> = {
    'article': {
      required: ['headline', 'author', 'datePublished'],
      optional: ['dateModified', 'image', 'description'],
      validators: {
        headline: (v: any) => ({ valid: typeof v === 'string' && v.length > 0 }),
        author: (v: any) => ({ valid: v && (typeof v === 'string' || (v['@type'] === 'Person' && v.name)) }),
        datePublished: (v: any) => ({ valid: typeof v === 'string' && !isNaN(Date.parse(v)) }),
        dateModified: (v: any) => ({ valid: typeof v === 'string' && !isNaN(Date.parse(v)) }),
        image: (v: any) => ({ valid: typeof v === 'string' || (Array.isArray(v) && v.length > 0) })
      }
    },
    'product': {
      required: ['name', 'offers'],
      optional: ['description', 'image', 'brand'],
      validators: {
        name: (v: any) => ({ valid: typeof v === 'string' && v.length > 0 }),
        offers: (v: any) => ({ 
          valid: v && (
            (typeof v === 'object' && v.price) ||
            (Array.isArray(v) && v.length > 0)
          )
        })
      }
    },
    'faq': {
      required: ['mainEntity'],
      optional: ['name', 'description'],
      validators: {
        mainEntity: (v: any) => ({ 
          valid: Array.isArray(v) && v.length >= 2,
          error: 'FAQ must have at least 2 Q&A pairs'
        })
      }
    },
    'howto': {
      required: ['name', 'step'],
      optional: ['description', 'image', 'totalTime'],
      validators: {
        name: (v: any) => ({ valid: typeof v === 'string' && v.length > 0 }),
        step: (v: any) => ({ 
          valid: Array.isArray(v) && v.length > 0,
          error: 'HowTo must have at least 1 step'
        })
      }
    },
    'about': {
      required: ['name'],
      optional: ['description', 'url', 'sameAs'],
      validators: {
        name: (v: any) => ({ valid: typeof v === 'string' && v.length > 0 })
      }
    }
  };
  
  return requirements[pageType] || {
    required: [],
    optional: [],
    validators: {}
  };
}

function hasProperty(obj: any, path: string): boolean {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return false;
    }
  }
  
  return true;
}

function validateProperty(obj: any, path: string, validator?: (value: any) => { valid: boolean; error?: string }): { valid: boolean; error?: string } {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return { valid: false, error: `Property ${path} not found` };
    }
  }
  
  if (validator) {
    return validator(current);
  }
  
  return { valid: true };
}

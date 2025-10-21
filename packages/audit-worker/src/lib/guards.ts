/**
 * Industry Mutation Guards
 * 
 * Prevents downstream modules from changing locked industry
 */

/**
 * Guard against industry mutation attempts
 */
export function guardIndustryMutation(
  current: string,
  attempted: string,
  moduleName: string
): string {
  if (current !== attempted) {
    console.warn(
      `[GUARD] industry_mutation_blocked module=${moduleName} attempted=${attempted} locked=${current}`
    );
  }
  return current;
}

/**
 * Normalize brand grammar (e.g., "Toyotas" → "Toyota vehicles")
 */
export function normalizeBrandGrammar(text: string, brand: string): string {
  // Handle pluralized brand names
  const regex = new RegExp(`\\b${brand}s\\b`, 'gi');
  return text.replace(regex, `${brand} vehicles`);
}


/**
 * MSS Template Registry
 * Maps industry keys to their respective template modules
 */

import { defaultTemplate } from "./templates.default";
import { healthDiagnostics } from "./templates.health.diagnostics";
import { healthProviders } from "./templates.health.providers";
import { pharmaBiotech } from "./templates.pharma.biotech";
import { financeBank } from "./templates.finance.bank";
import { financeNetwork } from "./templates.finance.network";
import { financeFintech } from "./templates.finance.fintech";
import { softwareSaaS } from "./templates.software.saas";
import { softwareDevtools } from "./templates.software.devtools";
import { retail } from "./templates.retail";
import { automotive } from "./templates.automotive";
import { travelHospitality } from "./templates.travel.hospitality";
import { insurance } from "./templates.insurance";
import { marketplace } from "./templates.marketplace";
import { mediaNews } from "./templates.media.news";
import { education } from "./templates.education";
import { government } from "./templates.government";
import { telecom } from "./templates.telecom";
import { energyUtilities } from "./templates.energy.utilities";

export type MssTemplate = { 
  branded: string[]; 
  nonBranded: string[]; 
  version: string;
};

/**
 * Template registry - maps industry keys to templates
 * Incomplete mappings fall back to default
 */
export const TEMPLATES: Record<string, MssTemplate> = {
  // Health
  "health.diagnostics": healthDiagnostics,
  "health.providers": healthProviders,
  "pharma.biotech": pharmaBiotech,
  
  // Finance
  "finance.bank": financeBank,
  "finance.network": financeNetwork,
  "finance.fintech": financeFintech,
  "insurance": insurance,
  
  // Software
  "software.saas": softwareSaaS,
  "software.devtools": softwareDevtools,
  
  // Retail & Marketplace
  "retail": retail,
  "marketplace": marketplace,
  
  // Automotive
  "automotive": automotive,
  
  // Travel
  "travel.hospitality": travelHospitality,
  
  // Media & Other
  "media.news": mediaNews,
  "education": education,
  "government": government,
  "telecom": telecom,
  "energy.utilities": energyUtilities,
  
  // Fallback
  "default": defaultTemplate,
};

/**
 * Load MSS template for an industry, with fallback to default
 */
export function loadSafeTemplate(industry: string): MssTemplate {
  return TEMPLATES[industry] ?? TEMPLATES["default"];
}


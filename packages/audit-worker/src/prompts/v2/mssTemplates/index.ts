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
import { realEstate } from "./templates.real-estate";
import { foodRestaurant } from "./templates.food-restaurant";
import { automotiveDealer } from "./templates.automotive-dealer";
import { travelCruise } from "./templates.travel-cruise";
import { professionalServices } from "./templates.professional-services";
import { nonprofit } from "./templates.nonprofit";
import { manufacturing } from "./templates.manufacturing";
import { ecommerceFashion } from "./templates.ecommerce-fashion";
import { financialAdvisory } from "./templates.financial-advisory";
import { localServices } from "./templates.local-services";
import { technologyHardware } from "./templates.technology-hardware";
import { softwareEnterprise } from "./templates.software-enterprise";
import { mediaStreaming } from "./templates.media-streaming";
import { gaming } from "./templates.gaming";
import { personalBlogOrPortfolio } from "./templates.personal-blog";
import { unknown } from "./templates.unknown";

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
  "real_estate": realEstate,
  "food_restaurant": foodRestaurant,
  "ecommerce_fashion": ecommerceFashion,
  "local_services": localServices,
  
  // Automotive
  "automotive": automotive,
  "automotive_oem": automotive,
  "automotive_dealer": automotiveDealer,
  
  // Travel
  "travel.hospitality": travelHospitality,
  "travel_cruise": travelCruise,
  "travel_hotels": travelHospitality,
  "travel_air": travelHospitality,
  
  // Financial
  "financial_services": financeBank,
  "financial_advisory": financialAdvisory,
  
  // Technology
  "technology_hardware": technologyHardware,
  "software_enterprise": softwareEnterprise,
  "saas_b2b": softwareSaaS,
  
  // Media & Entertainment
  "media.news": mediaNews,
  "media_entertainment": mediaNews,
  "media_streaming": mediaStreaming,
  "gaming": gaming,
  
  // Professional Services
  "education": education,
  "professional_services": professionalServices,
  "healthcare_provider": healthProviders,
  
  // Other
  "government": government,
  "telecom": telecom,
  "energy.utilities": energyUtilities,
  "nonprofit": nonprofit,
  "manufacturing": manufacturing,
  "personal_blog": personalBlogOrPortfolio,
  "generic_consumer": defaultTemplate,
  "unknown": unknown,
  
  // Fallback
  "default": defaultTemplate,
};

/**
 * Load MSS template for an industry, with fallback to default
 */
export function loadSafeTemplate(industry: string): MssTemplate {
  return TEMPLATES[industry] ?? TEMPLATES["default"];
}


/**
 * Category term builder for non-branded queries
 * Uses tiered fallback: industry → clean entity → generic
 */

const ENTITY_FIXUPS: Array<[RegExp, string]> = [
  [/^send\s+saves?$/i, 'money transfer'],
  [/^saves?$/i, 'savings'],
  [/^paypals?$/i, 'payment platform'],
  [/^cruises?\s+cruises?$/i, 'cruise line'],
  [/^title$/i, 'service'],
  [/^(home|homepage|official|pricing|support|blog)$/i, 'service']
];

export function normalizeEntities(entities: string[]): string[] {
  const out: string[] = [];
  for (let e of entities || []) {
    e = (e || '').trim();
    if (!e) continue;
    for (const [rx, rep] of ENTITY_FIXUPS) {
      e = e.replace(rx, rep);
    }
    out.push(e.toLowerCase());
  }
  return Array.from(new Set(out));
}

export function buildCategoryTerms(
  industry: string | null,
  entities: string[],
  siteType: string
): string[] {
  const generic = ['platform', 'service', 'provider', 'tool'];
  
  // Industry-specific terms
  if (industry === 'insurance') {
    // Check if auto, home, life, health, or general
    const insuranceType = entities.find(e => /auto|car|vehicle|home|property|life|health/i.test(e));
    if (insuranceType) {
      const type = insuranceType.match(/auto|car|vehicle/i) ? 'auto' :
                   insuranceType.match(/home|property/i) ? 'home' :
                   insuranceType.match(/life/i) ? 'life' :
                   insuranceType.match(/health/i) ? 'health' : 'insurance';
      return [`${type} insurance company`, `${type} insurance provider`, 'insurance company'];
    }
    return ['insurance company', 'insurance provider', 'insurer'];
  }
  if (industry === 'finance') {
    // Check if this is a trading/investment platform vs payment processing
    const isTrading = entities.some(e => 
      /trading|investment|invest|stock|broker|crypto|portfolio|market|brokerage|securities|financial/i.test(e)
    );
    if (isTrading) {
      return ['trading platform', 'investment platform', 'brokerage', 'trading app'];
    }
    // Default to payment processing
    return ['payment platform', 'online payments', 'money transfer', 'checkout'];
  }
  if (industry === 'travel') {
    return ['cruise line', 'cruise ship', 'cruise booking'];
  }
  if (industry === 'retail') {
    // Check for music/instruments in entities
    const hasMusic = entities.some(e => 
      /guitar|instrument|drum|piano|bass|amp|music|pedal|synth/.test(e)
    );
    if (hasMusic) {
      // Differentiate: MARKETPLACE vs BRAND vs STORE
      // Marketplaces: reverb, marketplace platforms
      // Brands: fender, gibson, martin, taylor
      // Stores: guitar center, sweetwater, musician's friend
      const isMarketplace = entities.some(e => 
        /marketplace|platform|exchange|reverb|bazaar|hub|peer.to.peer|p2p/i.test(e)
      );
      const isStore = entities.some(e => 
        /store|shop|center|retailer|warehouse|outlet/i.test(e)
      );
      
      if (isMarketplace) {
        return ['music marketplace', 'instrument marketplace', 'used gear marketplace', 'music gear platform'];
      } else if (isStore) {
        return ['guitar store', 'music store', 'instrument retailer', 'music shop'];
      } else {
        // Guitar brand/manufacturer
        return ['guitar brand', 'guitar manufacturer', 'instrument brand', 'music brand'];
      }
    }
    
    // Check for sports/athletic equipment
    const hasSports = entities.some(e => 
      /soccer|football|basketball|baseball|tennis|hockey|sport|athletic|team|jersey|cleat|uniform/i.test(e)
    );
    if (hasSports) {
      // Detect specific sport
      const sportsType = entities.find(e => 
        /soccer|football|basketball|baseball|tennis|hockey/i.test(e)
      );
      if (sportsType) {
        const sport = sportsType.toLowerCase();
        return [`${sport} store`, `${sport} gear retailer`, `${sport} equipment store`, `sports retailer`];
      }
      return ['sports store', 'athletic gear retailer', 'team sports store', 'sporting goods store'];
    }
    
    return ['online store', 'shopping site', 'retail store'];
  }
  if (siteType === 'software') {
    return ['software platform', 'SaaS tool', 'API platform'];
  }
  if (siteType === 'financial') {
    // Detect specific financial service type
    const isCreditCard = entities.some(e => /credit.?card|card/i.test(e));
    const isInsurance = entities.some(e => /insurance/i.test(e));
    const isBank = entities.some(e => /bank|banking/i.test(e));
    const isInvestment = entities.some(e => /investment|brokerage|trading/i.test(e));
    
    if (isCreditCard) return ['credit card company', 'credit card provider', 'payment network'];
    if (isInsurance) return ['insurance company', 'insurance provider'];
    if (isBank) return ['bank', 'banking service', 'financial institution'];
    if (isInvestment) return ['investment firm', 'brokerage', 'trading platform'];
    
    return ['financial services company', 'financial institution', 'payment provider'];
  }

  // Fallback to first clean entity
  const clean = (entities || []).find(e => 
    !/^(home|title|official|blog|support|pricing)$/i.test(e || '')
  );
  
  if (clean) {
    return [clean];
  }
  
  // Last resort: generic terms
  return generic;
}


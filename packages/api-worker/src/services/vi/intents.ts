/**
 * Intent Generation Service for Visibility Intelligence
 * Generates diverse, weighted intent sets for AI assistant queries
 */

import { normalizeFromUrl, DomainInfo } from '../../lib/domain';

export interface Intent {
  id: string;
  intent_type: string;
  query: string;
  weight: number;
  source_hint?: string;
}

export interface SiteSeeds {
  urls: Array<{ url: string; title?: string; h1?: string; h2?: string; faq?: string }>;
  brand?: string;
  products?: string[];
  categories?: string[];
  locations?: string[];
}

export interface Env {
  DB: D1Database;
  KV_VI_SEEDS?: KVNamespace;
}

export class IntentGenerator {
  constructor(private env: Env) {}

  /**
   * Generate intents for a domain based on site content and vertical patterns
   */
  async generateIntents(
    projectId: string, 
    domainInfo: DomainInfo, 
    maxIntents: number = 100,
    siteDescription?: string
  ): Promise<Intent[]> {
    console.log(`[IntentGenerator] Generating intents for ${domainInfo.etld1}`);
    
    // 1. Get site-derived seeds
    const siteSeeds = await this.getSiteSeeds(projectId, domainInfo);
    
    // 2. Get vertical seeds from KV
    const verticalSeeds = await this.getVerticalSeeds();
    
    // 3. Generate intents using templates
    const intents = this.renderTemplates(domainInfo, siteSeeds, verticalSeeds, siteDescription);
    
    // 4. Dedupe and limit
    const uniqueIntents = this.deduplicateIntents(intents).slice(0, maxIntents);
    
    // 5. Persist to database
    await this.persistIntents(projectId, domainInfo.etld1, uniqueIntents);
    
    console.log(`[IntentGenerator] Generated ${uniqueIntents.length} intents for ${domainInfo.etld1}`);
    return uniqueIntents;
  }

  private async getSiteSeeds(projectId: string, domainInfo: DomainInfo): Promise<SiteSeeds> {
    try {
      // Get content assets for this domain
      const assets = await this.env.DB.prepare(`
        SELECT url, json_extract(metadata, '$.title') as title,
               json_extract(metadata, '$.h1') as h1,
               json_extract(metadata, '$.h2') as h2,
               json_extract(metadata, '$.faq') as faq
        FROM content_assets
        WHERE project_id = ? AND url LIKE ?
        LIMIT 500
      `).bind(projectId, `%${domainInfo.etld1}%`).all();

      // Extract brand name from domain or content
      const brand = this.extractBrandName(domainInfo, assets.results as any[]);
      
      // Extract products/categories from content
      const products = this.extractProducts(assets.results as any[]);
      const categories = this.extractCategories(assets.results as any[]);

      return {
        urls: assets.results as any[],
        brand,
        products,
        categories
      };
    } catch (error) {
      console.error('[IntentGenerator] Error getting site seeds:', error);
      return { urls: [], brand: domainInfo.etld1.split('.')[0] };
    }
  }

  private async getVerticalSeeds(): Promise<any> {
    try {
      if (!this.env.KV_VI_SEEDS) return {};
      
      const seeds = await this.env.KV_VI_SEEDS.get('default_vertical_seeds', 'json');
      return seeds || {};
    } catch (error) {
      console.error('[IntentGenerator] Error getting vertical seeds:', error);
      return {};
    }
  }

  private renderTemplates(
    domainInfo: DomainInfo, 
    siteSeeds: SiteSeeds, 
    verticalSeeds: any,
    siteDescription?: string
  ): Intent[] {
    const intents: Intent[] = [];
    const brand = siteSeeds.brand || domainInfo.etld1.split('.')[0];
    const domain = domainInfo.etld1;

    // A) Brand Core (weight 1.3)
    intents.push(
      { id: this.generateId(), intent_type: 'brand', query: `What is ${brand}?`, weight: 1.3 },
      { id: this.generateId(), intent_type: 'brand', query: `Is ${brand} legit?`, weight: 1.3 },
      { id: this.generateId(), intent_type: 'brand', query: `Is ${brand} trustworthy?`, weight: 1.3 },
      { id: this.generateId(), intent_type: 'brand', query: `${brand} customer support`, weight: 1.3 },
      { id: this.generateId(), intent_type: 'brand', query: `${brand} pricing`, weight: 1.3 },
      { id: this.generateId(), intent_type: 'brand', query: `${brand} plans`, weight: 1.3 },
      { id: this.generateId(), intent_type: 'brand', query: `${brand} coupon`, weight: 1.3 },
      { id: this.generateId(), intent_type: 'brand', query: `${brand} discount`, weight: 1.3 }
    );

    // B) Product/Service (weight 1.2)
    if (siteSeeds.products && siteSeeds.products.length > 0) {
      siteSeeds.products.slice(0, 5).forEach(product => {
        intents.push(
          { id: this.generateId(), intent_type: 'product', query: `Best ${product}`, weight: 1.2 },
          { id: this.generateId(), intent_type: 'product', query: `How does ${brand} ${product} work?`, weight: 1.2 },
          { id: this.generateId(), intent_type: 'product', query: `${brand} ${product} alternatives`, weight: 1.2 }
        );
      });
    }

    if (siteSeeds.categories && siteSeeds.categories.length > 0) {
      siteSeeds.categories.slice(0, 3).forEach(category => {
        intents.push(
          { id: this.generateId(), intent_type: 'product', query: `Best ${category} tools`, weight: 1.2 },
          { id: this.generateId(), intent_type: 'product', query: `Top ${category} platforms`, weight: 1.2 }
        );
      });
    }

    // C) How-To / Problem Jobs (weight 1.0)
    if (siteSeeds.urls.length > 0) {
      // Extract FAQ questions
      const faqQuestions = siteSeeds.urls
        .filter(url => url.faq)
        .map(url => url.faq)
        .slice(0, 10);
      
      faqQuestions.forEach(faq => {
        if (faq && faq.length > 10 && faq.length < 200) {
          intents.push({
            id: this.generateId(),
            intent_type: 'howto',
            query: faq,
            weight: 1.0
          });
        }
      });

      // Extract H1/H2 headings for how-to queries
      const headings = siteSeeds.urls
        .flatMap(url => [url.h1, url.h2])
        .filter(heading => heading && heading.length > 10)
        .slice(0, 15);

      headings.forEach(heading => {
        intents.push({
          id: this.generateId(),
          intent_type: 'howto',
          query: `How to ${heading.toLowerCase()}`, 
          weight: 1.0
        });
      });
    }

    // D) Comparatives (weight 1.4) - Add competitor queries if we have competitors
    const competitors = ['competitor', 'alternative', 'vs', 'compare'];
    competitors.forEach(comp => {
      intents.push({
        id: this.generateId(),
        intent_type: 'compare',
        query: `${brand} vs ${comp}`,
        weight: 1.4
      });
    });

    // E) Local/Entity (weight 1.1) - if applicable
    if (siteSeeds.locations && siteSeeds.locations.length > 0) {
      siteSeeds.locations.slice(0, 3).forEach(location => {
        intents.push({
          id: this.generateId(),
          intent_type: 'local',
          query: `${brand} ${location}`,
          weight: 1.1
        });
      });
    }

    // F) Evidence/Citations (weight 1.0)
    intents.push(
      { id: this.generateId(), intent_type: 'evidence', query: `Who cites ${brand}?`, weight: 1.0 },
      { id: this.generateId(), intent_type: 'evidence', query: `Sources referencing ${domain}`, weight: 1.0 },
      { id: this.generateId(), intent_type: 'evidence', query: `${brand} reviews`, weight: 1.0 },
      { id: this.generateId(), intent_type: 'evidence', query: `${brand} testimonials`, weight: 1.0 }
    );

    // G) Discovery queries (weight 1.5) - These work better across all connectors
    intents.push(
      { id: this.generateId(), intent_type: 'discovery', query: `Best tools to track AI assistant citations`, weight: 1.5 },
      { id: this.generateId(), intent_type: 'discovery', query: `How to verify if ChatGPT cites a website`, weight: 1.5 },
      { id: this.generateId(), intent_type: 'discovery', query: `LLM index visibility platforms`, weight: 1.5 },
      { id: this.generateId(), intent_type: 'discovery', query: `Perplexity citations tracking tools`, weight: 1.5 },
      { id: this.generateId(), intent_type: 'discovery', query: `AI visibility monitoring software`, weight: 1.5 },
      { id: this.generateId(), intent_type: 'discovery', query: `Answer Engine Optimization tools`, weight: 1.5 },
      { id: this.generateId(), intent_type: 'discovery', query: `Generative Engine Optimization platforms`, weight: 1.5 },
      { id: this.generateId(), intent_type: 'discovery', query: `SEO tools for AI search engines`, weight: 1.5 }
    );

    // H) Site description-driven queries (weight 1.4) - Use user-provided description for better targeting
    if (siteDescription && siteDescription.trim().length > 10) {
      const description = siteDescription.trim();
      
      // Extract key terms from description
      const keyTerms = description
        .toLowerCase()
        .split(/[\s,.-]+/)
        .filter(term => term.length > 3 && !['for', 'the', 'and', 'with', 'that', 'this', 'from', 'they', 'have'].includes(term))
        .slice(0, 5);
      
      // Generate contextual queries based on description
      intents.push(
        { id: this.generateId(), intent_type: 'description', query: `Best ${keyTerms[0] || 'tools'} platforms`, weight: 1.4 },
        { id: this.generateId(), intent_type: 'description', query: `Top ${keyTerms[0] || 'tools'} solutions`, weight: 1.4 },
        { id: this.generateId(), intent_type: 'description', query: `${keyTerms[0] || 'Tools'} vs competitors`, weight: 1.4 },
        { id: this.generateId(), intent_type: 'description', query: `How does ${brand} work?`, weight: 1.4 },
        { id: this.generateId(), intent_type: 'description', query: `${brand} alternatives`, weight: 1.4 },
        { id: this.generateId(), intent_type: 'description', query: `Is ${brand} worth it?`, weight: 1.4 }
      );

      // If description mentions specific features/categories, create targeted queries
      if (keyTerms.length > 1) {
        intents.push(
          { id: this.generateId(), intent_type: 'description', query: `${keyTerms[0]} and ${keyTerms[1]} tools`, weight: 1.3 },
          { id: this.generateId(), intent_type: 'description', query: `${keyTerms[0]} ${keyTerms[1]} platforms`, weight: 1.3 }
        );
      }
    }

    return intents;
  }

  private deduplicateIntents(intents: Intent[]): Intent[] {
    const seen = new Set<string>();
    return intents.filter(intent => {
      const key = intent.query.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async persistIntents(projectId: string, domain: string, intents: Intent[]): Promise<void> {
    try {
      for (const intent of intents) {
        await this.env.DB.prepare(`
          INSERT OR REPLACE INTO visibility_intents 
          (id, project_id, domain, intent_type, query, source_hint, weight, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          intent.id,
          projectId,
          domain,
          intent.intent_type,
          intent.query,
          intent.source_hint || 'generic',
          intent.weight,
          new Date().toISOString()
        ).run();
      }
    } catch (error) {
      console.error('[IntentGenerator] Error persisting intents:', error);
      throw error;
    }
  }

  private extractBrandName(domainInfo: DomainInfo, assets: any[]): string {
    // Try to extract from titles first
    const titles = assets.map(a => a.title).filter(Boolean);
    if (titles.length > 0) {
      // Find common words in titles
      const words = titles.join(' ').toLowerCase().split(/\s+/);
      const wordCount = words.reduce((acc, word) => {
        acc[word] = (acc[word] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const commonWords = Object.entries(wordCount)
        .filter(([word, count]) => count > 1 && word.length > 2)
        .sort(([,a], [,b]) => b - a);
      
      if (commonWords.length > 0) {
        return commonWords[0][0];
      }
    }
    
    // Fallback to domain name
    return domainInfo.etld1.split('.')[0];
  }

  private extractProducts(assets: any[]): string[] {
    const products = new Set<string>();
    
    // Extract from H1/H2 headings
    assets.forEach(asset => {
      [asset.h1, asset.h2].forEach(heading => {
        if (heading && heading.length < 50) {
          products.add(heading.toLowerCase());
        }
      });
    });
    
    return Array.from(products).slice(0, 10);
  }

  private extractCategories(assets: any[]): string[] {
    const categories = new Set<string>();
    
    // Simple category extraction from URLs and titles
    assets.forEach(asset => {
      const url = asset.url.toLowerCase();
      const title = (asset.title || '').toLowerCase();
      
      // Common category patterns
      const patterns = ['tools', 'platform', 'software', 'service', 'solution', 'app', 'system'];
      patterns.forEach(pattern => {
        if (url.includes(pattern) || title.includes(pattern)) {
          categories.add(pattern);
        }
      });
    });
    
    return Array.from(categories).slice(0, 5);
  }

  private generateId(): string {
    return `intent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get existing intents for a domain
   */
  async getIntents(projectId: string, domain: string): Promise<Intent[]> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT id, intent_type, query, weight, source_hint
        FROM visibility_intents
        WHERE project_id = ? AND domain = ?
        ORDER BY weight DESC, created_at DESC
      `).bind(projectId, domain).all();

      return result.results as Intent[];
    } catch (error) {
      console.error('[IntentGenerator] Error getting intents:', error);
      return [];
    }
  }
}

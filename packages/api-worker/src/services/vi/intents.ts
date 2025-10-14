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
  kind?: 'branded' | 'non_branded';
  prompt_reason?: string;
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
      // Try to get content from audit pages if available
      let assets: any[] = [];
      try {
        const auditPages = await this.env.DB.prepare(`
          SELECT url, title, h1, h2, faq_present
          FROM audit_pages
          WHERE audit_id IN (
            SELECT id FROM audits WHERE property_id IN (
              SELECT id FROM properties WHERE project_id = ? AND domain = ?
            )
          )
          LIMIT 100
        `).bind(projectId, domainInfo.etld1).all();
        
        assets = auditPages.results as any[];
      } catch (error) {
        console.warn('[IntentGenerator] Could not get audit pages, using fallback');
      }

      // Extract brand name from domain or content
      const brand = this.extractBrandName(domainInfo, assets);
      
      // Extract products/categories from content
      const products = this.extractProducts(assets);
      const categories = this.extractCategories(assets);

      return {
        urls: assets,
        brand,
        products,
        categories
      };
    } catch (error) {
      console.error('[IntentGenerator] Error getting site seeds:', error);
      // Fallback to domain-based brand name
      return { 
        urls: [], 
        brand: domainInfo.etld1.split('.')[0],
        products: [],
        categories: []
      };
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

    // Generate exactly 5 prompts: 3 branded, 2 non-branded
    // A) Branded prompts (3)
    intents.push(
      { 
        id: this.generateId(), 
        intent_type: 'brand', 
        query: `What is ${brand}?`, 
        weight: 1.3,
        kind: 'branded',
        prompt_reason: 'Core brand identity question'
      },
      { 
        id: this.generateId(), 
        intent_type: 'brand', 
        query: `Is ${brand} legit?`, 
        weight: 1.3,
        kind: 'branded',
        prompt_reason: 'Trust and legitimacy verification'
      },
      { 
        id: this.generateId(), 
        intent_type: 'brand', 
        query: `${brand} pricing`, 
        weight: 1.3,
        kind: 'branded',
        prompt_reason: 'Cost and pricing information'
      }
    );

    // B) Non-branded prompts (2) - Based on site description
    if (siteDescription && siteDescription.trim().length > 10) {
      const description = siteDescription.trim().toLowerCase();
      
      // Extract category/industry from description
      let category = 'tools';
      if (description.includes('cancer') || description.includes('screening')) {
        category = 'cancer screening tools';
      } else if (description.includes('seo') || description.includes('search')) {
        category = 'SEO tools';
      } else if (description.includes('ecommerce') || description.includes('shop')) {
        category = 'e-commerce platforms';
      } else if (description.includes('analytics') || description.includes('data')) {
        category = 'analytics tools';
      }
      
      // Extract primary job-to-be-done
      let jobToBeDone = 'get better results';
      if (description.includes('track') || description.includes('monitor')) {
        jobToBeDone = 'track and monitor performance';
      } else if (description.includes('optimize') || description.includes('improve')) {
        jobToBeDone = 'optimize and improve results';
      } else if (description.includes('analyze') || description.includes('measure')) {
        jobToBeDone = 'analyze and measure performance';
      }
      
      intents.push(
        { 
          id: this.generateId(), 
          intent_type: 'category', 
          query: `Best ${category} (include sources)`, 
          weight: 1.2,
          kind: 'non_branded',
          prompt_reason: `Category-based discovery for ${category}`
        },
        { 
          id: this.generateId(), 
          intent_type: 'howto', 
          query: `How to ${jobToBeDone} (include sources)`, 
          weight: 1.2,
          kind: 'non_branded',
          prompt_reason: `Job-to-be-done query: ${jobToBeDone}`
        }
      );
    } else {
      // Fallback non-branded prompts
      intents.push(
        { 
          id: this.generateId(), 
          intent_type: 'category', 
          query: `Best tools for ${brand} (include sources)`, 
          weight: 1.2,
          kind: 'non_branded',
          prompt_reason: 'Generic category discovery'
        },
        { 
          id: this.generateId(), 
          intent_type: 'howto', 
          query: `How to use ${brand} effectively (include sources)`, 
          weight: 1.2,
          kind: 'non_branded',
          prompt_reason: 'Generic how-to query'
        }
      );
    }

    // Return exactly 5 prompts (3 branded + 2 non-branded)
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
          (id, project_id, domain, intent_type, query, source_hint, weight, kind, prompt_reason, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          intent.id,
          projectId,
          domain,
          intent.intent_type,
          intent.query,
          intent.source_hint || 'generic',
          intent.weight,
          intent.kind || 'branded',
          intent.prompt_reason || 'Generated from site description',
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

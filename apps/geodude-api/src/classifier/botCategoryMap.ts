export type BotCategory =
    | "search_crawler"     // Googlebot, Bingbot, etc.
    | "ai_training"        // GPTBot, CCBot, Google-Extended, PerplexityBot
    | "preview_bot"        // Slack, Twitter, Discord, LinkedIn unfurlers
    | "uptime_monitor"     // UptimeRobot, Pingdom
    | "seo_tool"           // Semrush, Ahrefs, etc.
    | "archiver"           // Internet Archive and similar
    | "security"           // Security scanners
    | "marketing"          // Ad/marketing crawlers
    | "accessibility"      // Accessibility bots
    | "research"           // Academic crawlers
    | "other";             // Unknown or unmapped

// Cloudflare verified bot category mapping
export const CF_CATEGORY_MAP: Record<string, BotCategory> = {
    "Search Engine Crawler": "search_crawler",
    "Page Preview": "preview_bot",
    "Monitoring & Analytics": "uptime_monitor",
    "AI Crawler": "ai_training",
    "AI Assistant": "ai_training",     // Keep OUT of AI impact
    "Search Engine Optimization": "seo_tool",
    "Archiver": "archiver",
    "Security": "security",
    "Advertising & Marketing": "marketing",
    "Accessibility": "accessibility",
    "Academic Research": "research",
};

/**
 * Normalize Cloudflare verified bot category to our bot category
 */
export function normalizeCfCategory(cfCategory?: string): BotCategory {
    if (!cfCategory) return "other";
    return CF_CATEGORY_MAP[cfCategory] ?? "other";
}

/**
 * Get display name for bot category
 */
export function getBotCategoryDisplayName(category: BotCategory): string {
    const names: Record<BotCategory, string> = {
        search_crawler: "Search Crawlers",
        ai_training: "AI Training",
        preview_bot: "Preview Bots",
        uptime_monitor: "Uptime Monitors",
        seo_tool: "SEO Tools",
        archiver: "Archivers",
        security: "Security",
        marketing: "Marketing",
        accessibility: "Accessibility",
        research: "Research",
        other: "Other Bots"
    };
    return names[category];
}

/**
 * Get color for bot category (for UI badges)
 */
export function getBotCategoryColor(category: BotCategory): string {
    const colors: Record<BotCategory, string> = {
        search_crawler: "blue",
        ai_training: "purple",
        preview_bot: "green",
        uptime_monitor: "yellow",
        seo_tool: "indigo",
        archiver: "gray",
        security: "red",
        marketing: "pink",
        accessibility: "teal",
        research: "cyan",
        other: "gray"
    };
    return colors[category];
}

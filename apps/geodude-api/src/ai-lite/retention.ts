export interface RetentionConfig {
    aiDays: number;
    crawlDays: number;
    baselineSampledDays: number;
    rollupDays: number;
}

export interface RetentionStats {
    aiEventsDeleted: number;
    crawlEventsDeleted: number;
    baselineEventsDeleted: number;
    rollupsDeleted: number;
    errors: number;
}

/**
 * Clean up old data based on retention configuration
 * This should be run nightly via cron
 */
export async function cleanupOldData(
    db: any,
    config: RetentionConfig
): Promise<RetentionStats> {
    const now = new Date();

    const stats: RetentionStats = {
        aiEventsDeleted: 0,
        crawlEventsDeleted: 0,
        baselineEventsDeleted: 0,
        rollupsDeleted: 0,
        errors: 0
    };

    try {
        console.log('Starting retention cleanup...');

        // Clean up old AI events (human_via_ai, citations)
        if (config.aiDays > 0) {
            const aiCutoff = new Date(now.getTime() - config.aiDays * 24 * 60 * 60 * 1000);
            try {
                const aiResult = await db.prepare(`
          DELETE FROM interaction_events
          WHERE ai_source_id IS NOT NULL
            AND occurred_at < ?
        `).bind(aiCutoff.toISOString()).run();

                stats.aiEventsDeleted = aiResult.changes || 0;
                console.log(`Deleted ${stats.aiEventsDeleted} old AI events`);
            } catch (error) {
                console.error('Failed to delete old AI events:', error);
                stats.errors++;
            }
        }

        // Clean up old crawl events (ai_agent_crawl)
        if (config.crawlDays > 0) {
            const crawlCutoff = new Date(now.getTime() - config.crawlDays * 24 * 60 * 60 * 1000);
            try {
                // Note: This is a simplified approach. In practice, we'd need to identify
                // crawl events more precisely based on the traffic classification logic
                const crawlResult = await db.prepare(`
          DELETE FROM interaction_events
          WHERE (user_agent LIKE '%bot%' OR user_agent LIKE '%crawler%')
            AND occurred_at < ?
        `).bind(crawlCutoff.toISOString()).run();

                stats.crawlEventsDeleted = crawlResult.changes || 0;
                console.log(`Deleted ${stats.crawlEventsDeleted} old crawl events`);
            } catch (error) {
                console.error('Failed to delete old crawl events:', error);
                stats.errors++;
            }
        }

        // Clean up old baseline sampled events (direct_human, search with sampled=1)
        if (config.baselineSampledDays > 0) {
            const baselineCutoff = new Date(now.getTime() - config.baselineSampledDays * 24 * 60 * 60 * 1000);
            try {
                const baselineResult = await db.prepare(`
          DELETE FROM interaction_events
          WHERE sampled = 1
            AND ai_source_id IS NULL
            AND occurred_at < ?
        `).bind(baselineCutoff.toISOString()).run();

                stats.baselineEventsDeleted = baselineResult.changes || 0;
                console.log(`Deleted ${stats.baselineEventsDeleted} old baseline sampled events`);
            } catch (error) {
                console.error('Failed to delete old baseline events:', error);
                stats.errors++;
            }
        }

        // Clean up old rollups
        if (config.rollupDays > 0) {
            const rollupCutoff = Math.floor((now.getTime() - config.rollupDays * 24 * 60 * 60 * 1000) / 1000);
            try {
                const rollupResult = await db.prepare(`
          DELETE FROM traffic_rollup_hourly
          WHERE ts_hour < ?
        `).bind(rollupCutoff).run();

                stats.rollupsDeleted = rollupResult.changes || 0;
                console.log(`Deleted ${stats.rollupsDeleted} old rollup entries`);
            } catch (error) {
                console.error('Failed to delete old rollups:', error);
                stats.errors++;
            }
        }

        console.log(`Retention cleanup completed: ${JSON.stringify(stats)}`);
        return stats;

    } catch (error) {
        console.error('Retention cleanup failed:', error);
        throw error;
    }
}

/**
 * Get retention configuration from environment variables
 */
export function getRetentionConfig(): RetentionConfig {
    return {
        aiDays: parseInt(process.env.RETENTION_AI_DAYS || '365'),
        crawlDays: parseInt(process.env.RETENTION_CRAWL_DAYS || '180'),
        baselineSampledDays: parseInt(process.env.RETENTION_BASELINE_SAMPLED_DAYS || '14'),
        rollupDays: 365 // Hard-coded as specified
    };
}

/**
 * Estimate storage savings from retention cleanup
 */
export async function estimateStorageSavings(
    db: any,
    config: RetentionConfig
): Promise<{ currentSize: number; estimatedSavings: number }> {
    try {
        // Get current event counts by age
        const now = new Date();

        const aiCutoff = new Date(now.getTime() - config.aiDays * 24 * 60 * 60 * 1000);
        const crawlCutoff = new Date(now.getTime() - config.crawlDays * 24 * 60 * 60 * 1000);
        const baselineCutoff = new Date(now.getTime() - config.baselineSampledDays * 24 * 60 * 60 * 1000);

        const aiCount = await db.prepare(`
      SELECT COUNT(*) as count
      FROM interaction_events
      WHERE ai_source_id IS NOT NULL
        AND occurred_at < ?
    `).bind(aiCutoff.toISOString()).first();

        const crawlCount = await db.prepare(`
      SELECT COUNT(*) as count
      FROM interaction_events
      WHERE (user_agent LIKE '%bot%' OR user_agent LIKE '%crawler%')
        AND occurred_at < ?
    `).bind(crawlCutoff.toISOString()).first();

        const baselineCount = await db.prepare(`
      SELECT COUNT(*) as count
      FROM interaction_events
      WHERE sampled = 1
        AND ai_source_id IS NULL
        AND occurred_at < ?
    `).bind(baselineCutoff.toISOString()).first();

        const totalCount = await db.prepare(`
      SELECT COUNT(*) as count
      FROM interaction_events
    `).bind().first();

        const currentSize = totalCount?.count || 0;
        const estimatedSavings = (aiCount?.count || 0) + (crawlCount?.count || 0) + (baselineCount?.count || 0);

        return { currentSize, estimatedSavings };

    } catch (error) {
        console.error('Failed to estimate storage savings:', error);
        return { currentSize: 0, estimatedSavings: 0 };
    }
}

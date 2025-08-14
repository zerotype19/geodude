import { Request, Response } from '@cloudflare/workers-types';
import { Env } from '../types';
import { log } from '../logging';
import { addBasicSecurityHeaders, addCorsHeaders } from '../cors';

export async function handleApiRoutes(
    req: Request,
    env: Env,
    url: URL,
    origin: string | null,
    attach: (resp: Response) => Response,
    addBasicSecurityHeaders: (resp: Response) => Response,
    addCorsHeaders: (resp: Response, origin: string | null) => Response
): Promise<Response | null> {
    // 6.1) API Keys Management
    if (url.pathname === "/api/keys" && req.method === "POST") {
        try {
            const body = await req.json() as any;
            const { project_id, property_id, name } = body;

            if (!project_id || !property_id || !name) {
                const response = new Response("Missing required fields", { status: 400 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Generate unique key_id and secret
            const keyId = `key_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
            const secret = crypto.randomUUID().replace(/-/g, '');
            const secretHash = await hashString(secret);

            // Insert the API key
            const result = await env.OPTIVIEW_DB.prepare(`
        INSERT INTO api_keys (project_id, property_id, name, key_id, secret_hash)
        VALUES (?, ?, ?, ?, ?)
      `).bind(project_id, property_id, name, keyId, secretHash).run();

            const response = new Response(JSON.stringify({
                id: result.meta.last_row_id,
                key_id: keyId,
                secret_once: secret, // Show only once
                name,
                project_id,
                property_id
            }), {
                headers: { "Content-Type": "application/json" }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            log("keys_create_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    if (url.pathname === "/api/keys" && req.method === "GET") {
        try {
            const { project_id, property_id } = Object.fromEntries(url.searchParams);
            if (!project_id) {
                const response = new Response("Missing project_id", { status: 400 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            let query = `
        SELECT ak.id, ak.name, ak.key_id, ak.created_at, ak.last_used_at, ak.revoked_at,
               p.domain as property_domain
        FROM api_keys ak
        JOIN properties p ON ak.property_id = p.id
        WHERE ak.project_id = ?
      `;
            let params = [project_id];

            if (property_id) {
                query += " AND ak.property_id = ?";
                params.push(property_id);
            }

            query += " ORDER BY ak.created_at DESC";

            const keys = await env.OPTIVIEW_DB.prepare(query).bind(...params).all<any>();

            const response = new Response(JSON.stringify({ keys: keys.results || [] }), {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "public, max-age=300"
                }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            log("keys_list_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    // 6.2) Events API
    if (url.pathname === "/api/events" && req.method === "GET") {
        try {
            const { project_id, limit = "100", offset = "0" } = Object.fromEntries(url.searchParams);
            if (!project_id) {
                const response = new Response("Missing project_id", { status: 400 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }
            const limitNum = Math.min(parseInt(limit), 1000); // Cap at 1000
            const offsetNum = parseInt(offset);
            const events = await env.OPTIVIEW_DB.prepare(`
        SELECT
          id, event_type, occurred_at, metadata,
          content_id, ai_source_id
        FROM interaction_events
        WHERE project_id = ?
        ORDER BY occurred_at DESC
        LIMIT ? OFFSET ?
      `).bind(project_id, limitNum, offsetNum).all<any>();
            const response = new Response(JSON.stringify({
                events: events.results || [],
                total: events.results?.length || 0
            }), {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "public, max-age=60" // 1 min cache
                }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            log("events_list_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    // 6.3) Events Summary API
    if (url.pathname === "/api/events/summary" && req.method === "GET") {
        try {
            const { project_id, from, to } = Object.fromEntries(url.searchParams);
            if (!project_id) {
                const response = new Response("missing project_id", { status: 400 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const fromTs = from ? parseInt(from) : Date.now() - 7 * 24 * 60 * 60 * 1000;
            const toTs = to ? parseInt(to) : Date.now();

            // Get total events
            const totalResult = await env.OPTIVIEW_DB.prepare(`
        SELECT COUNT(*) as total
        FROM interaction_events
        WHERE project_id = ? AND occurred_at BETWEEN ? AND ?
      `).bind(project_id, fromTs, toTs).first<any>();

            // Get breakdown by traffic class
            const classBreakdown = await env.OPTIVIEW_DB.prepare(`
        SELECT 
          metadata as traffic_class,
          COUNT(*) as count
        FROM interaction_events
        WHERE project_id = ? AND occurred_at BETWEEN ? AND ?
        GROUP BY metadata
        ORDER BY count DESC
      `).bind(project_id, fromTs, toTs).all<any>();

            // Get top AI sources - simplified to avoid JOIN issues
            const topSources = await env.OPTIVIEW_DB.prepare(`
        SELECT 
          ai_source_id,
          COUNT(*) as count
        FROM interaction_events
        WHERE project_id = ? AND occurred_at BETWEEN ? AND ? AND ai_source_id IS NOT NULL
        GROUP BY ai_source_id
        ORDER BY count DESC
        LIMIT 5
      `).bind(project_id, fromTs, toTs).all<any>();

            // Get timeseries data - simplified for D1 compatibility
            const timeseries = await env.OPTIVIEW_DB.prepare(`
        SELECT 
          occurred_at as day,
          COUNT(*) as count,
          metadata as traffic_class
        FROM interaction_events
        WHERE project_id = ? AND occurred_at BETWEEN ? AND ?
        GROUP BY metadata
        ORDER BY occurred_at
      `).bind(project_id, fromTs, toTs).all<any>();

            const summary = {
                total: totalResult?.total || 0,
                breakdown: classBreakdown.results || [],
                top_sources: topSources.results || [],
                timeseries: timeseries.results || []
            };

            const response = new Response(JSON.stringify(summary), {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "public, max-age=300" // 5 min cache
                }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            log("events_summary_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    // 6.4) Content API
    if (url.pathname === "/api/content" && req.method === "GET") {
        try {
            const { project_id } = Object.fromEntries(url.searchParams);
            if (!project_id) {
                const response = new Response("missing project_id", { status: 400 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const content = await env.OPTIVIEW_DB.prepare(`
        SELECT ca.id, ca.url, ca.type, ca.metadata, ca.created_at,
               p.domain
        FROM content_assets ca
        JOIN properties p ON ca.property_id = p.id
        WHERE p.project_id = ?
        ORDER BY ca.created_at DESC
      `).bind(project_id).all<any>();

            const response = new Response(JSON.stringify({ content: content.results || [] }), {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "public, max-age=300"
                }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            log("content_list_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    // 6.5) Sources API
    if (url.pathname === "/api/sources" && req.method === "GET") {
        try {
            const sources = await env.OPTIVIEW_DB.prepare(`
        SELECT id, name, category, fingerprint, created_at
        FROM ai_sources
        ORDER BY name
      `).all<any>();

            const response = new Response(JSON.stringify({ sources: sources.results || [] }), {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "public, max-age=600" // 10 min cache
                }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            log("sources_list_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    // 6.6) Funnels Summary API
    if (url.pathname === "/api/funnels/summary" && req.method === "GET") {
        try {
            const { project_id, window = "7d" } = Object.fromEntries(url.searchParams);
            if (!project_id) {
                const response = new Response("Missing project_id", { status: 400 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Calculate time window
            const now = Date.now();
            let since: number;
            switch (window) {
                case "15m":
                    since = now - 15 * 60 * 1000;
                    break;
                case "24h":
                    since = now - 24 * 60 * 60 * 1000;
                    break;
                case "7d":
                default:
                    since = now - 7 * 24 * 60 * 60 * 1000;
                    break;
            }

            // Get total referrals and conversions in window
            const totalsResult = await env.OPTIVIEW_DB.prepare(`
                SELECT 
                    (SELECT COUNT(*) FROM ai_referrals WHERE project_id = ? AND detected_at >= ?) as referrals,
                    (SELECT COUNT(*) FROM conversion_event WHERE project_id = ? AND occurred_at >= ?) as conversions
            `).bind(project_id, since, project_id, since).first<any>();

            const referrals = totalsResult?.referrals || 0;
            const conversions = totalsResult?.conversions || 0;
            const conv_rate = referrals > 0 ? conversions / referrals : 0;

            // Get breakdown by source
            const bySourceResult = await env.OPTIVIEW_DB.prepare(`
                WITH source_stats AS (
                    SELECT 
                        ar.ai_source_id,
                        COUNT(*) as referrals,
                        (SELECT COUNT(*) FROM conversion_event ce 
                         WHERE ce.project_id = ar.project_id 
                         AND ce.content_id = ar.content_id 
                         AND ce.occurred_at >= ar.detected_at 
                         AND ce.occurred_at <= datetime(ar.detected_at, '+7 days')
                         AND ce.occurred_at >= ?) as conversions
                    FROM ai_referrals ar
                    WHERE ar.project_id = ? AND ar.detected_at >= ?
                    GROUP BY ar.ai_source_id, ar.content_id
                )
                SELECT 
                    s.id, s.slug, s.name,
                    SUM(ss.referrals) as referrals,
                    SUM(ss.conversions) as conversions,
                    CASE WHEN SUM(ss.referrals) > 0 
                         THEN CAST(SUM(ss.conversions) AS FLOAT) / SUM(ss.referrals) 
                         ELSE 0 END as conv_rate
                FROM source_stats ss
                JOIN ai_sources s ON s.id = ss.ai_source_id
                GROUP BY s.id, s.slug, s.name
                ORDER BY conv_rate DESC
            `).bind(since, project_id, since).all<any>();

            // Calculate TTC percentiles for each source
            const bySource = await Promise.all((bySourceResult.results || []).map(async (source) => {
                const ttcResult = await env.OPTIVIEW_DB.prepare(`
                    WITH last_touch AS (
                        SELECT 
                            ce.id,
                            ce.occurred_at,
                            (SELECT MAX(ar.detected_at) 
                             FROM ai_referrals ar 
                             WHERE ar.project_id = ce.project_id 
                             AND ar.content_id = ce.content_id 
                             AND ar.ai_source_id = ? 
                             AND ar.detected_at <= ce.occurred_at
                             AND ar.detected_at >= datetime(ce.occurred_at, '-7 days')) as last_referral
                        FROM conversion_event ce
                        WHERE ce.project_id = ? 
                        AND ce.occurred_at >= ?
                        AND EXISTS (
                            SELECT 1 FROM ai_referrals ar 
                            WHERE ar.project_id = ce.project_id 
                            AND ar.content_id = ce.content_id 
                            AND ar.ai_source_id = ?
                            AND ar.detected_at <= ce.occurred_at
                            AND ar.detected_at >= datetime(ce.occurred_at, '-7 days')
                        )
                    )
                    SELECT 
                        CAST((julianday(occurred_at) - julianday(last_referral)) * 24 * 60 AS INTEGER) as ttc_minutes
                    FROM last_touch
                    WHERE last_referral IS NOT NULL
                    ORDER BY ttc_minutes
                `).bind(source.id, project_id, since, source.id).all<any>();

                const ttcMinutes = (ttcResult.results || []).map(r => r.ttc_minutes).filter(t => t !== null);
                const p50_ttc_min = ttcMinutes.length > 0 ? 
                    ttcMinutes[Math.floor(ttcMinutes.length * 0.5)] : null;
                const p90_ttc_min = ttcMinutes.length > 0 ? 
                    ttcMinutes[Math.floor(ttcMinutes.length * 0.9)] : null;

                return {
                    slug: source.slug,
                    name: source.name,
                    referrals: source.referrals,
                    conversions: source.conversions,
                    conv_rate: source.conv_rate,
                    p50_ttc_min,
                    p90_ttc_min
                };
            }));

            // Get timeseries data (daily for 7d, hourly for 24h, 15-min for 15m)
            let timeseriesQuery: string;
            let timeseriesParams: any[];
            
            if (window === "15m") {
                timeseriesQuery = `
                    SELECT 
                        strftime('%Y-%m-%d %H:%M', datetime(detected_at, 'start of hour', '+' || (strftime('%M', detected_at) / 15) * 15 || ' minutes')) as ts,
                        COUNT(*) as referrals
                    FROM ai_referrals 
                    WHERE project_id = ? AND detected_at >= ?
                    GROUP BY ts
                    ORDER BY ts
                `;
                timeseriesParams = [project_id, since];
            } else if (window === "24h") {
                timeseriesQuery = `
                    SELECT 
                        strftime('%Y-%m-%d %H:00', detected_at) as ts,
                        COUNT(*) as referrals
                    FROM ai_referrals 
                    WHERE project_id = ? AND detected_at >= ?
                    GROUP BY ts
                    ORDER BY ts
                `;
                timeseriesParams = [project_id, since];
            } else {
                timeseriesQuery = `
                    SELECT 
                        date(detected_at) as ts,
                        COUNT(*) as referrals
                    FROM ai_referrals 
                    WHERE project_id = ? AND detected_at >= ?
                    GROUP BY ts
                    ORDER BY ts
                `;
                timeseriesParams = [project_id, since];
            }

            const timeseriesResult = await env.OPTIVIEW_DB.prepare(timeseriesQuery).bind(...timeseriesParams).all<any>();

            const summary = {
                totals: { referrals, conversions, conv_rate },
                by_source: bySource,
                timeseries: timeseriesResult.results || []
            };

            const response = new Response(JSON.stringify(summary), {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "private, max-age=300, stale-while-revalidate=60"
                }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            log("funnels_summary_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    // 6.7) Funnels List API
    if (url.pathname === "/api/funnels" && req.method === "GET") {
        try {
            const { 
                project_id, 
                window = "7d", 
                source = "", 
                q = "", 
                sort = "conv_rate_desc", 
                page = "1", 
                pageSize = "50" 
            } = Object.fromEntries(url.searchParams);

            if (!project_id) {
                const response = new Response("Missing project_id", { status: 400 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Validate sort parameter (whitelist)
            const validSorts = ['conv_rate_desc', 'conversions_desc', 'referrals_desc', 'last_conversion_desc'];
            if (!validSorts.includes(sort)) {
                sort = 'conv_rate_desc';
            }

            // Calculate time window
            const now = Date.now();
            let since: number;
            switch (window) {
                case "15m":
                    since = now - 15 * 60 * 1000;
                    break;
                case "24h":
                    since = now - 24 * 60 * 60 * 1000;
                    break;
                case "7d":
                default:
                    since = now - 7 * 24 * 60 * 60 * 1000;
                    break;
            }

            // Build query with filters
            let whereClause = "WHERE ar.project_id = ? AND ar.detected_at >= ?";
            let params = [project_id, since];

            if (source) {
                whereClause += " AND s.slug = ?";
                params.push(source);
            }

            if (q) {
                whereClause += " AND ca.url LIKE ?";
                params.push(`%${q}%`);
            }

            // Build ORDER BY clause
            let orderBy = "ORDER BY ";
            switch (sort) {
                case 'conv_rate_desc':
                    orderBy += "conv_rate DESC";
                    break;
                case 'conversions_desc':
                    orderBy += "conversions DESC";
                    break;
                case 'referrals_desc':
                    orderBy += "referrals DESC";
                    break;
                case 'last_conversion_desc':
                    orderBy += "last_conversion DESC";
                    break;
                default:
                    orderBy += "conv_rate DESC";
            }

            // Get total count for pagination
            const countQuery = `
                SELECT COUNT(DISTINCT ar.content_id, ar.ai_source_id) as total
                FROM ai_referrals ar
                JOIN content_assets ca ON ca.id = ar.content_id
                JOIN ai_sources s ON s.id = ar.ai_source_id
                ${whereClause}
            `;
            const totalResult = await env.OPTIVIEW_DB.prepare(countQuery).bind(...params).first<any>();
            const total = totalResult?.total || 0;

            // Get paginated results
            const pageNum = parseInt(page);
            const pageSizeNum = parseInt(pageSize);
            const offset = (pageNum - 1) * pageSizeNum;

            const itemsQuery = `
                WITH funnel_stats AS (
                    SELECT 
                        ar.content_id,
                        ar.ai_source_id,
                        COUNT(*) as referrals,
                        (SELECT COUNT(*) FROM conversion_event ce 
                         WHERE ce.project_id = ar.project_id 
                         AND ce.content_id = ar.content_id 
                         AND ce.occurred_at >= ar.detected_at 
                         AND ce.occurred_at <= datetime(ar.detected_at, '+7 days')
                         AND ce.occurred_at >= ?) as conversions,
                        MAX(ar.detected_at) as last_referral,
                        (SELECT MAX(ce.occurred_at) FROM conversion_event ce 
                         WHERE ce.project_id = ar.project_id 
                         AND ce.content_id = ar.content_id 
                         AND ce.occurred_at >= ?) as last_conversion
                    FROM ai_referrals ar
                    ${whereClause}
                    GROUP BY ar.content_id, ar.ai_source_id
                )
                SELECT 
                    fs.content_id,
                    ca.url,
                    s.slug as source_slug,
                    s.name as source_name,
                    fs.referrals,
                    fs.conversions,
                    CASE WHEN fs.referrals > 0 
                         THEN CAST(fs.conversions AS FLOAT) / fs.referrals 
                         ELSE 0 END as conv_rate,
                    fs.last_referral,
                    fs.last_conversion
                FROM funnel_stats fs
                JOIN content_assets ca ON ca.id = fs.content_id
                JOIN ai_sources s ON s.id = fs.ai_source_id
                ${orderBy}
                LIMIT ? OFFSET ?
            `;

            const itemsResult = await env.OPTIVIEW_DB.prepare(itemsQuery).bind(...params, since, since, pageSizeNum, offset).all<any>();

            // Calculate TTC percentiles for each item
            const items = await Promise.all((itemsResult.results || []).map(async (item) => {
                const ttcResult = await env.OPTIVIEW_DB.prepare(`
                    WITH last_touch AS (
                        SELECT 
                            ce.id,
                            ce.occurred_at,
                            (SELECT MAX(ar.detected_at) 
                             FROM ai_referrals ar 
                             WHERE ar.project_id = ce.project_id 
                             AND ar.content_id = ce.content_id 
                             AND ar.ai_source_id = (SELECT id FROM ai_sources WHERE slug = ?)
                             AND ar.detected_at <= ce.occurred_at
                             AND ar.detected_at >= datetime(ce.occurred_at, '-7 days')) as last_referral
                        FROM conversion_event ce
                        WHERE ce.project_id = ? 
                        AND ce.content_id = ?
                        AND ce.occurred_at >= ?
                        AND EXISTS (
                            SELECT 1 FROM ai_referrals ar 
                            WHERE ar.project_id = ce.project_id 
                            AND ar.content_id = ce.content_id 
                            AND ar.ai_source_id = (SELECT id FROM ai_sources WHERE slug = ?)
                            AND ar.detected_at <= ce.occurred_at
                            AND ar.detected_at >= datetime(ce.occurred_at, '-7 days')
                        )
                    )
                    SELECT 
                        CAST((julianday(occurred_at) - julianday(last_referral)) * 24 * 60 AS INTEGER) as ttc_minutes
                    FROM last_touch
                    WHERE last_referral IS NOT NULL
                    ORDER BY ttc_minutes
                `).bind(item.source_slug, project_id, item.content_id, since, item.source_slug).all<any>();

                const ttcMinutes = (ttcResult.results || []).map(r => r.ttc_minutes).filter(t => t !== null);
                const p50_ttc_min = ttcMinutes.length > 0 ? 
                    ttcMinutes[Math.floor(ttcMinutes.length * 0.5)] : null;
                const p90_ttc_min = ttcMinutes.length > 0 ? 
                    ttcMinutes[Math.floor(ttcMinutes.length * 0.9)] : null;

                return {
                    ...item,
                    p50_ttc_min,
                    p90_ttc_min
                };
            }));

            const response = new Response(JSON.stringify({
                items,
                page: pageNum,
                pageSize: pageSizeNum,
                total
            }), {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "private, max-age=300, stale-while-revalidate=60"
                }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            log("funnels_list_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    // 6.8) Funnels Detail API
    if (url.pathname === "/api/funnels/detail" && req.method === "GET") {
        try {
            const { project_id, content_id, source, window = "7d" } = Object.fromEntries(url.searchParams);
            
            if (!project_id || !content_id || !source) {
                const response = new Response("Missing required parameters: project_id, content_id, source", { status: 400 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Calculate time window
            const now = Date.now();
            let since: number;
            switch (window) {
                case "15m":
                    since = now - 15 * 60 * 1000;
                    break;
                case "24h":
                    since = now - 24 * 60 * 60 * 1000;
                    break;
                case "7d":
                default:
                    since = now - 7 * 24 * 60 * 60 * 1000;
                    break;
            }

            // Get content and source info
            const contentResult = await env.OPTIVIEW_DB.prepare(`
                SELECT id, url, type FROM content_assets WHERE id = ? AND project_id = ?
            `).bind(content_id, project_id).first<any>();

            const sourceResult = await env.OPTIVIEW_DB.prepare(`
                SELECT id, slug, name FROM ai_sources WHERE slug = ?
            `).bind(source).first<any>();

            if (!contentResult || !sourceResult) {
                const response = new Response("Content or source not found", { status: 404 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Get summary stats
            const summaryResult = await env.OPTIVIEW_DB.prepare(`
                WITH funnel_stats AS (
                    SELECT 
                        COUNT(*) as referrals,
                        (SELECT COUNT(*) FROM conversion_event ce 
                         WHERE ce.project_id = ar.project_id 
                         AND ce.content_id = ar.content_id 
                         AND ce.occurred_at >= ar.detected_at 
                         AND ce.occurred_at <= datetime(ar.detected_at, '+7 days')
                         AND ce.occurred_at >= ?) as conversions
                    FROM ai_referrals ar
                    WHERE ar.project_id = ? AND ar.content_id = ? AND ar.ai_source_id = ? AND ar.detected_at >= ?
                )
                SELECT 
                    referrals,
                    conversions,
                    CASE WHEN referrals > 0 
                         THEN CAST(conversions AS FLOAT) / referrals 
                         ELSE 0 END as conv_rate
                FROM funnel_stats
            `).bind(since, project_id, content_id, sourceResult.id, since).first<any>();

            // Calculate TTC percentiles
            const ttcResult = await env.OPTIVIEW_DB.prepare(`
                WITH last_touch AS (
                    SELECT 
                        ce.id,
                        ce.occurred_at,
                        (SELECT MAX(ar.detected_at) 
                         FROM ai_referrals ar 
                         WHERE ar.project_id = ce.project_id 
                         AND ar.content_id = ce.content_id 
                         AND ar.ai_source_id = ?
                         AND ar.detected_at <= ce.occurred_at
                         AND ar.detected_at >= datetime(ce.occurred_at, '-7 days')) as last_referral
                    FROM conversion_event ce
                    WHERE ce.project_id = ? 
                    AND ce.content_id = ?
                    AND ce.occurred_at >= ?
                    AND EXISTS (
                        SELECT 1 FROM ai_referrals ar 
                        WHERE ar.project_id = ce.project_id 
                        AND ar.content_id = ce.content_id 
                        AND ar.ai_source_id = ?
                        AND ar.detected_at <= ce.occurred_at
                        AND ar.detected_at >= datetime(ce.occurred_at, '-7 days')
                    )
                )
                SELECT 
                    CAST((julianday(occurred_at) - julianday(last_referral)) * 24 * 60 AS INTEGER) as ttc_minutes
                FROM last_touch
                WHERE last_referral IS NOT NULL
                ORDER BY ttc_minutes
            `).bind(sourceResult.id, project_id, content_id, since, sourceResult.id).all<any>();

            const ttcMinutes = (ttcResult.results || []).map(r => r.ttc_minutes).filter(t => t !== null);
            const p50_ttc_min = ttcMinutes.length > 0 ? 
                ttcMinutes[Math.floor(ttcMinutes.length * 0.5)] : null;
            const p90_ttc_min = ttcMinutes.length > 0 ? 
                ttcMinutes[Math.floor(ttcMinutes.length * 0.9)] : null;

            // Get timeseries data
            let timeseriesQuery: string;
            let timeseriesParams: any[];
            
            if (window === "15m") {
                timeseriesQuery = `
                    SELECT 
                        strftime('%Y-%m-%d %H:%M', datetime(ar.detected_at, 'start of hour', '+' || (strftime('%M', ar.detected_at) / 15) * 15 || ' minutes')) as ts,
                        COUNT(*) as referrals,
                        (SELECT COUNT(*) FROM conversion_event ce 
                         WHERE ce.project_id = ar.project_id 
                         AND ce.content_id = ar.content_id 
                         AND ce.occurred_at >= ar.detected_at 
                         AND ce.occurred_at <= datetime(ar.detected_at, '+7 days')
                         AND ce.occurred_at >= ?) as conversions
                    FROM ai_referrals ar
                    WHERE ar.project_id = ? AND ar.content_id = ? AND ar.ai_source_id = ? AND ar.detected_at >= ?
                    GROUP BY ts
                    ORDER BY ts
                `;
                timeseriesParams = [since, project_id, content_id, sourceResult.id, since];
            } else if (window === "24h") {
                timeseriesQuery = `
                    SELECT 
                        strftime('%Y-%m-%d %H:00', ar.detected_at) as ts,
                        COUNT(*) as referrals,
                        (SELECT COUNT(*) FROM conversion_event ce 
                         WHERE ce.project_id = ar.project_id 
                         AND ce.content_id = ar.content_id 
                         AND ce.occurred_at >= ar.detected_at 
                         AND ce.occurred_at <= datetime(ar.detected_at, '+7 days')
                         AND ce.occurred_at >= ?) as conversions
                    FROM ai_referrals ar
                    WHERE ar.project_id = ? AND ar.content_id = ? AND ar.ai_source_id = ? AND ar.detected_at >= ?
                    GROUP BY ts
                    ORDER BY ts
                `;
                timeseriesParams = [since, project_id, content_id, sourceResult.id, since];
            } else {
                timeseriesQuery = `
                    SELECT 
                        date(ar.detected_at) as ts,
                        COUNT(*) as referrals,
                        (SELECT COUNT(*) FROM conversion_event ce 
                         WHERE ce.project_id = ar.project_id 
                         AND ce.content_id = ar.content_id 
                         AND ce.occurred_at >= ar.detected_at 
                         AND ce.occurred_at <= datetime(ar.detected_at, '+7 days')
                         AND ce.occurred_at >= ?) as conversions
                    FROM ai_referrals ar
                    WHERE ar.project_id = ? AND ar.content_id = ? AND ar.ai_source_id = ? AND ar.detected_at >= ?
                    GROUP BY ts
                    ORDER BY ts
                `;
                timeseriesParams = [since, project_id, content_id, sourceResult.id, since];
            }

            const timeseriesResult = await env.OPTIVIEW_DB.prepare(timeseriesQuery).bind(...timeseriesParams).all<any>();

            // Get recent referral-conversion pairs
            const recentResult = await env.OPTIVIEW_DB.prepare(`
                WITH last_touch AS (
                    SELECT 
                        ce.id,
                        ce.occurred_at,
                        ce.amount_cents,
                        ce.currency,
                        (SELECT MAX(ar.detected_at) 
                         FROM ai_referrals ar 
                         WHERE ar.project_id = ce.project_id 
                         AND ar.content_id = ce.content_id 
                         AND ar.ai_source_id = ?
                         AND ar.detected_at <= ce.occurred_at
                         AND ar.detected_at >= datetime(ce.occurred_at, '-7 days')) as last_referral
                    FROM conversion_event ce
                    WHERE ce.project_id = ? 
                    AND ce.content_id = ?
                    AND ce.occurred_at >= ?
                    AND EXISTS (
                        SELECT 1 FROM ai_referrals ar 
                        WHERE ar.project_id = ce.project_id 
                        AND ar.content_id = ce.content_id 
                        AND ar.ai_source_id = ?
                        AND ar.detected_at <= ce.occurred_at
                        AND ar.detected_at >= datetime(ce.occurred_at, '-7 days')
                    )
                )
                SELECT 
                    last_referral as ref_detected_at,
                    occurred_at as conversion_at,
                    CAST((julianday(occurred_at) - julianday(last_referral)) * 24 * 60 AS INTEGER) as ttc_min,
                    amount_cents,
                    currency
                FROM last_touch
                WHERE last_referral IS NOT NULL
                ORDER BY occurred_at DESC
                LIMIT 20
            `).bind(sourceResult.id, project_id, content_id, since, sourceResult.id).all<any>();

            const detail = {
                content: { id: contentResult.id, url: contentResult.url },
                source: { slug: sourceResult.slug, name: sourceResult.name },
                summary: {
                    referrals: summaryResult?.referrals || 0,
                    conversions: summaryResult?.conversions || 0,
                    conv_rate: summaryResult?.conv_rate || 0,
                    p50_ttc_min,
                    p90_ttc_min
                },
                timeseries: timeseriesResult.results || [],
                recent: recentResult.results || []
            };

            const response = new Response(JSON.stringify(detail), {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "private, max-age=120"
                }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            log("funnels_detail_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    return null; // No API route matched
}

// Helper function for hashing
async function hashString(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

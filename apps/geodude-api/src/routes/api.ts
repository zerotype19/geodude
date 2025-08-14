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
               p.domain property_domain
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
        SELECT COUNT(*) total
        FROM interaction_events
        WHERE project_id = ? AND occurred_at BETWEEN ? AND ?
      `).bind(project_id, fromTs, toTs).first<any>();

            // Get breakdown by traffic class
            const classBreakdown = await env.OPTIVIEW_DB.prepare(`
        SELECT 
          metadata traffic_class,
          COUNT(*) count
        FROM interaction_events
        WHERE project_id = ? AND occurred_at BETWEEN ? AND ?
        GROUP BY metadata
        ORDER BY count DESC
      `).bind(project_id, fromTs, toTs).all<any>();

            // Get top AI sources - simplified to avoid JOIN issues
            const topSources = await env.OPTIVIEW_DB.prepare(`
        SELECT 
          ai_source_id,
          COUNT(*) count
        FROM interaction_events
        WHERE project_id = ? AND occurred_at BETWEEN ? AND ? AND ai_source_id IS NOT NULL
        GROUP BY ai_source_id
        ORDER BY count DESC
        LIMIT 5
      `).bind(project_id, fromTs, toTs).all<any>();

            // Get timeseries data - simplified for D1 compatibility
            const timeseries = await env.OPTIVIEW_DB.prepare(`
        SELECT 
          occurred_at day,
          COUNT(*) count,
          metadata traffic_class
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

            // Get total referrals and conversions in window (simplified to avoid subquery issues)
                        const referralsResult = await env.OPTIVIEW_DB.prepare(`
                SELECT COUNT(*) referrals
                FROM ai_referrals 
                WHERE project_id = ? AND detected_at >= ?
            `).bind(project_id, since).first<any>();
            
            const conversionsResult = await env.OPTIVIEW_DB.prepare(`
                SELECT COUNT(*) conversions
                FROM conversion_event 
                WHERE project_id = ? AND occurred_at >= ?
            `).bind(project_id, since).first<any>();

            const referrals = referralsResult?.referrals || 0;
            const conversions = conversionsResult?.conversions || 0;
            const conv_rate = referrals > 0 ? conversions / referrals : 0;

            // Get breakdown by source (simplified)
            const bySourceResult = await env.OPTIVIEW_DB.prepare(`
                SELECT 
                    s.id, s.slug, s.name,
                    COUNT(*) referrals,
                    0 conversions,
                    0 conv_rate
                FROM ai_referrals ar
                JOIN ai_sources s ON s.id = ar.ai_source_id
                WHERE ar.project_id = ? AND ar.detected_at >= ?
                GROUP BY s.id, s.slug, s.name
                ORDER BY referrals DESC
            `).bind(project_id, since).all<any>();

            // Simplified source data
            const bySource = (bySourceResult.results || []).map((source) => ({
                slug: source.slug,
                name: source.name,
                referrals: source.referrals,
                conversions: source.conversions,
                conv_rate: source.conv_rate,
                p50_ttc_min: null,
                p90_ttc_min: null
            }));

            // Simple timeseries data (empty for now to avoid SQL issues)
            const timeseriesResult = { results: [] };

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
                SELECT COUNT(DISTINCT ar.content_id, ar.ai_source_id) total
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
                SELECT 
                    ar.content_id,
                    ca.url,
                    s.slug source_slug,
                    s.name source_name,
                    COUNT(*) referrals,
                    0 conversions,
                    0 conv_rate,
                    MAX(ar.detected_at) last_referral,
                    NULL last_conversion
                FROM ai_referrals ar
                JOIN content_assets ca ON ca.id = ar.content_id
                JOIN ai_sources s ON s.id = ar.ai_source_id
                ${whereClause}
                GROUP BY ar.content_id, ar.ai_source_id
                ${orderBy}
                LIMIT ? OFFSET ?
            `;

            const itemsResult = await env.OPTIVIEW_DB.prepare(itemsQuery).bind(...params, pageSizeNum, offset).all<any>();

            // Simplified items with placeholder TTC values
            const items = (itemsResult.results || []).map((item) => ({
                ...item,
                p50_ttc_min: null,
                p90_ttc_min: null
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

            // Get summary stats (simplified)
            const summaryResult = await env.OPTIVIEW_DB.prepare(`
                SELECT 
                    COUNT(*) referrals,
                    0 conversions,
                    0 conv_rate
                FROM ai_referrals ar
                WHERE ar.project_id = ? AND ar.content_id = ? AND ar.ai_source_id = ? AND ar.detected_at >= ?
            `).bind(project_id, content_id, sourceResult.id, since).first<any>();

            // Simplified TTC calculation
            const p50_ttc_min = null;
            const p90_ttc_min = null;

            // Simplified timeseries data (empty for now to avoid SQL issues)
            const timeseriesResult = { results: [] };

            // Simplified recent pairs (empty for now)
            const recentResult = { results: [] };

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

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
               p.domain AS property_domain
        FROM api_key AS ak
        JOIN properties AS p ON ak.property_id = p.id
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
        SELECT COUNT(*) AS total
        FROM interaction_events
        WHERE project_id = ? AND occurred_at >= ? AND occurred_at < ?
      `).bind(project_id, fromTs, toTs).first<any>();

            // Get breakdown by traffic class
            const classBreakdown = await env.OPTIVIEW_DB.prepare(`
        SELECT 
          json_extract(metadata, '$.class') AS traffic_class,
          COUNT(*) AS cnt
        FROM interaction_events
        WHERE project_id = ? AND occurred_at >= ? AND occurred_at < ?
        GROUP BY traffic_class
        ORDER BY cnt DESC
      `).bind(project_id, fromTs, toTs).all<any>();

            // Get top AI sources
            const topSources = await env.OPTIVIEW_DB.prepare(`
        SELECT 
          s.slug AS source_slug,
          s.name AS source_name,
          COUNT(*) AS cnt
        FROM interaction_events AS ie
        JOIN ai_sources AS s ON s.id = ie.ai_source_id
        WHERE ie.project_id = ?
          AND ie.occurred_at >= ? AND ie.occurred_at < ?
        GROUP BY ie.ai_source_id
        ORDER BY cnt DESC
        LIMIT 5
      `).bind(project_id, fromTs, toTs).all<any>();

            // Get timeseries data by day + class
            const timeseries = await env.OPTIVIEW_DB.prepare(`
        SELECT 
          date(occurred_at) AS day,
          json_extract(metadata,'$.class') AS traffic_class,
          COUNT(*) AS cnt
        FROM interaction_events
        WHERE project_id = ? AND occurred_at >= ? AND occurred_at < ?
        GROUP BY day, traffic_class
        ORDER BY day
      `).bind(project_id, fromTs, toTs).all<any>();

            const summary = {
                total: totalResult?.total || 0,
                breakdown: (classBreakdown.results || []).map(row => ({
                    traffic_class: row.traffic_class,
                    count: row.cnt
                })),
                top_sources: (topSources.results || []).map(row => ({
                    source_slug: row.source_slug,
                    source_name: row.source_name,
                    count: row.cnt
                })),
                timeseries: (timeseries.results || []).map(row => ({
                    day: row.day,
                    traffic_class: row.traffic_class,
                    count: row.cnt
                }))
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

            // Return minimal test data with no SQL queries
            const summary = {
                totals: { 
                    referrals: 0, 
                    conversions: 0, 
                    conv_rate: 0.0 
                },
                by_source: [],
                timeseries: []
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

            // Return minimal test data with no SQL queries
            const pageNum = parseInt(page);
            const pageSizeNum = parseInt(pageSize);
            const total = 0;
            const items = [];

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

            // Return minimal test data with no SQL queries
            const detail = {
                content: { id: parseInt(content_id), url: "https://example.com" },
                source: { slug: source, name: "Test Source" },
                summary: {
                    referrals: 0,
                    conversions: 0,
                    conv_rate: 0,
                    p50_ttc_min: null,
                    p90_ttc_min: null
                },
                timeseries: [],
                recent: []
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

    // 6.9) Citations Summary API
    if (url.pathname === "/api/citations/summary" && req.method === "GET") {
        try {
            const { project_id, window = "7d" } = Object.fromEntries(url.searchParams);
            if (!project_id) {
                const response = new Response("Missing project_id", { status: 400 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Calculate window timestamps
            const now = Date.now();
            let windowMs: number;
            switch (window) {
                case "15m": windowMs = 15 * 60 * 1000; break;
                case "24h": windowMs = 24 * 60 * 60 * 1000; break;
                case "7d": 
                default: windowMs = 7 * 24 * 60 * 60 * 1000; break;
            }
            const fromTs = now - windowMs;

            // Get total citations
            const totalResult = await env.OPTIVIEW_DB.prepare(`
                SELECT COUNT(*) AS citations
                FROM ai_citations
                WHERE project_id = ? AND detected_at >= datetime(?, 'unixepoch', 'utc')
            `).bind(project_id, Math.floor(fromTs / 1000)).first<any>();

            // Get citations by source
            const bySourceResult = await env.OPTIVIEW_DB.prepare(`
                SELECT s.slug, s.name, COUNT(*) AS count
                FROM ai_citations ac
                JOIN ai_sources s ON s.id = ac.ai_source_id
                WHERE ac.project_id = ? AND ac.detected_at >= datetime(?, 'unixepoch', 'utc')
                GROUP BY ac.ai_source_id, s.slug, s.name
                ORDER BY count DESC
                LIMIT 10
            `).bind(project_id, Math.floor(fromTs / 1000)).all<any>();

            // Get top content
            const topContentResult = await env.OPTIVIEW_DB.prepare(`
                SELECT ca.id AS content_id, ca.url, COUNT(*) AS count
                FROM ai_citations ac
                JOIN content_assets ca ON ca.id = ac.content_id
                WHERE ac.project_id = ? AND ac.detected_at >= datetime(?, 'unixepoch', 'utc')
                GROUP BY ac.content_id, ca.id, ca.url
                ORDER BY count DESC
                LIMIT 5
            `).bind(project_id, Math.floor(fromTs / 1000)).all<any>();

            // Get timeseries data
            const timeseriesResult = await env.OPTIVIEW_DB.prepare(`
                SELECT DATE(detected_at) AS day, COUNT(*) AS count
                FROM ai_citations
                WHERE project_id = ? AND detected_at >= datetime(?, 'unixepoch', 'utc')
                GROUP BY DATE(detected_at)
                ORDER BY day
            `).bind(project_id, Math.floor(fromTs / 1000)).all<any>();

            const summary = {
                totals: { citations: totalResult?.citations || 0, by_source: bySourceResult.results || [] },
                top_content: (topContentResult.results || []).map(row => ({
                    content_id: row.content_id,
                    url: row.url,
                    count: row.count
                })),
                timeseries: (timeseriesResult.results || []).map(row => ({
                    day: row.day,
                    count: row.count
                }))
            };

            const response = new Response(JSON.stringify(summary), {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "private, max-age=120, stale-while-revalidate=120"
                }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            log("citations_summary_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    // 6.10) Citations List API
    if (url.pathname === "/api/citations" && req.method === "GET") {
        try {
            const {
                project_id,
                window = "7d",
                source = "",
                q = "",
                page = "1",
                pageSize = "50"
            } = Object.fromEntries(url.searchParams);

            if (!project_id) {
                const response = new Response("Missing project_id", { status: 400 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Calculate window timestamps
            const now = Date.now();
            let windowMs: number;
            switch (window) {
                case "15m": windowMs = 15 * 60 * 1000; break;
                case "24h": windowMs = 24 * 60 * 60 * 1000; break;
                case "7d": 
                default: windowMs = 7 * 24 * 60 * 60 * 1000; break;
            }
            const fromTs = now - windowMs;

            const pageNum = Math.max(1, parseInt(page));
            const pageSizeNum = Math.min(Math.max(1, parseInt(pageSize)), 100);
            const offset = (pageNum - 1) * pageSizeNum;

            // Build query conditions
            let whereConditions = ["ac.project_id = ?", "ac.detected_at >= datetime(?, 'unixepoch', 'utc')"];
            let params: any[] = [project_id, Math.floor(fromTs / 1000)];

            if (source) {
                whereConditions.push("s.slug = ?");
                params.push(source);
            }

            if (q.trim()) {
                whereConditions.push("(ca.url LIKE ? OR ac.snippet LIKE ?)");
                const searchTerm = `%${q.trim()}%`;
                params.push(searchTerm, searchTerm);
            }

            const whereClause = whereConditions.join(" AND ");

            // Get total count
            const countResult = await env.OPTIVIEW_DB.prepare(`
                SELECT COUNT(*) AS total
                FROM ai_citations ac
                JOIN ai_sources s ON s.id = ac.ai_source_id
                LEFT JOIN content_assets ca ON ca.id = ac.content_id
                WHERE ${whereClause}
            `).bind(...params).first<any>();

            // Get paginated results
            const itemsResult = await env.OPTIVIEW_DB.prepare(`
                SELECT 
                    ac.id,
                    ac.detected_at,
                    s.slug AS source_slug,
                    s.name AS source_name,
                    ca.id AS content_id,
                    ca.url AS content_url,
                    ac.ref_url,
                    ac.snippet
                FROM ai_citations ac
                JOIN ai_sources s ON s.id = ac.ai_source_id
                LEFT JOIN content_assets ca ON ca.id = ac.content_id
                WHERE ${whereClause}
                ORDER BY ac.detected_at DESC
                LIMIT ? OFFSET ?
            `).bind(...params, pageSizeNum, offset).all<any>();

            const result = {
                items: (itemsResult.results || []).map(row => ({
                    id: row.id,
                    detected_at: row.detected_at,
                    source: { slug: row.source_slug, name: row.source_name },
                    content: row.content_id ? { id: row.content_id, url: row.content_url } : null,
                    ref_url: row.ref_url,
                    snippet: row.snippet
                })),
                page: pageNum,
                pageSize: pageSizeNum,
                total: countResult?.total || 0
            };

            const response = new Response(JSON.stringify(result), {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "private, max-age=120, stale-while-revalidate=120"
                }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            log("citations_list_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    // 6.11) Citations Detail API
    if (url.pathname === "/api/citations/detail" && req.method === "GET") {
        try {
            const { id } = Object.fromEntries(url.searchParams);
            if (!id) {
                const response = new Response("Missing citation id", { status: 400 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Get the citation
            const citationResult = await env.OPTIVIEW_DB.prepare(`
                SELECT 
                    ac.id,
                    ac.project_id,
                    ac.detected_at,
                    ac.ref_url,
                    ac.snippet,
                    ac.confidence,
                    ac.metadata,
                    s.slug AS source_slug,
                    s.name AS source_name,
                    ca.id AS content_id,
                    ca.url AS content_url
                FROM ai_citations ac
                JOIN ai_sources s ON s.id = ac.ai_source_id
                LEFT JOIN content_assets ca ON ca.id = ac.content_id
                WHERE ac.id = ?
            `).bind(id).first<any>();

            if (!citationResult) {
                const response = new Response("Citation not found", { status: 404 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Get recent citations for same content (timeline context)
            const recentForContentResult = await env.OPTIVIEW_DB.prepare(`
                SELECT 
                    ac.id,
                    ac.detected_at,
                    s.slug AS source_slug,
                    s.name AS source_name
                FROM ai_citations ac
                JOIN ai_sources s ON s.id = ac.ai_source_id
                WHERE ac.content_id = ? AND ac.id != ?
                ORDER BY ac.detected_at DESC
                LIMIT 10
            `).bind(citationResult.content_id, id).all<any>();

            // Get recent referrals for context (last 10)
            const recentReferralsResult = await env.OPTIVIEW_DB.prepare(`
                SELECT 
                    ar.id,
                    ar.detected_at,
                    ar.ref_url,
                    s.slug AS source_slug,
                    s.name AS source_name
                FROM ai_referrals ar
                JOIN ai_sources s ON s.id = ar.ai_source_id
                WHERE ar.content_id = ?
                ORDER BY ar.detected_at DESC
                LIMIT 10
            `).bind(citationResult.content_id).all<any>();

            const detail = {
                citation: {
                    id: citationResult.id,
                    detected_at: citationResult.detected_at,
                    ref_url: citationResult.ref_url,
                    snippet: citationResult.snippet,
                    confidence: citationResult.confidence,
                    metadata: citationResult.metadata,
                    source: { slug: citationResult.source_slug, name: citationResult.source_name },
                    content: citationResult.content_id ? { 
                        id: citationResult.content_id, 
                        url: citationResult.content_url 
                    } : null
                },
                related: {
                    recent_for_content: (recentForContentResult.results || []).map(row => ({
                        id: row.id,
                        detected_at: row.detected_at,
                        source: { slug: row.source_slug, name: row.source_name }
                    })),
                    recent_referrals: (recentReferralsResult.results || []).map(row => ({
                        id: row.id,
                        detected_at: row.detected_at,
                        ref_url: row.ref_url,
                        source: { slug: row.source_slug, name: row.source_name }
                    }))
                }
            };

            const response = new Response(JSON.stringify(detail), {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "private, max-age=120"
                }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            log("citations_detail_error", { error: e.message, stack: e.stack });
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

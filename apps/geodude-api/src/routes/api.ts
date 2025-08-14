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

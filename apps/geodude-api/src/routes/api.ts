// Request and Response are global types in Cloudflare Workers
import { Env } from '../auth-middleware';
import { addCorsHeaders } from '../cors';
import { addBasicSecurityHeaders } from '../security-headers';

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
            const { project_id, name } = body;

            if (!project_id || !name) {
                const response = new Response("Missing required fields (project_id, name)", { status: 400 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Get org_id from project
            const projectData = await env.OPTIVIEW_DB.prepare(`
                SELECT org_id FROM project WHERE id = ?
            `).bind(project_id).first();

            if (!projectData) {
                const response = new Response("Project not found", { status: 404 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Generate unique key_id and secret
            const keyId = `key_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
            const secret = crypto.randomUUID().replace(/-/g, '');
            const secretHash = await hashString(secret);
            const currentTs = Math.floor(Date.now() / 1000);

            // Insert the API key (table is api_key, not api_keys)
            const result = await env.OPTIVIEW_DB.prepare(`
        INSERT INTO api_key (id, project_id, org_id, name, hash, created_ts)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(keyId, project_id, projectData.org_id, name, secretHash, currentTs).run();

            const response = new Response(JSON.stringify({
                id: keyId,
                secret_once: secret, // Show only once
                name,
                project_id,
                org_id: projectData.org_id,
                created_ts: currentTs
            }), {
                headers: { "Content-Type": "application/json" }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            console.error("keys_create_error", { error: e.message, stack: e.stack });
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

            // Note: api_key table doesn't have property_id, only project_id and org_id
            let query = `
        SELECT ak.id, ak.name, ak.created_ts, ak.last_used_ts, ak.revoked_ts, ak.org_id
        FROM api_key AS ak
        WHERE ak.project_id = ?
      `;
            let params = [project_id];

            // property_id filtering not supported as api_key table doesn't have property_id column
            // if (property_id) {
            //     query += " AND ak.property_id = ?";
            //     params.push(property_id);
            // }

            query += " ORDER BY ak.created_ts DESC";

            const keys = await env.OPTIVIEW_DB.prepare(query).bind(...params).all<any>();

            const response = new Response(JSON.stringify({ keys: keys.results || [] }), {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "public, max-age=300"
                }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            console.error("keys_list_error", { error: e.message, stack: e.stack });
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
            console.error("events_list_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    // 6.3) Events Summary API (New Spec with Legacy Support)
    if (url.pathname === "/api/events/summary" && req.method === "GET") {
        try {
            const { project_id, window = "24h", from, to, legacy } = Object.fromEntries(url.searchParams);
            if (!project_id) {
                const response = new Response("missing project_id", { status: 400 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Calculate time bounds from window or from/to override
            let fromTs: number, toTs: number;
            if (from && to) {
                fromTs = new Date(from).getTime();
                toTs = new Date(to).getTime();
            } else {
                const now = Date.now();
                switch (window) {
                    case "15m": fromTs = now - 15 * 60 * 1000; break;
                    case "24h": fromTs = now - 24 * 60 * 60 * 1000; break;
                    case "7d": fromTs = now - 7 * 24 * 60 * 60 * 1000; break;
                    default: fromTs = now - 24 * 60 * 60 * 1000; break;
                }
                toTs = now;
            }

            // Convert to SQL-compatible format (milliseconds -> seconds)
            const fromSql = fromTs / 1000;
            const toSql = toTs / 1000;

            // CTE for scoped events
            const scopedEvents = `
                SELECT ie.*, 
                       COALESCE(json_extract(ie.metadata, '$.class'), 'direct_human') as traffic_class
                FROM interaction_events ie
                WHERE ie.project_id = ? 
                  AND ie.occurred_at >= datetime(?, 'unixepoch')
                  AND ie.occurred_at <= datetime(?, 'unixepoch')
            `;

            // Get total events
            const totalResult = await env.OPTIVIEW_DB.prepare(`
                WITH scoped AS (${scopedEvents})
                SELECT COUNT(*) AS events FROM scoped
            `).bind(project_id, fromSql, toSql).first<any>();

            // Get AI-influenced count
            const aiInfluencedResult = await env.OPTIVIEW_DB.prepare(`
                WITH scoped AS (${scopedEvents})
                SELECT COUNT(*) AS ai_influenced 
                FROM scoped 
                WHERE ai_source_id IS NOT NULL 
                   OR traffic_class IN ('human_via_ai', 'ai_agent_crawl')
            `).bind(project_id, fromSql, toSql).first<any>();

            // Get breakdown by class
            const classBreakdown = await env.OPTIVIEW_DB.prepare(`
                WITH scoped AS (${scopedEvents})
                SELECT traffic_class AS class, COUNT(*) AS count
                FROM scoped
        GROUP BY traffic_class
                ORDER BY count DESC
            `).bind(project_id, fromSql, toSql).all<any>();

            // Get top AI sources
            const topSources = await env.OPTIVIEW_DB.prepare(`
                WITH scoped AS (${scopedEvents})
                SELECT ie.ai_source_id, s.slug, s.name, COUNT(*) AS count
                FROM scoped ie
                JOIN ai_sources s ON s.id = ie.ai_source_id
                WHERE ie.ai_source_id IS NOT NULL
                GROUP BY ie.ai_source_id, s.slug, s.name
                ORDER BY count DESC
        LIMIT 5
            `).bind(project_id, fromSql, toSql).all<any>();

            // Get timeseries data with appropriate bucketing
            let bucketFormat: string;
            switch (window) {
                case "15m": bucketFormat = "%Y-%m-%dT%H:%M:00.000Z"; break; // 1-minute buckets
                case "24h": bucketFormat = "%Y-%m-%dT%H:00:00.000Z"; break; // hourly buckets  
                case "7d": bucketFormat = "%Y-%m-%dT00:00:00.000Z"; break; // daily buckets
                default: bucketFormat = "%Y-%m-%dT%H:00:00.000Z"; break;
            }

            const timeseries = await env.OPTIVIEW_DB.prepare(`
                WITH scoped AS (${scopedEvents})
                SELECT strftime(?, occurred_at) AS ts, COUNT(*) AS count
                FROM scoped
                GROUP BY strftime(?, occurred_at)
                ORDER BY ts
            `).bind(project_id, fromSql, toSql, bucketFormat, bucketFormat).all<any>();

            // Build response based on legacy flag
            if (legacy === "1") {
                // Legacy format for backward compatibility
                const legacySummary = {
                    total: totalResult?.events || 0,
                    breakdown: (classBreakdown.results || []).map(row => ({
                        traffic_class: row.class,
                        count: row.count
                    })),
                    top_sources: (topSources.results || []).map(row => ({
                        source_slug: row.slug,
                        source_name: row.name,
                        count: row.count
                    })),
                    timeseries: (timeseries.results || []).map(row => ({
                        day: row.ts?.split('T')[0], // Extract date part
                        count: row.count
                    }))
                };

                const response = new Response(JSON.stringify(legacySummary), {
                    headers: {
                        "Content-Type": "application/json",
                        "Cache-Control": "private, max-age=60, stale-while-revalidate=60"
                    }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // New format
            const summary = {
                totals: {
                    events: totalResult?.events || 0,
                    ai_influenced: aiInfluencedResult?.ai_influenced || 0
                },
                by_class: (classBreakdown.results || []).map(row => ({
                    class: row.class,
                    count: row.count
                })),
                by_source: (topSources.results || []).map(row => ({
                    ai_source_id: row.ai_source_id,
                    slug: row.slug,
                    name: row.name,
                    count: row.count
                })),
                timeseries: (timeseries.results || []).map(row => ({
                    ts: row.ts,
                    count: row.count
                }))
            };

            const response = new Response(JSON.stringify(summary), {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "private, max-age=60, stale-while-revalidate=60"
                }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            console.error("events_summary_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    // 6.3.1) Events Recent API
    if (url.pathname === "/api/events/recent" && req.method === "GET") {
        try {
            const {
                project_id,
                window = "24h",
                from,
                to,
                page = "1",
                pageSize = "50",
                q = "",
                source = ""
            } = Object.fromEntries(url.searchParams);

            if (!project_id) {
                const response = new Response("missing project_id", { status: 400 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Calculate time bounds
            let fromTs: number, toTs: number;
            if (from && to) {
                fromTs = new Date(from).getTime();
                toTs = new Date(to).getTime();
            } else {
                const now = Date.now();
                switch (window) {
                    case "15m": fromTs = now - 15 * 60 * 1000; break;
                    case "24h": fromTs = now - 24 * 60 * 60 * 1000; break;
                    case "7d": fromTs = now - 7 * 24 * 60 * 60 * 1000; break;
                    default: fromTs = now - 24 * 60 * 60 * 1000; break;
                }
                toTs = now;
            }

            const fromSql = fromTs / 1000;
            const toSql = toTs / 1000;

            const pageNum = Math.max(1, parseInt(page));
            const pageSizeNum = Math.min(Math.max(1, parseInt(pageSize)), 200);
            const offset = (pageNum - 1) * pageSizeNum;

            // Build WHERE conditions
            let whereConditions = [
                "ie.project_id = ?",
                "ie.occurred_at >= datetime(?, 'unixepoch')",
                "ie.occurred_at <= datetime(?, 'unixepoch')"
            ];
            let params: any[] = [project_id, fromSql, toSql];

            // Add URL search filter
            if (q.trim()) {
                whereConditions.push("ca.url LIKE ?");
                params.push(`%${q.trim()}%`);
            }

            // Add source filter
            if (source.trim()) {
                whereConditions.push("s.slug = ?");
                params.push(source.trim());
            }

            const whereClause = whereConditions.join(" AND ");

            // Get total count for pagination
            const countResult = await env.OPTIVIEW_DB.prepare(`
                SELECT COUNT(*) AS total
                FROM interaction_events ie
                LEFT JOIN ai_sources s ON s.id = ie.ai_source_id
                LEFT JOIN content_assets ca ON ca.id = ie.content_id
                WHERE ${whereClause}
            `).bind(...params).first<any>();

            // Get paginated results
            const itemsResult = await env.OPTIVIEW_DB.prepare(`
                SELECT 
                    ie.id,
                    ie.occurred_at,
                    ie.event_type,
                    ie.metadata,
                    COALESCE(json_extract(ie.metadata, '$.class'), 'direct_human') as traffic_class,
                    s.id as ai_source_id,
                    s.slug as ai_source_slug,
                    s.name as ai_source_name,
                    ca.id as content_id,
                    ca.url as content_url
                FROM interaction_events ie
                LEFT JOIN ai_sources s ON s.id = ie.ai_source_id
                LEFT JOIN content_assets ca ON ca.id = ie.content_id
                WHERE ${whereClause}
                ORDER BY ie.occurred_at DESC
                LIMIT ? OFFSET ?
            `).bind(...params, pageSizeNum, offset).all<any>();

            const items = (itemsResult.results || []).map(row => {
                let metadata_snippet = {};
                let referrer = null;

                try {
                    if (row.metadata) {
                        const meta = JSON.parse(row.metadata);
                        metadata_snippet = {
                            pathname: meta.pathname || meta.p,
                            title: meta.title || meta.t
                        };
                        referrer = meta.referrer || meta.r;
                    }
                } catch (e) {
                    // Invalid JSON, leave as empty object
                }

                return {
                    id: row.id,
                    occurred_at: row.occurred_at,
                    event_type: row.event_type,
                    traffic_class: row.traffic_class,
                    ai_source: row.ai_source_id ? {
                        id: row.ai_source_id,
                        slug: row.ai_source_slug,
                        name: row.ai_source_name
                    } : null,
                    content: row.content_id ? {
                        id: row.content_id,
                        url: row.content_url
                    } : null,
                    referrer,
                    metadata_snippet
                };
            });

            const result = {
                items,
                page: pageNum,
                pageSize: pageSizeNum,
                total: countResult?.total || 0
            };

            const response = new Response(JSON.stringify(result), {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "private, max-age=15"
                }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            console.error("events_recent_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    // 6.3.2) Events Has-Any API
    if (url.pathname === "/api/events/has-any" && req.method === "GET") {
        try {
            const { project_id, window = "15m" } = Object.fromEntries(url.searchParams);
            if (!project_id) {
                const response = new Response("missing project_id", { status: 400 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Calculate time bounds
            const now = Date.now();
            let fromTs: number;
            switch (window) {
                case "15m": fromTs = now - 15 * 60 * 1000; break;
                case "24h": fromTs = now - 24 * 60 * 60 * 1000; break;
                case "7d": fromTs = now - 7 * 24 * 60 * 60 * 1000; break;
                default: fromTs = now - 15 * 60 * 1000; break;
            }

            const fromSql = fromTs / 1000;

            // Check if any events exist
            const hasAnyResult = await env.OPTIVIEW_DB.prepare(`
                SELECT 1 as has_events 
                FROM interaction_events 
                WHERE project_id = ? 
                  AND occurred_at >= datetime(?, 'unixepoch')
                LIMIT 1
            `).bind(project_id, fromSql).first<any>();

            // Get last event timestamp
            const lastEventResult = await env.OPTIVIEW_DB.prepare(`
                SELECT occurred_at as last_event_at
                FROM interaction_events
                WHERE project_id = ?
                  AND occurred_at >= datetime(?, 'unixepoch')
                ORDER BY occurred_at DESC
                LIMIT 1
            `).bind(project_id, fromSql).first<any>();

            // Get breakdown by class within window
            const classBreakdown = await env.OPTIVIEW_DB.prepare(`
                SELECT 
                    COALESCE(json_extract(metadata, '$.class'), 'direct_human') as class,
                    COUNT(*) as count
                FROM interaction_events
                WHERE project_id = ?
                  AND occurred_at >= datetime(?, 'unixepoch')
                GROUP BY class
                ORDER BY count DESC
            `).bind(project_id, fromSql).all<any>();

            const result = {
                has_any: !!hasAnyResult?.has_events,
                last_event_at: lastEventResult?.last_event_at || null,
                by_class: (classBreakdown.results || []).map(row => ({
                    class: row.class,
                    count: row.count
                }))
            };

            const response = new Response(JSON.stringify(result), {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "private, max-age=30"
                }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            console.error("events_has_any_error", { error: e.message, stack: e.stack });
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
            console.error("content_list_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    // 6.5) Sources API


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
            console.error("funnels_summary_error", { error: e.message, stack: e.stack });
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
            console.error("funnels_list_error", { error: e.message, stack: e.stack });
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
            console.error("funnels_detail_error", { error: e.message, stack: e.stack });
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

            // Citations table doesn't exist yet - return empty results gracefully
            // TODO: Replace with actual ai_citations table queries when implemented
            const totalResult = { citations: 0 };
            const bySourceResult = { results: [] };
            const topContentResult = { results: [] };

            // Get timeseries data (also empty for now)
            const timeseriesResult = { results: [] };

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
            console.error("citations_summary_error", { error: e.message, stack: e.stack });
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

            // Citations table doesn't exist yet - return empty results gracefully
            // TODO: Replace with actual ai_citations table queries when implemented
            const countResult = { total: 0 };
            const itemsResult = { results: [] };

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
            console.error("citations_list_error", { error: e.message, stack: e.stack });
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

            // Citations table doesn't exist yet - return 404 gracefully
            // TODO: Replace with actual ai_citations table queries when implemented
            const response = new Response("Citations feature not yet implemented", { status: 404 });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            console.error("citations_detail_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    // 7.1) Sessions Summary API
    if (url.pathname === "/api/sessions/summary" && req.method === "GET") {
        try {
            const { project_id, window = "24h", from, to } = Object.fromEntries(url.searchParams);

            if (!project_id) {
                const response = new Response(JSON.stringify({ error: "Missing project_id parameter" }), {
                    status: 400,
                    headers: { "Content-Type": "application/json" }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Calculate time window
            let sinceTime;
            if (from && to) {
                sinceTime = Math.floor(new Date(from).getTime() / 1000);
            } else {
                const windowMs = window === "15m" ? 15 * 60 * 1000 :
                    window === "24h" ? 24 * 60 * 60 * 1000 :
                        7 * 24 * 60 * 60 * 1000; // 7d default
                sinceTime = Math.floor((Date.now() - windowMs) / 1000);
            }

            // Get totals
            const totalsQuery = await env.OPTIVIEW_DB.prepare(`
                SELECT 
                    COUNT(*) as sessions,
                    COUNT(CASE WHEN ai_influenced = 1 THEN 1 END) as ai_influenced,
                    ROUND(AVG(events_count), 1) as avg_events_per_session
                FROM session_v1 
                WHERE project_id = ? AND started_at >= datetime(?, 'unixepoch')
            `).bind(project_id, sinceTime).first();

            // Get by_source breakdown
            const bySourceQuery = await env.OPTIVIEW_DB.prepare(`
                SELECT s.slug, s.name, COUNT(*) as count
                FROM session_v1 sv
                JOIN ai_sources s ON s.id = sv.primary_ai_source_id
                WHERE sv.project_id = ? 
                  AND sv.started_at >= datetime(?, 'unixepoch')
                  AND sv.primary_ai_source_id IS NOT NULL
                GROUP BY sv.primary_ai_source_id, s.slug, s.name
                ORDER BY count DESC
                LIMIT 10
            `).bind(project_id, sinceTime).all();

            // Get entry_pages breakdown  
            const entryPagesQuery = await env.OPTIVIEW_DB.prepare(`
                SELECT sv.entry_content_id as content_id, ca.url, COUNT(*) as count
                FROM session_v1 sv
                LEFT JOIN content_assets ca ON ca.id = sv.entry_content_id
                WHERE sv.project_id = ? 
                  AND sv.started_at >= datetime(?, 'unixepoch')
                  AND sv.entry_content_id IS NOT NULL
                GROUP BY sv.entry_content_id, ca.url
                ORDER BY count DESC
                LIMIT 10
            `).bind(project_id, sinceTime).all();

            // Get timeseries with proper bucketing
            let timeFormat;
            if (window === "15m") {
                timeFormat = "strftime('%Y-%m-%dT%H:%M:00Z', started_at)";
            } else if (window === "24h") {
                timeFormat = "strftime('%Y-%m-%dT%H:00:00Z', started_at)";
            } else {
                timeFormat = "strftime('%Y-%m-%dT00:00:00Z', started_at)";
            }

            const timeseriesQuery = await env.OPTIVIEW_DB.prepare(`
                SELECT ${timeFormat} as ts, COUNT(*) as count
                FROM session_v1
                WHERE project_id = ? AND started_at >= datetime(?, 'unixepoch')
                GROUP BY ${timeFormat}
                ORDER BY ts
            `).bind(project_id, sinceTime).all();

            const response = new Response(JSON.stringify({
                totals: {
                    sessions: totalsQuery?.sessions || 0,
                    ai_influenced: totalsQuery?.ai_influenced || 0,
                    avg_events_per_session: totalsQuery?.avg_events_per_session || 0
                },
                by_source: (bySourceQuery?.results || []).map(row => ({
                    slug: row.slug,
                    name: row.name,
                    count: row.count
                })),
                entry_pages: (entryPagesQuery?.results || []).map(row => ({
                    content_id: row.content_id,
                    url: row.url,
                    count: row.count
                })),
                timeseries: (timeseriesQuery?.results || []).map(row => ({
                    ts: row.ts,
                    count: row.count
                }))
            }), {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "private, max-age=60, stale-while-revalidate=60"
                }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            console.error("sessions_summary_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    // 7.2) Sessions Recent API
    if (url.pathname === "/api/sessions/recent" && req.method === "GET") {
        try {
            const {
                project_id,
                window = "24h",
                from,
                to,
                ai = "all",
                page = "1",
                pageSize = "50",
                q = ""
            } = Object.fromEntries(url.searchParams);

            if (!project_id) {
                const response = new Response(JSON.stringify({ error: "Missing project_id parameter" }), {
                    status: 400,
                    headers: { "Content-Type": "application/json" }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const pageNum = Math.max(1, parseInt(page));
            const pageSizeNum = Math.min(200, Math.max(1, parseInt(pageSize)));
            const offset = (pageNum - 1) * pageSizeNum;

            // Calculate time window
            let sinceTime;
            if (from && to) {
                sinceTime = Math.floor(new Date(from).getTime() / 1000);
            } else {
                const windowMs = window === "15m" ? 15 * 60 * 1000 :
                    window === "24h" ? 24 * 60 * 60 * 1000 :
                        7 * 24 * 60 * 60 * 1000;
                sinceTime = Math.floor((Date.now() - windowMs) / 1000);
            }

            // Build WHERE conditions
            let whereConditions = ["sv.project_id = ?", "sv.started_at >= datetime(?, 'unixepoch')"];
            let bindParams = [project_id, sinceTime];

            // AI filter
            if (ai === "only") {
                whereConditions.push("sv.ai_influenced = 1");
            } else if (ai === "none") {
                whereConditions.push("sv.ai_influenced = 0");
            }

            // Search filter
            if (q) {
                whereConditions.push("(sv.entry_url LIKE ? OR ca_entry.url LIKE ? OR ca_exit.url LIKE ?)");
                bindParams.push(`%${q}%`, `%${q}%`, `%${q}%`);
            }

            const whereClause = whereConditions.join(" AND ");

            // Get total count
            const countQuery = await env.OPTIVIEW_DB.prepare(`
                SELECT COUNT(*) as total
                FROM session_v1 sv
                LEFT JOIN content_assets ca_entry ON ca_entry.id = sv.entry_content_id
                LEFT JOIN content_assets ca_exit ON ca_exit.id = sv.exit_content_id
                WHERE ${whereClause}
            `).bind(...bindParams).first();

            // Get paginated results
            const sessionsQuery = await env.OPTIVIEW_DB.prepare(`
                SELECT 
                    sv.id,
                    sv.started_at,
                    sv.ended_at,
                    sv.events_count,
                    sv.ai_influenced,
                    sv.entry_content_id,
                    sv.entry_url,
                    sv.exit_content_id,
                    ca_entry.url as entry_content_url,
                    ca_exit.url as exit_content_url,
                    s.id as source_id,
                    s.slug as source_slug,
                    s.name as source_name
                FROM session_v1 sv
                LEFT JOIN content_assets ca_entry ON ca_entry.id = sv.entry_content_id
                LEFT JOIN content_assets ca_exit ON ca_exit.id = sv.exit_content_id
                LEFT JOIN ai_sources s ON s.id = sv.primary_ai_source_id
                WHERE ${whereClause}
                ORDER BY sv.started_at DESC
                LIMIT ? OFFSET ?
            `).bind(...bindParams, pageSizeNum, offset).all();

            const items = (sessionsQuery?.results || []).map(row => {
                const startTime = new Date(row.started_at);
                const endTime = row.ended_at ? new Date(row.ended_at) : new Date();
                const durationSec = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

                return {
                    id: row.id,
                    started_at: row.started_at,
                    ended_at: row.ended_at,
                    duration_sec: durationSec,
                    events_count: row.events_count,
                    ai_influenced: row.ai_influenced === 1,
                    primary_ai_source: row.source_id ? {
                        slug: row.source_slug,
                        name: row.source_name
                    } : null,
                    entry: row.entry_content_id ? {
                        content_id: row.entry_content_id,
                        url: row.entry_content_url || row.entry_url
                    } : { url: row.entry_url },
                    exit: row.exit_content_id ? {
                        content_id: row.exit_content_id,
                        url: row.exit_content_url
                    } : null
                };
            });

            const response = new Response(JSON.stringify({
                items,
                page: pageNum,
                pageSize: pageSizeNum,
                total: countQuery?.total || 0
            }), {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "private, max-age=60, stale-while-revalidate=60"
                }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            console.error("sessions_recent_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    // 7.3) Sessions Journey API
    if (url.pathname === "/api/sessions/journey" && req.method === "GET") {
        try {
            const { project_id, session_id } = Object.fromEntries(url.searchParams);

            if (!project_id || !session_id) {
                const response = new Response(JSON.stringify({ error: "Missing project_id or session_id parameter" }), {
                    status: 400,
                    headers: { "Content-Type": "application/json" }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Get session details
            const sessionQuery = await env.OPTIVIEW_DB.prepare(`
                SELECT 
                    sv.id,
                    sv.started_at,
                    sv.ended_at,
                    sv.events_count,
                    sv.ai_influenced,
                    sv.entry_content_id,
                    sv.entry_url,
                    sv.exit_content_id,
                    ca_entry.url as entry_content_url,
                    ca_exit.url as exit_content_url,
                    s.id as source_id,
                    s.slug as source_slug,
                    s.name as source_name
                FROM session_v1 sv
                LEFT JOIN content_assets ca_entry ON ca_entry.id = sv.entry_content_id
                LEFT JOIN content_assets ca_exit ON ca_exit.id = sv.exit_content_id
                LEFT JOIN ai_sources s ON s.id = sv.primary_ai_source_id
                WHERE sv.project_id = ? AND sv.id = ?
            `).bind(project_id, session_id).first();

            if (!sessionQuery) {
                const response = new Response(JSON.stringify({ error: "Session not found" }), {
                    status: 404,
                    headers: { "Content-Type": "application/json" }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Get session events
            const eventsQuery = await env.OPTIVIEW_DB.prepare(`
                SELECT 
                    ie.id,
                    ie.occurred_at,
                    ie.event_type,
                    ie.content_id,
                    ca.url as content_url,
                    s.id as ai_source_id,
                    s.slug as ai_source_slug,
                    s.name as ai_source_name
                FROM session_event_map sem
                JOIN interaction_events ie ON ie.id = sem.event_id
                LEFT JOIN content_assets ca ON ca.id = ie.content_id
                LEFT JOIN ai_sources s ON s.id = ie.ai_source_id
                WHERE sem.session_id = ?
                ORDER BY ie.occurred_at ASC
            `).bind(session_id).all();

            const session = {
                id: sessionQuery.id,
                started_at: sessionQuery.started_at,
                ended_at: sessionQuery.ended_at,
                events_count: sessionQuery.events_count,
                ai_influenced: sessionQuery.ai_influenced === 1,
                primary_ai_source: sessionQuery.source_id ? {
                    slug: sessionQuery.source_slug,
                    name: sessionQuery.source_name
                } : null,
                entry: sessionQuery.entry_content_id ? {
                    content_id: sessionQuery.entry_content_id,
                    url: sessionQuery.entry_content_url || sessionQuery.entry_url
                } : { url: sessionQuery.entry_url },
                exit: sessionQuery.exit_content_id ? {
                    content_id: sessionQuery.exit_content_id,
                    url: sessionQuery.exit_content_url
                } : null
            };

            const events = (eventsQuery?.results || []).map(row => ({
                id: row.id,
                occurred_at: row.occurred_at,
                event_type: row.event_type,
                content: row.content_id ? {
                    id: row.content_id,
                    url: row.content_url
                } : null,
                ai_source: row.ai_source_id ? {
                    slug: row.ai_source_slug,
                    name: row.ai_source_name
                } : null
            }));

            const response = new Response(JSON.stringify({
                session,
                events
            }), {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "private, max-age=60, stale-while-revalidate=60"
                }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            console.error("sessions_journey_error", { error: e.message, stack: e.stack });
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

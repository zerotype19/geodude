// Request and Response are global types in Cloudflare Workers
import { Env } from '../auth-middleware';
import { addCorsHeaders } from '../cors';
import { addBasicSecurityHeaders } from '../security-headers';
import { validateRequestBody } from '../schema-validator';

export async function handleApiRoutes(
    req: Request,
    env: Env,
    url: URL,
    origin: string | null,
    attach: (resp: Response) => Response,
    addBasicSecurityHeaders: (resp: Response) => Response,
    addCorsHeaders: (resp: Response, origin: string | null) => Response
): Promise<Response | null> {
    console.log('🔍 handleApiRoutes: Called for', url.pathname, req.method);
    console.log('🔍 handleApiRoutes: env keys:', Object.keys(env || {}));

    // 6.1) API Keys Management
    if (url.pathname === "/api/keys" && req.method === "POST") {
        try {
            // Check authentication
            const sessionCookie = req.headers.get("cookie");
            if (!sessionCookie) {
                const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
            if (!sessionMatch) {
                const response = new Response(JSON.stringify({ error: "Invalid session" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const sessionId = sessionMatch[1];
            const sessionData = await env.OPTIVIEW_DB.prepare(`
                SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
            `).bind(sessionId, new Date().toISOString()).first();

            if (!sessionData) {
                const response = new Response(JSON.stringify({ error: "Session expired" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const body = await req.json() as any;
            const { project_id, name } = body;

            if (!project_id || !name) {
                const response = new Response("Missing required fields (project_id, name)", { status: 400 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Verify user has access to this project
            const accessCheck = await env.OPTIVIEW_DB.prepare(`
                SELECT COUNT(*) as count 
                FROM org_member om
                JOIN project p ON p.org_id = om.org_id
                WHERE om.user_id = ? AND p.id = ?
            `).bind(sessionData.user_id, project_id).first();

            if (accessCheck.count === 0) {
                const response = new Response(JSON.stringify({ error: "Access denied to project" }), {
                    status: 403,
                    headers: { "Content-Type": "application/json" }
                });
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
                status: 'active',
                created_at: new Date(currentTs * 1000).toISOString(),
                last_used_at: null,
                revoked_at: null,
                grace_expires_at: null,
                project_id,
                org_id: projectData.org_id,
                created_ts: currentTs // Keep for backward compatibility
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
            // Check authentication
            const sessionCookie = req.headers.get("cookie");
            if (!sessionCookie) {
                const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
            if (!sessionMatch) {
                const response = new Response(JSON.stringify({ error: "Invalid session" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const sessionId = sessionMatch[1];
            const sessionData = await env.OPTIVIEW_DB.prepare(`
                SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
            `).bind(sessionId, new Date().toISOString()).first();

            if (!sessionData) {
                const response = new Response(JSON.stringify({ error: "Session expired" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const { project_id, property_id } = Object.fromEntries(url.searchParams);
            if (!project_id) {
                const response = new Response("Missing project_id", { status: 400 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Verify user has access to this project
            const accessCheck = await env.OPTIVIEW_DB.prepare(`
                SELECT COUNT(*) as count 
                FROM org_member om
                JOIN project p ON p.org_id = om.org_id
                WHERE om.user_id = ? AND p.id = ?
            `).bind(sessionData.user_id, project_id).first();

            if (accessCheck.count === 0) {
                const response = new Response(JSON.stringify({ error: "Access denied to project" }), {
                    status: 403,
                    headers: { "Content-Type": "application/json" }
                });
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

            // Transform the API keys to match frontend expectations
            const transformedKeys = (keys.results || []).map(key => ({
                id: key.id,
                name: key.name,
                status: key.revoked_ts ? 'revoked' : 'active', // Determine status based on revoked_ts
                created_at: key.created_ts ? new Date(key.created_ts * 1000).toISOString() : null, // Convert Unix timestamp to ISO string
                last_used_at: key.last_used_ts ? new Date(key.last_used_ts * 1000).toISOString() : null,
                revoked_at: key.revoked_ts ? new Date(key.revoked_ts * 1000).toISOString() : null,
                grace_expires_at: null // This field doesn't exist in our current schema
            }));

            const response = new Response(JSON.stringify({ keys: transformedKeys }), {
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

            // Import cache utilities
            const { getOrSetJSON, getProjectVersion } = await import('../lib/cache');
            const { CACHE_TTL } = await import('../lib/config');

            // Get project version for cache invalidation
            const v = await getProjectVersion(env.CACHE, project_id);
            const cacheKey = `events:summary:v${v}:${project_id}:${window}:${from || ''}:${to || ''}:${legacy || ''}`;

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
            const generateSummary = async () => {
                if (legacy === "1") {
                    // Legacy format for backward compatibility
                    return {
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
                }

                // New format
                return {
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
            };

            // Get cached or generate summary
            const summary = await getOrSetJSON(env.CACHE, cacheKey, CACHE_TTL.eventsSummary, generateSummary, {
                CACHE_OFF: env.CACHE_OFF,
                metrics: async (name) => {
                    try {
                        const current = await env.CACHE.get(name) || "0";
                        await env.CACHE.put(name, String(parseInt(current) + 1), { expirationTtl: 300 }); // 5 minutes
                    } catch (e) {
                        console.error(`Failed to record metric ${name}:`, e);
                    }
                }
            });

            const response = new Response(JSON.stringify(summary), {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
                    "Pragma": "no-cache",
                    "Expires": "0",
                    "X-Cache-Buster": Date.now().toString()
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
            const params = Object.fromEntries(url.searchParams);
            const {
                project_id,
                window = "24h",
                q = "",
                type = "",
                aiOnly = "false",
                page = "1",
                pageSize = "50"
            } = params;

            if (!project_id) {
                const response = new Response("missing project_id", { status: 400 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const pageNum = Math.max(1, parseInt(page));
            const pageSizeNum = Math.min(Math.max(1, parseInt(pageSize)), 100);
            const offset = (pageNum - 1) * pageSizeNum;

            // Build WHERE conditions
            let whereConditions = ["ca.project_id = ?"];
            let bindParams = [project_id];

            if (q.trim()) {
                whereConditions.push("ca.url LIKE ?");
                bindParams.push(`%${q.trim()}%`);
            }

            if (type.trim()) {
                whereConditions.push("ca.type = ?");
                bindParams.push(type.trim());
            }

            const whereClause = whereConditions.join(" AND ");

            // Get total count
            const countResult = await env.OPTIVIEW_DB.prepare(`
                SELECT COUNT(*) as total
                FROM content_assets ca
                WHERE ${whereClause}
            `).bind(...bindParams).first();

            // Get paginated content with metrics
            const content = await env.OPTIVIEW_DB.prepare(`
                SELECT 
                    ca.id, ca.url, ca.type, ca.metadata, ca.created_at,
                    COALESCE((SELECT MAX(occurred_at) FROM interaction_events ie WHERE ie.project_id=ca.project_id AND ie.content_id=ca.id), '1970-01-01') AS last_seen,
                    COALESCE((SELECT COUNT(*) FROM interaction_events ie WHERE ie.project_id=ca.project_id AND ie.content_id=ca.id AND ie.occurred_at>=datetime('now','-1 day')), 0) AS events_24h,
                    COALESCE((SELECT COUNT(*) FROM interaction_events ie WHERE ie.project_id=ca.project_id AND ie.content_id=ca.id AND ie.occurred_at>=datetime('now','-15 minutes')), 0) AS events_15m
                FROM content_assets ca
                WHERE ${whereClause}
                ORDER BY ca.created_at DESC
                LIMIT ? OFFSET ?
            `).bind(...bindParams, pageSizeNum, offset).all<any>();

            const items = (content.results || []).map(row => ({
                id: row.id,
                url: row.url,
                type: row.type,
                last_seen: row.last_seen,
                events_15m: row.events_15m || 0,
                events_24h: row.events_24h || 0,
                ai_referrals_24h: 0,
                by_source_24h: [],
                coverage_score: row.events_24h > 0 ? 50 : 0
            }));

            const response = new Response(JSON.stringify({
                items,
                page: pageNum,
                pageSize: pageSizeNum,
                total: countResult?.total || 0
            }), {
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

    // 6.3.5) Events Ingestion API (with cache invalidation)
    if (url.pathname === "/api/events" && req.method === "POST") {
        console.log('🔍 Events API: POST /api/events called');
        console.log('🔍 Events API: env keys available:', Object.keys(env || {}));
        console.log('🔍 Events API: env.OPTIVIEW_DB available:', !!env.OPTIVIEW_DB);

        try {
            // Check Content-Type
            const contentType = req.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const response = new Response("Content-Type must be application/json", { status: 415 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // IP rate limiting (120 rpm per IP, 60s window) - temporarily disabled for debugging
            /*
            const clientIP = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
            const ipRateLimitKey = `rl:ip:referrals:${clientIP}`;
            const ipCount = await env.AI_FINGERPRINTS.get(ipRateLimitKey);

            if (!ipCount) {
                await env.AI_FINGERPRINTS.put(ipRateLimitKey, "1", { expirationTtl: 60 });
            } else if (parseInt(ipCount) >= 120) {
                const response = new Response(JSON.stringify({
                    error: "IP rate limit exceeded",
                    code: "ip_ratelimit",
                    retry_after: 60
                }), {
                    status: 429,
                    headers: {
                        "Content-Type": "application/json",
                        "Retry-After": "60"
                    }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            } else {
                await env.AI_FINGERPRINTS.put(ipRateLimitKey, String(parseInt(ipCount) + 1), { expirationTtl: 60 });
            }
            */

            // Get request body and validate size
            const bodyText = await req.text();
            if (bodyText.length > 1024) {
                const response = new Response(JSON.stringify({
                    error: "Request body too large",
                    max_size_kb: 1,
                    actual_size_kb: Math.round(bodyText.length / 1024)
                }), { status: 413, headers: { "Content-Type": "application/json" } });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Parse and validate body
            const body = JSON.parse(bodyText);
            const validation = validateRequestBody("/api/events", body, bodyText.length);

            if (!validation.valid) {
                const response = new Response(JSON.stringify({
                    error: "Validation failed",
                    details: validation.errors
                }), { status: 400, headers: { "Content-Type": "application/json" } });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Import ingest guards
            const { hostnameAllowed, sanitizeMetadata } = await import('../lib/ingest-guards');

            // Process batched events
            const { project_id, property_id, events } = validation.sanitizedData;

            // IP rate limiting (120 rpm per IP, 60s window)
            if (env.RL_OFF !== "1") {
                try {
                    const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "0.0.0.0";
                    const { ipRateLimit } = await import('../lib/ratelimit');
                    const { MetricsManager } = await import('../lib/metrics');
                    const metrics = new MetricsManager(env.CACHE);
                    const { ok, remaining, resetAt } = await ipRateLimit(env.RL, ip, "/api/events", 120, 60, metrics);
                    if (!ok) {
                        const response = new Response(JSON.stringify({
                            error: "rate_limited",
                            retry_after: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
                        }), {
                            status: 429,
                            headers: {
                                "Content-Type": "application/json",
                                "Retry-After": "60"
                            }
                        });
                        return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
                    }
                } catch (e) {
                    console.error("Rate limiting error:", e);
                    // Continue if rate limiting fails
                }
            }

            // Validate API key from header
            const keyId = req.headers.get('x-optiview-key-id');
            if (!keyId) {
                const response = new Response(JSON.stringify({ error: "Missing API key header: x-optiview-key-id" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Look up API key by ID (not hash)
            const apiKey = await env.OPTIVIEW_DB.prepare(`
                SELECT * FROM api_key WHERE id = ? AND revoked_ts IS NULL
            `).bind(keyId).first();

            if (!apiKey) {
                const response = new Response(JSON.stringify({ error: "Invalid API key" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Validate project_id matches API key
            if (project_id !== apiKey.project_id) {
                const response = new Response(JSON.stringify({ error: "Project ID mismatch" }), {
                    status: 403,
                    headers: { "Content-Type": "application/json" }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Verify property belongs to project
            const propertyCheck = await env.OPTIVIEW_DB.prepare(`
                SELECT id, domain FROM properties WHERE id = ? AND project_id = ?
            `).bind(property_id, project_id).first();

            if (!propertyCheck) {
                const response = new Response(JSON.stringify({ error: "Property not found or not accessible" }), {
                    status: 403,
                    headers: { "Content-Type": "application/json" }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Process each event in the batch
            const now = new Date().toISOString();
            const insertResults = [];

            for (const event of events) {
                const { event_type, metadata, occurred_at } = event;

                // Validate and normalize event_type
                let normalizedEventType = event_type;
                if (event_type === 'pageview') {
                    normalizedEventType = 'view'; // Database expects 'view' not 'pageview'
                }

                if (!['view', 'click', 'custom'].includes(normalizedEventType)) {
                    continue; // Skip invalid events
                }

                // Create or find content asset for proper linking
                let contentId = null;
                if (metadata?.url) {
                    try {
                        // First try to find existing content
                        let contentResult = await env.OPTIVIEW_DB.prepare(`
                            SELECT id FROM content_assets WHERE url = ? AND project_id = ? LIMIT 1
                        `).bind(metadata.url, project_id).first();
                        
                        if (contentResult?.id) {
                            contentId = contentResult.id;
                        } else {
                            // Create new content asset if it doesn't exist
                            const newContentResult = await env.OPTIVIEW_DB.prepare(`
                                INSERT INTO content_assets (project_id, url, title, created_at, updated_at)
                                VALUES (?, ?, ?, ?, ?)
                            `).bind(
                                project_id, 
                                metadata.url, 
                                metadata.title || metadata.url,
                                now,
                                now
                            ).run();
                            
                            // Get the newly created content ID
                            contentId = newContentResult.meta?.last_row_id || null;
                        }
                    } catch (e) {
                        console.error('Error handling content asset:', e);
                    }
                }

                // Store event in interaction_events table
                try {
                    // Debug logging to identify undefined values
                    const insertValues = [
                        project_id,
                        property_id,
                        contentId,
                        null, // ai_source_id (can be enhanced later)
                        normalizedEventType,
                        JSON.stringify(metadata || {}),
                        occurred_at || now
                    ];

                    console.log('🔍 Events API Debug - Insert values:', {
                        project_id,
                        property_id,
                        contentId,
                        ai_source_id: null,
                        event_type: normalizedEventType,
                        metadata: JSON.stringify(metadata || {}),
                        occurred_at: occurred_at || now,
                        rawValues: insertValues
                    });

                    // Validate all values are defined before insertion
                    if (insertValues.some(val => val === undefined)) {
                        console.error('❌ Events API Error - Undefined values detected:', {
                            project_id: typeof project_id,
                            property_id: typeof property_id,
                            contentId: typeof contentId,
                            event_type: typeof normalizedEventType,
                            metadata: typeof metadata,
                            occurred_at: typeof occurred_at
                        });
                        throw new Error('Cannot insert undefined values into database');
                    }

                    const result = await env.OPTIVIEW_DB.prepare(`
                        INSERT INTO interaction_events (
                            project_id, property_id, content_id, ai_source_id, 
                            event_type, metadata, occurred_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    `).bind(...insertValues).run();

                    insertResults.push(result);
                } catch (error) {
                    console.error('Error inserting event:', error);
                    // Continue processing other events
                }
            }

            // Create or update session records for real-time dashboard
            try {
                for (const event of events) {
                    const { metadata, occurred_at } = event;
                    const eventTime = occurred_at || now;
                    
                    // Extract session and visitor info from metadata
                    const sessionId = metadata?.sid;
                    const visitorId = metadata?.vid;
                    
                    // Create a new session for each event to ensure real-time data
                    const contentId = await env.OPTIVIEW_DB.prepare(`
                        SELECT id FROM content_assets WHERE url = ? AND project_id = ? LIMIT 1
                    `).bind(metadata.url, project_id).first().then(r => r?.id || null);

                    await env.OPTIVIEW_DB.prepare(`
                        INSERT INTO session_v1 (
                            project_id, started_at, ended_at, events_count,
                            ai_influenced, primary_ai_source_id
                        ) VALUES (?, ?, ?, ?, ?, ?)
                    `).bind(
                        project_id, eventTime, eventTime, 1, 0, null
                    ).run();
                }
            } catch (sessionError) {
                console.error('Error creating/updating sessions:', sessionError);
                // Don't fail the request, just log the error
            }

            // Clean up expired sessions (older than 30 minutes)
            try {
                const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
                await env.OPTIVIEW_DB.prepare(`
                    UPDATE session_v1 
                    SET ended_at = started_at 
                    WHERE project_id = ? 
                      AND ended_at IS NULL 
                      AND started_at < ?
                `).bind(project_id, thirtyMinutesAgo).run();
            } catch (cleanupError) {
                console.error('Error cleaning up expired sessions:', cleanupError);
                // Don't fail the request, just log the error
            }

            // Update API key last_used_ts
            await env.OPTIVIEW_DB.prepare(`
                UPDATE api_key SET last_used_ts = unixepoch() WHERE id = ?
            `).bind(apiKey.id).run();

            // Invalidate cache for this project
            const { bumpProjectVersion } = await import('../lib/cache');
            await bumpProjectVersion(env.CACHE, project_id);

            const response = new Response(JSON.stringify({
                success: true,
                processed: insertResults.length,
                total: events.length
            }), {
                status: 201,
                headers: { "Content-Type": "application/json" }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            console.error("events_create_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    // 6.4) Referrals API (with schema validation)
    if (url.pathname === "/api/referrals" && req.method === "POST") {
        try {
            // Check Content-Type
            const contentType = req.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const response = new Response("Content-Type must be application/json", { status: 415 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Get request body and validate size
            const bodyText = await req.text();
            if (bodyText.length > 1024) {
                const response = new Response(JSON.stringify({
                    error: "Request body too large",
                    max_size_kb: 1,
                    actual_size_kb: Math.round(bodyText.length / 1024)
                }), { status: 413, headers: { "Content-Type": "application/json" } });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Parse and validate body
            const body = JSON.parse(bodyText);
            const validation = validateRequestBody("/api/referrals", body, bodyText.length);

            if (!validation.valid) {
                const response = new Response(JSON.stringify({
                    error: "Validation failed",
                    details: validation.errors
                }), { status: 400, headers: { "Content-Type": "application/json" } });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const result = await env.OPTIVIEW_DB.prepare(`
                INSERT INTO ai_referrals (ai_source_id, content_id, ref_type, detected_at)
                VALUES (?, ?, ?, ?)
            `).bind(
                validation.sanitizedData.ai_source_id,
                validation.sanitizedData.content_id || null,
                validation.sanitizedData.ref_type,
                validation.sanitizedData.detected_at || Date.now()
            ).run();

            // Invalidate cache for this project (need to get project_id from content_assets)
            if (validation.sanitizedData.content_id) {
                const projectData = await env.OPTIVIEW_DB.prepare(`
                    SELECT p.project_id FROM content_assets ca
                    JOIN properties p ON p.id = ca.property_id
                    WHERE ca.id = ?
                `).bind(validation.sanitizedData.content_id).first<{ project_id: string }>();

                if (projectData?.project_id) {
                    const { bumpProjectVersion } = await import('../lib/cache');
                    await bumpProjectVersion(env.CACHE, projectData.project_id);
                }
            }

            const response = new Response(JSON.stringify({
                id: result.meta.last_row_id,
                ai_source_id: validation.sanitizedData.ai_source_id,
                ref_type: validation.sanitizedData.ref_type
            }), {
                headers: { "Content-Type": "application/json" }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            console.error("referrals_create_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    // 6.5) Referrals Summary API (with caching)
    if (url.pathname === "/api/referrals/summary" && req.method === "GET") {
        try {
            const { project_id, window = "24h", from, to } = Object.fromEntries(url.searchParams);
            if (!project_id) {
                const response = new Response("missing project_id", { status: 400 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Import cache utilities
            const { getOrSetJSON, getProjectVersion } = await import('../lib/cache');
            const { CACHE_TTL } = await import('../lib/config');

            // Get project version for cache invalidation
            const v = await getProjectVersion(env.CACHE, project_id);
            const cacheKey = `referrals:summary:v${v}:${project_id}:${window}:${from || ''}:${to || ''}`;

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

            // Generate referrals summary with caching
            const generateReferralsSummary = async () => {
                // Get total referrals
                const totalResult = await env.OPTIVIEW_DB.prepare(`
                    SELECT COUNT(*) AS total
                    FROM ai_referrals ar
                    JOIN content_assets ca ON ca.id = ar.content_id
                    JOIN properties p ON p.id = ca.property_id
                    WHERE p.project_id = ? 
                      AND ar.detected_at >= datetime(?, 'unixepoch')
                      AND ar.detected_at <= datetime(?, 'unixepoch')
                `).bind(project_id, fromSql, toSql).first<any>();

                // Get referrals by AI source
                const bySource = await env.OPTIVIEW_DB.prepare(`
                    SELECT 
                        ar.ai_source_id,
                        ais.slug,
                        ais.name,
                        COUNT(*) AS count
                    FROM ai_referrals ar
                    JOIN content_assets ca ON ca.id = ar.content_id
                    JOIN properties p ON p.id = ca.property_id
                    JOIN ai_sources ais ON ais.id = ar.ai_source_id
                    WHERE p.project_id = ? 
                      AND ar.detected_at >= datetime(?, 'unixepoch')
                      AND ar.detected_at <= datetime(?, 'unixepoch')
                    GROUP BY ar.ai_source_id, ais.slug, ais.name
                    ORDER BY count DESC
                    LIMIT 10
                `).bind(project_id, fromSql, toSql).all<any>();

                // Get referrals by type
                const byType = await env.OPTIVIEW_DB.prepare(`
                    SELECT 
                        ar.ref_type,
                        COUNT(*) AS count
                    FROM ai_referrals ar
                    JOIN content_assets ca ON ca.id = ar.content_id
                    JOIN properties p ON p.id = ca.property_id
                    WHERE p.project_id = ? 
                      AND ar.detected_at >= datetime(?, 'unixepoch')
                      AND ar.detected_at <= datetime(?, 'unixepoch')
                    GROUP BY ar.ref_type
                    ORDER BY count DESC
                `).bind(project_id, fromSql, toSql).all<any>();

                return {
                    totals: {
                        referrals: totalResult?.total || 0
                    },
                    by_source: (bySource.results || []).map(row => ({
                        ai_source_id: row.ai_source_id,
                        slug: row.slug,
                        name: row.name,
                        count: row.count
                    })),
                    by_type: (byType.results || []).map(row => ({
                        ref_type: row.ref_type,
                        count: row.count
                    }))
                };
            };

            // Get cached or generate summary
            const summary = await getOrSetJSON(env.CACHE, cacheKey, CACHE_TTL.referralsSummary, generateReferralsSummary, {
                CACHE_OFF: env.CACHE_OFF,
                metrics: async (name) => {
                    try {
                        const current = await env.CACHE.get(name) || "0";
                        await env.CACHE.put(name, String(parseInt(current) + 1), { expirationTtl: 300 }); // 5 minutes
                    } catch (e) {
                        console.error(`Failed to record metric ${name}:`, e);
                    }
                }
            });

            const response = new Response(JSON.stringify(summary), {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "private, max-age=60, stale-while-revalidate=60"
                }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            console.error("referrals_summary_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    // 6.6) Top Referrals API
    if (url.pathname === "/api/referrals/top" && req.method === "GET") {
        try {
            const { project_id, limit = "10" } = Object.fromEntries(url.searchParams);
            if (!project_id) {
                const response = new Response("missing project_id", { status: 400 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const referrals = await env.OPTIVIEW_DB.prepare(`
                SELECT 
                    ar.id, ar.ref_type, ar.detected_at,
                    ais.name as ai_source_name, ais.category,
                    ca.url as content_url,
                    COUNT(*) as referral_count
                FROM ai_referrals ar
                JOIN ai_sources ais ON ar.ai_source_id = ais.id
                LEFT JOIN content_assets ca ON ar.content_id = ca.id
                LEFT JOIN properties p ON ca.property_id = p.id
                WHERE p.project_id = ? OR (p.project_id IS NULL AND ? IS NULL)
                GROUP BY ar.content_id, ais.id
                ORDER BY referral_count DESC
                LIMIT ?
            `).bind(project_id, project_id, parseInt(limit)).all<any>();

            const response = new Response(JSON.stringify({ referrals: referrals.results || [] }), {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "public, max-age=300"
                }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            console.error("referrals_top_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    // 6.7) Funnels Summary API (with caching)
    if (url.pathname === "/api/funnels/summary" && req.method === "GET") {
        try {
            const { project_id, window = "24h", from, to } = Object.fromEntries(url.searchParams);
            if (!project_id) {
                const response = new Response("missing project_id", { status: 400 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Import cache utilities
            const { getOrSetJSON, getProjectVersion } = await import('../lib/cache');
            const { CACHE_TTL } = await import('../lib/config');

            // Get project version for cache invalidation
            const v = await getProjectVersion(env.CACHE, project_id);
            const cacheKey = `funnels:summary:v${v}:${project_id}:${window}:${from || ''}:${to || ''}`;

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

            // Generate funnels summary with caching
            const generateFunnelsSummary = async () => {
                // Get funnel steps and conversion rates
                const funnelSteps = await env.OPTIVIEW_DB.prepare(`
                    SELECT 
                        step_name,
                        step_order,
                        COUNT(DISTINCT session_id) as sessions,
                        COUNT(*) as events
                    FROM funnel_steps fs
                    JOIN session_v1 sv ON sv.id = fs.session_id
                    WHERE sv.project_id = ? 
                      AND sv.started_at >= datetime(?, 'unixepoch')
                      AND sv.started_at <= datetime(?, 'unixepoch')
                    GROUP BY step_name, step_order
                    ORDER BY step_order
                `).bind(project_id, fromSql, toSql).all<any>();

                // Calculate conversion rates
                const steps = (funnelSteps.results || []).map((step, index, array) => {
                    const previousStep = index > 0 ? array[index - 1] : null;
                    const conversionRate = previousStep ? (step.sessions / previousStep.sessions * 100) : 100;

                    return {
                        step_name: step.step_name,
                        step_order: step.step_order,
                        sessions: step.sessions,
                        events: step.events,
                        conversion_rate: Math.round(conversionRate * 100) / 100
                    };
                });

                return {
                    totals: {
                        steps: steps.length,
                        total_sessions: steps.length > 0 ? steps[0].sessions : 0
                    },
                    steps: steps
                };
            };

            // Get cached or generate summary
            const summary = await getOrSetJSON(env.CACHE, cacheKey, CACHE_TTL.funnelsSummary, generateFunnelsSummary, {
                CACHE_OFF: env.CACHE_OFF,
                metrics: async (name) => {
                    try {
                        const current = await env.CACHE.get(name) || "0";
                        await env.CACHE.put(name, String(parseInt(current) + 1), { expirationTtl: 300 }); // 5 minutes
                    } catch (e) {
                        console.error(`Failed to record metric ${name}:`, e);
                    }
                }
            });

            const response = new Response(JSON.stringify(summary), {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "private, max-age=60, stale-while-revalidate=60"
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

    // 6.8) Sessions Summary API (with caching)
    if (url.pathname === "/api/sessions/summary" && req.method === "GET") {
        try {
            const { project_id, window = "24h", from, to } = Object.fromEntries(url.searchParams);
            if (!project_id) {
                const response = new Response("missing project_id", { status: 400 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Import cache utilities
            const { getOrSetJSON, getProjectVersion } = await import('../lib/cache');
            const { CACHE_TTL } = await import('../lib/config');

            // Get project version for cache invalidation
            const v = await getProjectVersion(env.CACHE, project_id);
            const cacheKey = `sessions:summary:v${v}:${project_id}:${window}:${from || ''}:${to || ''}`;

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

            // Generate sessions summary with caching
            const generateSessionsSummary = async () => {
                // Get total sessions
                const totalResult = await env.OPTIVIEW_DB.prepare(`
                    SELECT COUNT(*) AS total
                    FROM session_v1
                    WHERE project_id = ? 
                      AND started_at >= datetime(?, 'unixepoch')
                      AND started_at <= datetime(?, 'unixepoch')
                `).bind(project_id, fromSql, toSql).first<any>();

                // Get sessions by AI source
                const bySource = await env.OPTIVIEW_DB.prepare(`
                    SELECT 
                        sv.primary_ai_source_id,
                        ais.slug,
                        ais.name,
                        COUNT(*) AS count
                    FROM session_v1 sv
                    LEFT JOIN ai_sources ais ON ais.id = sv.primary_ai_source_id
                    WHERE sv.project_id = ? 
                      AND sv.started_at >= datetime(?, 'unixepoch')
                      AND sv.started_at <= datetime(?, 'unixepoch')
                    GROUP BY sv.primary_ai_source_id, ais.slug, ais.name
                    ORDER BY count DESC
                    LIMIT 10
                `).bind(project_id, fromSql, toSql).all<any>();

                // Get session duration stats
                const durationStats = await env.OPTIVIEW_DB.prepare(`
                    SELECT 
                        AVG(CAST((julianday(sv.ended_at) - julianday(sv.started_at)) * 86400 AS INTEGER)) as avg_duration_seconds,
                        MIN(CAST((julianday(sv.ended_at) - julianday(sv.started_at)) * 86400 AS INTEGER)) as min_duration_seconds,
                        MAX(CAST((julianday(sv.ended_at) - julianday(sv.started_at)) * 86400 AS INTEGER)) as max_duration_seconds
                    FROM session_v1 sv
                    WHERE sv.project_id = ? 
                      AND sv.started_at >= datetime(?, 'unixepoch')
                      AND sv.started_at <= datetime(?, 'unixepoch')
                      AND sv.ended_at IS NOT NULL
                `).bind(project_id, fromSql, toSql).first<any>();

                return {
                    totals: {
                        sessions: totalResult?.total || 0
                    },
                    by_source: (bySource.results || []).map(row => ({
                        ai_source_id: row.primary_ai_source_id,
                        slug: row.slug || 'direct',
                        name: row.name || 'Direct Traffic',
                        count: row.count
                    })),
                    duration: {
                        avg_seconds: Math.round(durationStats?.avg_duration_seconds || 0),
                        min_seconds: durationStats?.min_duration_seconds || 0,
                        max_seconds: durationStats?.max_duration_seconds || 0
                    }
                };
            };

            // Get cached or generate summary
            const summary = await getOrSetJSON(env.CACHE, cacheKey, CACHE_TTL.sessionsSummary, generateSessionsSummary, {
                CACHE_OFF: env.CACHE_OFF,
                metrics: async (name) => {
                    try {
                        const current = await env.CACHE.get(name) || "0";
                        await env.CACHE.put(name, String(parseInt(current) + 1), { expirationTtl: 300 }); // 5 minutes
                    } catch (e) {
                        console.error(`Failed to record metric ${name}:`, e);
                    }
                }
            });

            const response = new Response(JSON.stringify(summary), {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "private, max-age=30, stale-while-revalidate=60"
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

    // 6.9) Conversions API (with cache invalidation)
    if (url.pathname === "/api/conversions" && req.method === "POST") {
        try {
            // Check Content-Type
            const contentType = req.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const response = new Response("Content-Type must be application/json", { status: 415 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // IP rate limiting (120 rpm per IP, 60s window) - temporarily disabled for debugging
            /*
            const clientIP = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
            const ipRateLimitKey = `rl:ip:conversions:${clientIP}`;
            const ipCount = await env.AI_FINGERPRINTS.get(ipRateLimitKey);

            if (!ipCount) {
                await env.AI_FINGERPRINTS.put(ipRateLimitKey, "1", { expirationTtl: 60 });
            } else if (parseInt(ipCount) >= 120) {
                const response = new Response(JSON.stringify({
                    error: "IP rate limit exceeded",
                    code: "ip_ratelimit",
                    retry_after: 60
                }), {
                    status: 429,
                    headers: {
                        "Content-Type": "application/json",
                        "Retry-After": "60"
                    }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            } else {
                await env.AI_FINGERPRINTS.put(ipRateLimitKey, String(parseInt(ipCount) + 1), { expirationTtl: 60 });
            }
            */

            // Get request body and validate size
            const bodyText = await req.text();
            if (bodyText.length > 1024) {
                const response = new Response(JSON.stringify({
                    error: "Request body too large",
                    max_size_kb: 1,
                    actual_size_kb: Math.round(bodyText.length / 1024)
                }), { status: 413, headers: { "Content-Type": "application/json" } });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Parse and validate body
            const body = JSON.parse(bodyText);
            const validation = validateRequestBody("/api/conversions", body, bodyText.length);

            if (!validation.valid) {
                const response = new Response(JSON.stringify({
                    error: "Validation failed",
                    details: validation.errors
                }), { status: 400, headers: { "Content-Type": "application/json" } });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Import ingest guards
            const { hostnameAllowed, sanitizeMetadata } = await import('../lib/ingest-guards');

            // Domain validation - check if URL hostname matches property domain
            if (validation.sanitizedData.metadata?.url) {
                try {
                    const url = new URL(validation.sanitizedData.metadata.url);
                    const propertyDomain = await env.OPTIVIEW_DB.prepare(`
                        SELECT domain FROM properties WHERE id = ?
                    `).bind(validation.sanitizedData.property_id || body.property_id).first<{ domain: string }>();

                    if (propertyDomain && !hostnameAllowed(url.hostname, propertyDomain.domain)) {
                        const response = new Response(JSON.stringify({
                            error: "Domain mismatch",
                            reason: "URL hostname does not match property domain",
                            url_hostname: url.hostname,
                            property_domain: propertyDomain.domain
                        }), { status: 400, headers: { "Content-Type": "application/json" } });
                        return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
                    }
                } catch (e) {
                    // Invalid URL format - reject
                    const response = new Response(JSON.stringify({
                        error: "Invalid URL format",
                        reason: "metadata.url must be a valid URL"
                    }), { status: 400, headers: { "Content-Type": "application/json" } });
                    return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
                }
            }

            // Metadata sanitization and size validation
            const cleanedMetadata = sanitizeMetadata(validation.sanitizedData.metadata);
            if (!cleanedMetadata) {
                const response = new Response(JSON.stringify({
                    error: "Metadata too large",
                    reason: "Metadata exceeds 2KB limit even after sanitization"
                }), { status: 413, headers: { "Content-Type": "application/json" } });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Update validation data with cleaned metadata
            validation.sanitizedData.metadata = cleanedMetadata;

            // Insert the conversion
            const result = await env.OPTIVIEW_DB.prepare(`
                INSERT INTO conversion_event (project_id, content_id, ai_source_id, conversion_type, metadata, occurred_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `).bind(
                validation.sanitizedData.project_id,
                validation.sanitizedData.content_id || null,
                validation.sanitizedData.ai_source_id || null,
                validation.sanitizedData.conversion_type,
                JSON.stringify(validation.sanitizedData.metadata || {}),
                validation.sanitizedData.occurred_at || Date.now()
            ).run();

            // Invalidate cache for this project
            const { bumpProjectVersion } = await import('../lib/cache');
            await bumpProjectVersion(env.CACHE, validation.sanitizedData.project_id);

            const response = new Response(JSON.stringify({
                id: result.meta.last_row_id,
                conversion_type: validation.sanitizedData.conversion_type,
                project_id: validation.sanitizedData.project_id
            }), {
                headers: { "Content-Type": "application/json" }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            console.error("conversions_create_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    // 6.10) Sources Enable/Disable API (with cache invalidation)
    if (url.pathname === "/api/sources/enable" && req.method === "POST") {
        try {
            // Check Content-Type
            const contentType = req.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const response = new Response("Content-Type must be application/json", { status: 415 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Get request body and validate size
            const bodyText = await req.text();
            if (bodyText.length > 1024) {
                const response = new Response(JSON.stringify({
                    error: "Request body too large",
                    max_size_kb: 1,
                    actual_size_kb: Math.round(bodyText.length / 1024)
                }), { status: 413, headers: { "Content-Type": "application/json" } });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Parse and validate body
            const body = JSON.parse(bodyText);
            const { project_id, source_id, enabled } = body;

            if (!project_id || !source_id || typeof enabled !== 'boolean') {
                const response = new Response(JSON.stringify({
                    error: "Missing required fields",
                    required: ["project_id", "source_id", "enabled"]
                }), { status: 400, headers: { "Content-Type": "application/json" } });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Update the source enabled status
            const result = await env.OPTIVIEW_DB.prepare(`
                UPDATE ai_sources 
                SET enabled = ?, updated_at = datetime('now')
                WHERE id = ? AND project_id = ?
            `).bind(enabled ? 1 : 0, source_id, project_id).run();

            if (result.meta.changes === 0) {
                const response = new Response(JSON.stringify({
                    error: "Source not found or no changes made"
                }), { status: 404, headers: { "Content-Type": "application/json" } });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Invalidate cache for this project
            const { bumpProjectVersion } = await import('../lib/cache');
            await bumpProjectVersion(env.CACHE, project_id);

            const response = new Response(JSON.stringify({
                success: true,
                source_id,
                enabled,
                project_id
            }), {
                headers: { "Content-Type": "application/json" }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            console.error("sources_enable_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    // 6.11) Admin Citations Ingest API (with cache invalidation)
    if (url.pathname === "/admin/citations/ingest" && req.method === "POST") {
        try {
            // Check authentication (admin only)
            const sessionCookie = req.headers.get("cookie");
            if (!sessionCookie) {
                const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
            if (!sessionMatch) {
                const response = new Response(JSON.stringify({ error: "Invalid session" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const sessionId = sessionMatch[1];
            const sessionData = await env.OPTIVIEW_DB.prepare(`
                SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
            `).bind(sessionId, new Date().toISOString()).first();

            if (!sessionData) {
                const response = new Response(JSON.stringify({ error: "Session expired" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Check if user is admin
            const userData = await env.OPTIVIEW_DB.prepare(`
                SELECT is_admin FROM users WHERE id = ?
            `).bind(sessionData.user_id).first<{ is_admin: number }>();

            if (!userData || !userData.is_admin) {
                const response = new Response(JSON.stringify({ error: "Admin access required" }), {
                    status: 403,
                    headers: { "Content-Type": "application/json" }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Check Content-Type
            const contentType = req.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const response = new Response("Content-Type must be application/json", { status: 415 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Get request body and validate size
            const bodyText = await req.text();
            if (bodyText.length > 10240) { // 10KB limit for admin endpoint
                const response = new Response(JSON.stringify({
                    error: "Request body too large",
                    max_size_kb: 10,
                    actual_size_kb: Math.round(bodyText.length / 1024)
                }), { status: 413, headers: { "Content-Type": "application/json" } });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Parse and validate body
            const body = JSON.parse(bodyText);
            const { project_id, citations } = body;

            if (!project_id || !Array.isArray(citations)) {
                const response = new Response(JSON.stringify({
                    error: "Missing required fields",
                    required: ["project_id", "citations"]
                }), { status: 400, headers: { "Content-Type": "application/json" } });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Process citations in batch
            let created = 0;
            let skipped = 0;
            const errors: string[] = [];

            for (const citation of citations) {
                try {
                    const result = await env.OPTIVIEW_DB.prepare(`
                        INSERT INTO ai_citations (ai_source_id, content_id, citation_type, detected_at, metadata)
                        VALUES (?, ?, ?, ?, ?)
                    `).bind(
                        citation.ai_source_id,
                        citation.content_id || null,
                        citation.citation_type || 'mention',
                        citation.detected_at || Date.now(),
                        JSON.stringify(citation.metadata || {})
                    ).run();

                    created++;
                } catch (e: any) {
                    skipped++;
                    errors.push(`Citation ${created + skipped}: ${e.message}`);
                }
            }

            // Invalidate cache for this project
            const { bumpProjectVersion } = await import('../lib/cache');
            await bumpProjectVersion(env.CACHE, project_id);

            const response = new Response(JSON.stringify({
                success: true,
                created,
                skipped,
                errors: errors.length > 0 ? errors : undefined
            }), {
                headers: { "Content-Type": "application/json" }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            console.error("admin_citations_ingest_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    // 6.12) Admin Health API
    if (url.pathname === "/admin/health" && req.method === "GET") {
        try {
            // Check authentication (admin only)
            const sessionCookie = req.headers.get("cookie");
            if (!sessionCookie) {
                const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
            if (!sessionMatch) {
                const response = new Response(JSON.stringify({ error: "Invalid session" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const sessionId = sessionMatch[1];
            const sessionData = await env.OPTIVIEW_DB.prepare(`
                SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
            `).bind(sessionId, new Date().toISOString()).first();

            if (!sessionData) {
                const response = new Response(JSON.stringify({ error: "Session expired" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Check if user is admin
            const userData = await env.OPTIVIEW_DB.prepare(`
                SELECT is_admin FROM users WHERE id = ?
            `).bind(sessionData.user_id).first<{ is_admin: number }>();

            if (!userData || !userData.is_admin) {
                const response = new Response(JSON.stringify({ error: "Admin access required" }), {
                    status: 403,
                    headers: { "Content-Type": "application/json" }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Get cache metrics from KV (5-minute counters)
            const cacheMetrics = {
                cache_hit_5m: 0,
                cache_miss_5m: 0,
                cache_overwrite_5m: 0,
                cache_bypass_5m: 0,
                cache_skip_oversize_5m: 0,
                cache_store_error_5m: 0
            };

            try {
                if (env.CACHE) {
                    for (const metric of Object.keys(cacheMetrics)) {
                        const value = await env.CACHE.get(metric);
                        if (value) {
                            (cacheMetrics as any)[metric] = parseInt(value) || 0;
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to fetch cache metrics:", e);
            }

            // Get system health info
            const health = {
                ok: true,
                timestamp: new Date().toISOString(),
                uptime: Date.now(),
                environment: env.NODE_ENV || "unknown",
                cache: {
                    bound: !!env.CACHE,
                    cache_off: env.CACHE_OFF === "1",
                    metrics: cacheMetrics
                },
                database: {
                    d1_bound: !!env.OPTIVIEW_DB,
                    status: "healthy" // TODO: Add actual DB health check
                },
                cron: {
                    enabled: true,
                    last_run: "unknown", // TODO: Add actual cron tracking
                    schedules: ["*/5 * * * *", "0 * * * *", "0 3 * * *"]
                }
            };

            const response = new Response(JSON.stringify(health), {
                headers: { "Content-Type": "application/json" }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            console.error("health_check_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    // 6.13) Content API (with cache invalidation)
    if (url.pathname === "/api/content" && req.method === "POST") {
        try {
            // Check Content-Type
            const contentType = req.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const response = new Response("Content-Type must be application/json", { status: 415 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // IP rate limiting (120 rpm per IP, 60s window) - temporarily disabled for debugging
            /*
            const clientIP = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
            const ipRateLimitKey = `rl:ip:content:${clientIP}`;
            const ipCount = await env.AI_FINGERPRINTS.get(ipRateLimitKey);
            
            if (!ipCount) {
                await env.AI_FINGERPRINTS.put(ipRateLimitKey, "1", { expirationTtl: 60 });
            } else if (parseInt(ipCount) >= 120) {
                const response = new Response(JSON.stringify({
                    error: "IP rate limit exceeded",
                    code: "ip_ratelimit",
                    retry_after: 60
                }), { 
                    status: 429, 
                    headers: { 
                        "Content-Type": "application/json",
                        "Retry-After": "60"
                    } 
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            } else {
                await env.AI_FINGERPRINTS.put(ipRateLimitKey, String(parseInt(ipCount) + 1), { expirationTtl: 60 });
            }
            */

            // Get request body and validate size
            const bodyText = await req.text();
            if (bodyText.length > 1024) {
                const response = new Response(JSON.stringify({
                    error: "Request body too large",
                    max_size_kb: 1,
                    actual_size_kb: Math.round(bodyText.length / 1024)
                }), { status: 413, headers: { "Content-Type": "application/json" } });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Parse and validate body
            const body = JSON.parse(bodyText);
            const { project_id, property_id, url, content_type, metadata } = body;

            if (!project_id || !property_id || !url || !content_type) {
                const response = new Response(JSON.stringify({
                    error: "Missing required fields",
                    required: ["project_id", "property_id", "url", "content_type"]
                }), { status: 400, headers: { "Content-Type": "application/json" } });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Insert the content
            const result = await env.OPTIVIEW_DB.prepare(`
                INSERT INTO content_assets (project_id, property_id, url, content_type, metadata, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `).bind(
                project_id,
                property_id,
                url,
                content_type,
                JSON.stringify(metadata || {}),
                Date.now()
            ).run();

            // Invalidate cache for this project
            const { bumpProjectVersion } = await import('../lib/cache');
            await bumpProjectVersion(env.CACHE, project_id);

            const response = new Response(JSON.stringify({
                id: result.meta.last_row_id,
                url,
                content_type,
                project_id
            }), {
                headers: { "Content-Type": "application/json" }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            console.error("content_create_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    if (url.pathname === "/api/content" && req.method === "PATCH") {
        try {
            // Check Content-Type
            const contentType = req.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const response = new Response("Content-Type must be application/json", { status: 415 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Get request body and validate size
            const bodyText = await req.text();
            if (bodyText.length > 1024) {
                const response = new Response(JSON.stringify({
                    error: "Request body too large",
                    max_size_kb: 1,
                    actual_size_kb: Math.round(bodyText.length / 1024)
                }), { status: 413, headers: { "Content-Type": "application/json" } });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Parse and validate body
            const body = JSON.parse(bodyText);
            const { id, url, content_type, metadata } = body;

            if (!id) {
                const response = new Response(JSON.stringify({
                    error: "Missing required field: id"
                }), { status: 400, headers: { "Content-Type": "application/json" } });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Get project_id for cache invalidation
            const contentData = await env.OPTIVIEW_DB.prepare(`
                SELECT project_id FROM content_assets WHERE id = ?
            `).bind(id).first<{ project_id: string }>();

            if (!contentData) {
                const response = new Response(JSON.stringify({
                    error: "Content not found"
                }), { status: 404, headers: { "Content-Type": "application/json" } });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Update the content
            const updateFields = [];
            const updateValues = [];
            let paramIndex = 1;

            if (url !== undefined) {
                updateFields.push(`url = ?`);
                updateValues.push(url);
                paramIndex++;
            }
            if (content_type !== undefined) {
                updateFields.push(`content_type = ?`);
                updateValues.push(content_type);
                paramIndex++;
            }
            if (metadata !== undefined) {
                updateFields.push(`metadata = ?`);
                updateValues.push(JSON.stringify(metadata));
                paramIndex++;
            }

            if (updateFields.length === 0) {
                const response = new Response(JSON.stringify({
                    error: "No fields to update"
                }), { status: 400, headers: { "Content-Type": "application/json" } });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            updateFields.push(`updated_at = ?`);
            updateValues.push(Date.now());
            updateValues.push(id);

            const result = await env.OPTIVIEW_DB.prepare(`
                UPDATE content_assets 
                SET ${updateFields.join(', ')}
                WHERE id = ?
            `).bind(...updateValues).run();

            if (result.meta.changes === 0) {
                const response = new Response(JSON.stringify({
                    error: "Content not found or no changes made"
                }), { status: 404, headers: { "Content-Type": "application/json" } });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Invalidate cache for this project
            const { bumpProjectVersion } = await import('../lib/cache');
            await bumpProjectVersion(env.CACHE, contentData.project_id);

            const response = new Response(JSON.stringify({
                success: true,
                id,
                changes: result.meta.changes
            }), {
                headers: { "Content-Type": "application/json" }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            console.error("content_update_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    if (url.pathname === "/api/content" && req.method === "DELETE") {
        try {
            // Check Content-Type
            const contentType = req.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const response = new Response("Content-Type must be application/json", { status: 415 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Get request body and validate size
            const bodyText = await req.text();
            if (bodyText.length > 1024) {
                const response = new Response(JSON.stringify({
                    error: "Request body too large",
                    max_size_kb: 1,
                    actual_size_kb: Math.round(bodyText.length / 1024)
                }), { status: 413, headers: { "Content-Type": "application/json" } });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Parse and validate body
            const body = JSON.parse(bodyText);
            const { id } = body;

            if (!id) {
                const response = new Response(JSON.stringify({
                    error: "Missing required field: id"
                }), { status: 400, headers: { "Content-Type": "application/json" } });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Get project_id for cache invalidation
            const contentData = await env.OPTIVIEW_DB.prepare(`
                SELECT project_id FROM content_assets WHERE id = ?
            `).bind(id).first<{ project_id: string }>();

            if (!contentData) {
                const response = new Response(JSON.stringify({
                    error: "Content not found"
                }), { status: 404, headers: { "Content-Type": "application/json" } });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Delete the content
            const result = await env.OPTIVIEW_DB.prepare(`
                DELETE FROM content_assets WHERE id = ?
            `).bind(id).run();

            if (result.meta.changes === 0) {
                const response = new Response(JSON.stringify({
                    error: "Content not found or already deleted"
                }), { status: 404, headers: { "Content-Type": "application/json" } });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Invalidate cache for this project
            const { bumpProjectVersion } = await import('../lib/cache');
            await bumpProjectVersion(env.CACHE, contentData.project_id);

            const response = new Response(JSON.stringify({
                success: true,
                id,
                deleted: true
            }), {
                headers: { "Content-Type": "application/json" }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            console.error("content_delete_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    // 6.14) Admin Environment Check API
    if (url.pathname === "/admin/env-check" && req.method === "GET") {
        try {
            // Check authentication (admin only)
            const sessionCookie = req.headers.get("cookie");
            if (!sessionCookie) {
                const response = new Response(JSON.stringify({ error: "Not authenticated" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const sessionMatch = sessionCookie.match(/optiview_session=([^;]+)/);
            if (!sessionMatch) {
                const response = new Response(JSON.stringify({ error: "Invalid session" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            const sessionId = sessionMatch[1];
            const sessionData = await env.OPTIVIEW_DB.prepare(`
                SELECT user_id FROM session WHERE session_id = ? AND expires_at > ?
            `).bind(sessionId, new Date().toISOString()).first();

            if (!sessionData) {
                const response = new Response(JSON.stringify({ error: "Session expired" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Check if user is admin
            const userData = await env.OPTIVIEW_DB.prepare(`
                SELECT is_admin FROM users WHERE id = ?
            `).bind(sessionData.user_id).first<{ is_admin: number }>();

            if (!userData || !userData.is_admin) {
                const response = new Response(JSON.stringify({ error: "Admin access required" }), {
                    status: 403,
                    headers: { "Content-Type": "application/json" }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Check KV bindings
            const cacheBound = !!env.CACHE;
            const cacheBindingName = cacheBound ? "CACHE" : "NOT_BOUND";
            const cacheIdsArePlaceholders = cacheBound && (
                env.CACHE.toString().includes("REPLACE_WITH") ||
                env.CACHE.toString().includes("placeholder")
            );

            // Guard: If KV is not bound in production, return error
            if (env.NODE_ENV === "production" && !cacheBound) {
                const response = new Response(JSON.stringify({
                    error: "KV cache not bound in production",
                    code: "kv_unbound"
                }), {
                    status: 500,
                    headers: { "Content-Type": "application/json" }
                });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Check environment variables
            const envCheck = {
                ok: true,
                timestamp: new Date().toISOString(),
                environment: env.NODE_ENV || "unknown",
                kv: {
                    cache: {
                        bound: cacheBound,
                        binding_name: cacheBindingName,
                        ids_are_placeholders: cacheIdsArePlaceholders,
                        id: cacheBound ? "351597e3c9e94f908fb256c50c8fe5c8" : null,
                        preview_id: cacheBound ? "a2853f2e1d7c498d800ee0013eeec3d3" : null
                    },
                    ai_fingerprints: {
                        bound: !!env.AI_FINGERPRINTS
                    }
                },
                cache: {
                    cache_off: env.CACHE_OFF || "false",
                    cache_off_effective: env.CACHE_OFF === "1"
                },
                database: {
                    d1_bound: !!env.OPTIVIEW_DB
                },
                cron: {
                    enabled: true, // We have cron triggers configured
                    schedules: ["*/5 * * * *", "0 * * * *", "0 3 * * *"]
                }
            };

            const response = new Response(JSON.stringify(envCheck), {
                headers: { "Content-Type": "application/json" }
            });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        } catch (e: any) {
            console.error("env_check_error", { error: e.message, stack: e.stack });
            const response = new Response(JSON.stringify({
                error: "Internal server error",
                message: e.message
            }), { status: 500, headers: { "Content-Type": "application/json" } });
            return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
        }
    }

    // 6.13) Citations Summary API (with caching)
    if (url.pathname === "/api/citations/summary" && req.method === "GET") {
        try {
            const { project_id, window = "24h", from, to } = Object.fromEntries(url.searchParams);
            if (!project_id) {
                const response = new Response("missing project_id", { status: 400 });
                return attach(addBasicSecurityHeaders(addCorsHeaders(response, origin)));
            }

            // Import cache utilities
            const { getOrSetJSON, getProjectVersion } = await import('../lib/cache');
            const { CACHE_TTL } = await import('../lib/config');

            // Get project version for cache invalidation
            const v = await getProjectVersion(env.CACHE, project_id);
            const cacheKey = `citations:summary:v${v}:${project_id}:${window}:${from || ''}:${to || ''}`;

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

            // Generate citations summary with caching
            const generateCitationsSummary = async () => {
                // Get total citations
                const totalResult = await env.OPTIVIEW_DB.prepare(`
                    SELECT COUNT(*) AS total
                    FROM ai_citations ac
                    JOIN content_assets ca ON ca.id = ac.content_id
                    JOIN properties p ON p.id = ca.property_id
                    WHERE p.project_id = ? 
                      AND ac.detected_at >= datetime(?, 'unixepoch')
                      AND ac.detected_at <= datetime(?, 'unixepoch')
                `).bind(project_id, fromSql, toSql).first<any>();

                // Get citations by AI source
                const bySource = await env.OPTIVIEW_DB.prepare(`
                    SELECT 
                        ac.ai_source_id,
                        ais.slug,
                        ais.name,
                        COUNT(*) AS count
                    FROM ai_citations ac
                    JOIN content_assets ca ON ca.id = ac.content_id
                    JOIN properties p ON p.id = ca.property_id
                    JOIN ai_sources ais ON ais.id = ac.ai_source_id
                    WHERE p.project_id = ? 
                      AND ac.detected_at >= datetime(?, 'unixepoch')
                      AND ac.detected_at <= datetime(?, 'unixepoch')
                    GROUP BY ac.ai_source_id, ais.slug, ais.name
                    ORDER BY count DESC
                    LIMIT 10
                `).bind(project_id, fromSql, toSql).all<any>();

                // Get citations by content type
                const byContentType = await env.OPTIVIEW_DB.prepare(`
                    SELECT 
                        ca.content_type,
                        COUNT(*) AS count
                    FROM ai_citations ac
                    JOIN content_assets ca ON ca.id = ac.content_id
                    JOIN properties p ON p.id = ca.property_id
                    WHERE p.project_id = ? 
                      AND ac.detected_at >= datetime(?, 'unixepoch')
                      AND ac.detected_at <= datetime(?, 'unixepoch')
                    GROUP BY ca.content_type
                    ORDER BY count DESC
                `).bind(project_id, fromSql, toSql).all<any>();

                return {
                    totals: {
                        citations: totalResult?.total || 0
                    },
                    by_source: (bySource.results || []).map(row => ({
                        ai_source_id: row.ai_source_id,
                        slug: row.slug,
                        name: row.name,
                        count: row.count
                    })),
                    by_content_type: (byContentType.results || []).map(row => ({
                        content_type: row.content_type || 'unknown',
                        count: row.count
                    }))
                };
            };

            // Get cached or generate summary
            const summary = await getOrSetJSON(env.CACHE, cacheKey, CACHE_TTL.citationsSummary, generateCitationsSummary, {
                CACHE_OFF: env.CACHE_OFF,
                metrics: async (name) => {
                    try {
                        const current = await env.CACHE.get(name) || "0";
                        await env.CACHE.put(name, String(parseInt(current) + 1), { expirationTtl: 300 }); // 5 minutes
                    } catch (e) {
                        console.error(`Failed to record metric ${name}:`, e);
                    }
                }
            });

            const response = new Response(JSON.stringify(summary), {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "private, max-age=120, stale-while-revalidate=60"
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

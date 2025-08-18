export const INSIGHTS_NAV = [
    { label: "Events", href: "/events", match: p => p.startsWith("/events") },
    { label: "Content", href: "/content", match: p => p.startsWith("/content") },
    { label: "Referrals", href: "/referrals", match: p => p.startsWith("/referrals") },
    { label: "Conversions", href: "/conversions", match: p => p.startsWith("/conversions") },
    { label: "Funnels", href: "/funnels", match: p => p.startsWith("/funnels") },
    { label: "Journeys", href: "/journeys", match: p => p.startsWith("/journeys") },
    { label: "Citations", href: "/citations", match: p => p.startsWith("/citations") },
    { label: "Recommendations", href: "/recommendations", match: p => p.startsWith("/recommendations") },
];
export const SETUP_NAV = [
    { label: "Install", href: "/install", match: p => p.startsWith("/install") },
    { label: "Sources", href: "/sources", match: p => p.startsWith("/sources") },
    { label: "API Keys", href: "/api-keys", match: p => p.startsWith("/api-keys") },
    { label: "Data Policy", href: "/data-policy", match: p => p.startsWith("/data-policy") },
    { label: "Settings", href: "/settings", match: p => p.startsWith("/settings") },
    { label: "Health", href: "/admin/health", match: p => p.startsWith("/admin/health"), adminOnly: true },
];

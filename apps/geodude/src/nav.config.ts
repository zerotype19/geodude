export type NavItem = {
  label: string;
  href: string;
  match: (path: string) => boolean;
  requiresAdmin?: boolean;
  adminOnly?: boolean;
};

export const INSIGHTS_NAV: NavItem[] = [
  { label: "Events",          href: "/events",          match: p => p.startsWith("/events") },
  { label: "Content",         href: "/content",         match: p => p.startsWith("/content") },
];

export const SETUP_NAV: NavItem[] = [
  { label: "Install",     href: "/install",        match: p => p.startsWith("/install") },
  { label: "API Keys",    href: "/api-keys",       match: p => p.startsWith("/api-keys") },
  { label: "Settings",    href: "/settings",       match: p => p.startsWith("/settings") },
  { label: "Health",      href: "/admin/health",   match: p => p.startsWith("/admin/health"), adminOnly: true },
];
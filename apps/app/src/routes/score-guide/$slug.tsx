import { useParams, useSearchParams, Link } from "react-router-dom";
import { useEffect } from "react";
import ScoreGuideDoc from "../../components/score-guide/ScoreGuideDoc";
import { CHECKS } from "../../content/score-guide/checks";

const mapBySlug = new Map(CHECKS.map((c) => [c.slug, c]));

export default function ScoreGuideDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  
  const doc = mapBySlug.get(slug || "");
  
  // Analytics: Track guide opens
  useEffect(() => {
    if (doc && typeof window !== 'undefined' && (window as any).gtag) {
      const from = searchParams.get("from");
      const auditId = searchParams.get("auditId");
      const pageId = searchParams.get("pageId");
      const checkId = searchParams.get("check");
      
      (window as any).gtag('event', 'scoreguide_open', {
        check_id: checkId || doc.id,
        slug: slug,
        audit_id: auditId || undefined,
        page_id: pageId || undefined,
        from: from || 'direct'
      });
    }
  }, [doc, slug, searchParams]);

  if (!doc) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white">
        <div className="mx-auto max-w-5xl p-6">
          <p className="text-neutral-300 mb-4">Check not found.</p>
          <Link className="text-blue-400 hover:text-blue-300 hover:underline transition-colors" to="/score-guide">
            ← Back to Scoring Guide
          </Link>
        </div>
      </div>
    );
  }

  const from = searchParams.get("from");
  const auditId = searchParams.get("auditId");
  const pageId = searchParams.get("pageId");
  
  const backAuditUrl = from === "audits" && auditId && pageId
    ? `/audits/${auditId}/pages/${pageId}`
    : null;
  
  const handleBackClick = () => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'scoreguide_nav_back', {
        audit_id: auditId || undefined,
        page_id: pageId || undefined,
        check_id: doc?.id
      });
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <nav className="flex items-center gap-4 text-sm">
          <Link 
            className="text-blue-400 hover:text-blue-300 hover:underline transition-colors" 
            to="/score-guide"
          >
            ← All checks
          </Link>
          {backAuditUrl && (
            <>
              <span className="text-neutral-600">·</span>
              <Link 
                className="text-blue-400 hover:text-blue-300 hover:underline transition-colors" 
                to={backAuditUrl}
                onClick={handleBackClick}
              >
                Back to audit page
              </Link>
            </>
          )}
        </nav>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-8">
          <ScoreGuideDoc doc={doc} />
        </div>

        <footer className="border-t border-neutral-800 pt-6 space-y-3">
          <div className="text-sm text-neutral-400">
            <strong>Pro tip:</strong> Use the anchors to jump to sections —{" "}
            <a className="text-blue-400 hover:text-blue-300 hover:underline" href="#why">
              #why
            </a>
            {", "}
            <a className="text-blue-400 hover:text-blue-300 hover:underline" href="#examples">
              #examples
            </a>
            {", "}
            <a className="text-blue-400 hover:text-blue-300 hover:underline" href="#implementation">
              #implementation
            </a>
            {", "}
            <a className="text-blue-400 hover:text-blue-300 hover:underline" href="#qa">
              #qa
            </a>
          </div>
          
          <div className="text-xs text-neutral-500">
            These examples are meant to be practical starting points. Adapt them to your site's specific needs.
          </div>
        </footer>
      </div>
    </div>
  );
}


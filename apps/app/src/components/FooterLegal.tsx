import { Link } from 'react-router-dom';

export default function FooterLegal() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface-1 muted text-sm mt-12">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Links */}
        <div className="flex flex-wrap gap-4">
          <Link to="/score-guide" className="hover:text-brand transition-colors">
            Scoring Guide
          </Link>
          <a href="https://optiview.ai/citations" className="hover:text-brand transition-colors">
            Citations Guide
          </a>
          <a href="https://optiview.ai/methodology" className="hover:text-brand transition-colors">
            Methodology
          </a>
          <Link to="/terms" className="hover:text-brand transition-colors">
            Terms
          </Link>
          <Link to="/privacy" className="hover:text-brand transition-colors">
            Privacy
          </Link>
          <a href="https://optiview.ai/bot" className="hover:text-brand transition-colors">
            Bot Info
          </a>
        </div>

        {/* Copyright & Disclaimer */}
        <div className="text-xs subtle space-y-1">
          <div>
            © {currentYear} Optiview.ai - All rights reserved.
          </div>
          <div className="md:text-right">
            Scores and recommendations are heuristic indicators only; no warranties or guarantees implied.
          </div>
        </div>
      </div>
    </footer>
  );
}


import { Link } from 'react-router-dom';

export default function FooterLegal() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 bg-white text-gray-600 text-sm mt-12">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Links */}
        <div className="flex flex-wrap gap-4">
          <Link to="/score-guide" className="hover:text-gray-900 transition-colors">
            Scoring Guide
          </Link>
          <a href="https://optiview.ai/docs/citations.html" className="hover:text-gray-900 transition-colors">
            Citations Guide
          </a>
          <a href="https://optiview.ai/methodology" className="hover:text-gray-900 transition-colors">
            Methodology
          </a>
          <a href="https://optiview.ai/terms" className="hover:text-gray-900 transition-colors">
            Terms
          </a>
          <a href="https://optiview.ai/privacy" className="hover:text-gray-900 transition-colors">
            Privacy
          </a>
          <a href="https://optiview.ai/bot" className="hover:text-gray-900 transition-colors">
            Bot Info
          </a>
        </div>

        {/* Copyright & Disclaimer */}
        <div className="text-xs text-gray-500 space-y-1">
          <div>
            © {currentYear} Optiview.ai — All rights reserved.
          </div>
          <div className="md:text-right">
            Scores and recommendations are heuristic indicators only; no warranties or guarantees implied.
          </div>
        </div>
      </div>
    </footer>
  );
}


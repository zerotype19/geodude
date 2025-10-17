import { Link } from 'react-router-dom';

export default function FooterLegal() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 bg-white text-gray-600 text-sm mt-12">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Links */}
        <div className="flex flex-wrap gap-4">
          <Link to="/terms" className="hover:text-gray-900 transition-colors">
            Terms of Use
          </Link>
          <Link to="/privacy" className="hover:text-gray-900 transition-colors">
            Privacy Policy
          </Link>
          <Link to="/methodology" className="hover:text-gray-900 transition-colors">
            Data Sources & Methodology
          </Link>
          <Link to="/score-guide" className="hover:text-gray-900 transition-colors">
            Scoring Guide
          </Link>
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


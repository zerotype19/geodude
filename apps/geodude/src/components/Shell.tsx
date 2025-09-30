import { ReactNode } from "react";
import SimpleTopNav from "./SimpleTopNav";

interface ShellProps {
  children: ReactNode;
}

export default function Shell({ children }: ShellProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple TopNav without React Router dependencies */}
      <SimpleTopNav />

      {/* Main content - breadcrumbs and page content */}
      <main className="flex-1">
        <div className="mx-auto max-w-screen-2xl px-4 py-6">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="mx-auto max-w-screen-2xl px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-1 text-sm text-gray-500">
              <span>© 2024 Optiview. All rights reserved.</span>
            </div>
            <div className="flex items-center space-x-6">
              <a
                href="/privacy"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Privacy
              </a>
              <a
                href="/terms"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Terms
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
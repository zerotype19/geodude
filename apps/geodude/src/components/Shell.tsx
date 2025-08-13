import { ReactNode } from "react";
import { Menu, LineChart, PlusSquare, Settings } from "lucide-react";

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-muted text-slate-900">
      <div className="grid lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block bg-white border-r">
          <div className="p-4 text-xl font-semibold">Optiview</div>
          <nav className="px-2 space-y-1">
            <a className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted" href="/">
              Dashboard
            </a>
            <a className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted" href="/citations">
              <LineChart size={18}/>Citations
            </a>
            <a className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted" href="/admin">
              <PlusSquare size={18}/>Admin
            </a>
            <a className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted" href="/settings">
              <Settings size={18}/>Settings
            </a>
          </nav>
        </aside>
        <main className="min-h-screen">
          <header className="sticky top-0 z-10 bg-white border-b">
            <div className="flex items-center justify-between px-4 h-14">
              <button className="lg:hidden p-2 rounded-lg hover:bg-muted">
                <Menu />
              </button>
              <div className="text-sm text-slate-500">AI Referral Intelligence</div>
              <div className="text-sm">Signed in</div>
            </div>
          </header>
          <div className="p-4 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

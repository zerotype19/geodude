import ExampleBlock from "./ExampleBlock";
import type { CheckDoc } from "../../content/score-guide/checks";

// Helper component for section headings with copy-able anchors
function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  const copyAnchor = () => {
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <h2 id={id} className="text-xl font-semibold text-gray-900 group flex items-center gap-2">
      {children}
      <button
        onClick={copyAnchor}
        className="opacity-0 group-hover:opacity-50 hover:!opacity-100 text-sm text-blue-600 transition-opacity"
        aria-label={`Copy link to ${id} section`}
        title="Copy link to this section"
      >
        #
      </button>
    </h2>
  );
}

export default function ScoreGuideDoc({ doc }: { doc: CheckDoc }) {
  return (
    <article className="space-y-8">
      <header className="space-y-4">
        <div className="text-xs uppercase tracking-wider text-gray-500">
          {doc.category} · W{doc.weight} · {doc.id}
        </div>
        <h1 className="text-3xl font-bold text-gray-900">{doc.title}</h1>
        <p className="text-lg text-gray-700">{doc.summary}</p>
        
        {/* Mini-TOC for quick scanning */}
        <nav className="flex flex-wrap gap-3 pt-2 border-t border-gray-200">
          <a href="#why" className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
            → Why
          </a>
          <span className="text-gray-300">·</span>
          <a href="#examples" className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
            → Examples
          </a>
          <span className="text-gray-300">·</span>
          <a href="#implementation" className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
            → Implementation
          </a>
          <span className="text-gray-300">·</span>
          <a href="#qa" className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
            → QA
          </a>
          {doc.detectionNotes?.length && (
            <>
              <span className="text-gray-300">·</span>
              <a href="#detection" className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
                → Detection
              </a>
            </>
          )}
        </nav>
      </header>

      <section id="why" className="space-y-2 scroll-mt-4">
        <SectionHeading id="why">Why it matters</SectionHeading>
        <p className="text-gray-700 leading-relaxed">{doc.whyItMatters}</p>
      </section>

      {doc.detectionNotes?.length ? (
        <section id="detection" className="space-y-2 scroll-mt-4">
          <SectionHeading id="detection">How Optiview detects/scores this</SectionHeading>
          <ul className="list-disc pl-5 text-gray-700 space-y-1">
            {doc.detectionNotes.map((n: string, i: number) => <li key={i}>{n}</li>)}
          </ul>
        </section>
      ) : null}

      <section id="examples" className="space-y-4 scroll-mt-4">
        <SectionHeading id="examples">Examples</SectionHeading>
        <ExampleBlock good={doc.examples?.good ?? []} bad={doc.examples?.bad ?? []} checkId={doc.id} />
      </section>

      <section id="implementation" className="space-y-2 scroll-mt-4">
        <SectionHeading id="implementation">Implementation steps</SectionHeading>
        <ol className="list-decimal pl-5 text-gray-700 space-y-2">
          {doc.implementation.map((s: string, i: number) => <li key={i}>{s}</li>)}
        </ol>
      </section>

      <section id="qa" className="space-y-2 scroll-mt-4">
        <SectionHeading id="qa">QA checklist</SectionHeading>
        <ul className="list-disc pl-5 text-gray-700 space-y-1">
          {doc.qaChecklist.map((s: string, i: number) => <li key={i}>{s}</li>)}
        </ul>
      </section>

      {doc.links?.length ? (
        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900">References</h2>
          <ul className="list-disc pl-5 space-y-1">
            {doc.links.map((l: any, i: number) => (
              <li key={i}>
                <a 
                  className="text-blue-600 hover:text-blue-700 hover:underline transition-colors" 
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}


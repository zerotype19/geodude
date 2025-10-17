import { useState } from "react";

type CodeBlockProps = {
  code: string;
  language?: string;
  checkId?: string; // For analytics
};

export default function CodeBlock({ code, language = "json", checkId }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    
    // Analytics: Track copy events
    if (checkId && typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'scoreguide_copy', {
        check_id: checkId,
        code_type: language
      });
    }
  };
  
  return (
    <div className="relative rounded-lg border border-neutral-800 bg-neutral-900">
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 transition-colors"
        aria-label="Copy code"
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
      <pre className="overflow-x-auto p-4 text-sm">
        <code className={`language-${language}`}>{code}</code>
      </pre>
    </div>
  );
}


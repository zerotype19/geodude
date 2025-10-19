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
    <div className="relative rounded-lg border border-gray-300 bg-gray-50">
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 text-xs px-2 py-1 rounded bg-white border border-gray-300 hover:bg-gray-100 transition-colors text-gray-700"
        aria-label="Copy code"
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
      <pre className="overflow-x-auto p-4 text-sm text-gray-900">
        <code className={`language-${language}`}>{code}</code>
      </pre>
    </div>
  );
}


import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import scoringGuideContent from '../content/scoring-guide.md?raw';

const ScoreGuide: React.FC = () => {
  useEffect(() => {
    // Smooth scroll to anchor if present in URL
    const hash = window.location.hash;
    if (hash) {
      setTimeout(() => {
        const element = document.querySelector(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="prose prose-lg max-w-none prose-headings:scroll-mt-20">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
              // Style h1
              h1: ({ node, ...props }) => (
                <h1 className="text-4xl font-bold text-gray-900 mb-8 mt-0" {...props} />
              ),
              // Style h2 with top margin and anchors
              h2: ({ node, ...props }) => (
                <h2 className="text-3xl font-bold text-gray-900 mt-16 mb-6 pb-3 border-b-2 border-gray-200" {...props} />
              ),
              // Style h3 with anchors for individual checks
              h3: ({ node, ...props }) => {
                const text = node?.children?.[0]?.value || '';
                // Extract ID from {#id} syntax if present
                const match = text.match(/\{#([^}]+)\}/);
                const id = match ? match[1] : '';
                const cleanText = text.replace(/\{#[^}]+\}/, '').trim();
                
                return (
                  <h3 
                    id={id} 
                    className="text-xl font-semibold text-gray-800 mb-3 mt-8 scroll-mt-20" 
                    {...props}
                  >
                    {cleanText || props.children}
                  </h3>
                );
              },
              // Style lists
              ul: ({ node, ...props }) => (
                <ul className="list-disc list-inside space-y-2 text-gray-700 my-4" {...props} />
              ),
              ol: ({ node, ...props }) => (
                <ol className="list-decimal list-inside space-y-2 text-gray-700 my-4" {...props} />
              ),
              // Style paragraphs
              p: ({ node, ...props }) => (
                <p className="text-gray-700 leading-relaxed my-3" {...props} />
              ),
              // Style code blocks
              code: ({ node, inline, ...props }) => 
                inline ? (
                  <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800" {...props} />
                ) : (
                  <code className="block bg-gray-800 text-green-400 p-4 rounded text-sm overflow-x-auto my-4" {...props} />
                ),
              // Style pre blocks
              pre: ({ node, ...props }) => (
                <pre className="bg-gray-800 text-green-400 p-4 rounded text-sm overflow-x-auto my-4" {...props} />
              ),
              // Style tables
              table: ({ node, ...props }) => (
                <div className="overflow-x-auto my-6">
                  <table className="min-w-full divide-y divide-gray-200 border border-gray-200" {...props} />
                </div>
              ),
              thead: ({ node, ...props }) => (
                <thead className="bg-gray-50" {...props} />
              ),
              th: ({ node, ...props }) => (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" {...props} />
              ),
              td: ({ node, ...props }) => (
                <td className="px-4 py-3 text-sm text-gray-700 border-t border-gray-200" {...props} />
              ),
              // Style blockquotes
              blockquote: ({ node, ...props }) => (
                <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-600 my-4" {...props} />
              ),
              // Style links
              a: ({ node, ...props }) => (
                <a className="text-blue-600 hover:text-blue-800 underline" {...props} />
              ),
              // Style strong/bold
              strong: ({ node, ...props }) => (
                <strong className="font-semibold text-gray-900" {...props} />
              ),
              // Style em/italic
              em: ({ node, ...props }) => (
                <em className="italic text-gray-600" {...props} />
              ),
            }}
          >
            {scoringGuideContent}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default ScoreGuide;

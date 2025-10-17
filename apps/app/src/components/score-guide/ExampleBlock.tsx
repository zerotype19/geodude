import CodeBlock from "./CodeBlock";

type Example = { caption: string; html?: string; text?: string; schema?: string };

export default function ExampleBlock({ good, bad, checkId }: { good: Example[]; bad: Example[]; checkId?: string }) {
  const render = (ex: Example) => {
    const code = ex.schema ?? ex.html ?? ex.text ?? "";
    const lang = ex.schema ? "json" : ex.html ? "html" : "text";
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium text-neutral-300">{ex.caption}</div>
        <CodeBlock code={code} language={lang} checkId={checkId} />
      </div>
    );
  };

  return (
    <div id="examples" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <div className="mb-3 font-semibold text-green-400">✅ Good examples</div>
        <div className="space-y-4">{good.map((e, i) => <div key={i}>{render(e)}</div>)}</div>
      </div>
      <div>
        <div className="mb-3 font-semibold text-amber-400">⚠️ Missing / Bad examples</div>
        <div className="space-y-4">{bad.map((e, i) => <div key={i}>{render(e)}</div>)}</div>
      </div>
    </div>
  );
}


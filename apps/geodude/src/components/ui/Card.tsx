export function Card({ title, children }: { title: string; children: any }) {
  return (
    <div className="bg-white rounded-2xl border shadow-sm">
      <div className="px-4 py-3 border-b text-sm font-medium">{title}</div>
      <div className="p-4">{children}</div>
    </div>
  );
}

type InsightListProps = {
  title: string;
  items: Array<{ text: string }>;
  emptyMessage: string;
};

export default function InsightList({ title, items, emptyMessage }: InsightListProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">{emptyMessage}</p>
      ) : (
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
          {items.map((item) => (
            <li key={item.text}>{item.text}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

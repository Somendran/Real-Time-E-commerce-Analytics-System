type InsightListProps = {
  title: string;
  items: Array<{ text: string }>;
  emptyMessage: string;
};

export default function InsightList({ title, items, emptyMessage }: InsightListProps) {
  const isRecommendation = title.toLowerCase().includes("recommend");
  const sectionClass = isRecommendation
    ? "rounded-lg bg-[#ecfff6] p-5 text-[#003823] shadow-[0_12px_32px_rgba(0,108,73,0.07)] sm:p-6"
    : "rounded-lg bg-[#eef7ff] p-5 text-[#001e2f] shadow-[0_12px_32px_rgba(0,101,145,0.07)] sm:p-6";
  const bulletClass = isRecommendation ? "text-[#006c49]" : "text-[#006591]";

  return (
    <section className={sectionClass}>
      <h2 className="text-lg font-bold">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm opacity-80">{emptyMessage}</p>
      ) : (
        <ul className="mt-4 space-y-3 text-sm leading-6">
          {items.map((item) => (
            <li key={item.text} className="flex items-start gap-3">
              <span className={bulletClass}>•</span>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

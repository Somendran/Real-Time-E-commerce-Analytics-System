type AnomalyItem = {
  date: string;
  revenue: number;
  z_score: number;
};

type AnomalyListProps = {
  anomalies: AnomalyItem[];
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function AnomalyList({ anomalies }: AnomalyListProps) {
  return (
    <section className="rounded-2xl border border-rose-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Revenue Anomalies</h2>
        <p className="mt-1 text-sm text-slate-600">
          Flagged using Z-score threshold above 2.5. Highlighted rows indicate unusual daily revenue behavior.
        </p>
      </div>

      {anomalies.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          No anomalies detected in the current window.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Revenue</th>
                <th className="px-3 py-2">Z-Score</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((item) => (
                <tr key={`${item.date}-${item.z_score}`} className="rounded-lg bg-rose-50 text-sm text-rose-900">
                  <td className="px-3 py-2 font-medium">{item.date}</td>
                  <td className="px-3 py-2">{formatCurrency(item.revenue)}</td>
                  <td className="px-3 py-2">{item.z_score.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

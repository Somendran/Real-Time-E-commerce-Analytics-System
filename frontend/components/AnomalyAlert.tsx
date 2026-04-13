type Anomaly = {
  date: string;
  revenue: number;
  z_score: number;
};

type AnomalyAlertProps = {
  anomalies: Anomaly[];
  loading?: boolean;
  error?: string | null;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function AnomalyAlert({ anomalies, loading = false, error = null }: AnomalyAlertProps) {
  const latestThree = [...anomalies]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">Anomaly Alerts</h2>
      <p className="mt-1 text-sm text-slate-700">Automated checks for unusual revenue spikes using Z-score.</p>

      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-slate-600">Loading anomaly signals...</p>
        ) : error ? (
          <p className="text-sm text-amber-800">Unable to load anomalies: {error}</p>
        ) : latestThree.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            No anomalies detected
          </p>
        ) : (
          <ul className="space-y-2">
            {latestThree.map((item) => (
              <li
                key={`${item.date}-${item.z_score}`}
                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900"
              >
                <span className="font-semibold">⚠️ Unusual spike detected on {item.date}</span>
                <span className="ml-2 text-rose-800">
                  ({formatCurrency(item.revenue)}, z={item.z_score.toFixed(2)})
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

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
    <section className="rounded-lg bg-[#fff8e8] p-5 text-[#4f2d00] shadow-[0_12px_32px_rgba(79,45,0,0.06)] sm:p-6">
      <h2 className="text-lg font-bold">Anomaly Alerts</h2>
      <p className="mt-1 text-sm opacity-80">Automated checks for unusual revenue spikes using Z-score.</p>

      <div className="mt-4">
        {loading ? (
          <p className="text-sm opacity-80">Loading anomaly signals...</p>
        ) : error ? (
          <p className="text-sm text-amber-800">Unable to load anomalies: {error}</p>
        ) : latestThree.length === 0 ? (
          <p className="rounded-lg bg-white/80 px-3 py-2 text-sm text-[#45464d]">
            No anomalies detected
          </p>
        ) : (
          <ul className="space-y-2">
            {latestThree.map((item) => (
              <li
                key={`${item.date}-${item.z_score}`}
                className="rounded-lg bg-white/85 px-3 py-2 text-sm text-rose-900 shadow-[0_6px_18px_rgba(79,45,0,0.04)]"
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

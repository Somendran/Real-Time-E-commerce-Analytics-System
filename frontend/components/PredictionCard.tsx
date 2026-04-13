type PredictionCardProps = {
  value: number;
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

export default function PredictionCard({ value, loading = false, error = null }: PredictionCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium tracking-wide text-slate-500">Predicted Revenue Tomorrow</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">
        {loading ? "Loading..." : error ? "Unavailable" : formatCurrency(value)}
      </p>
      <p className="mt-1 text-xs text-slate-500">Based on recent trends and historical data</p>
      {error ? <p className="mt-2 text-xs text-amber-700">{error}</p> : null}
    </div>
  );
}

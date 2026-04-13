type PredictionCardProps = {
  value: number;
  lowerBound?: number;
  upperBound?: number;
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

export default function PredictionCard({
  value,
  lowerBound,
  upperBound,
  loading = false,
  error = null,
}: PredictionCardProps) {
  const hasRange = lowerBound !== undefined && upperBound !== undefined;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium tracking-wide text-slate-500">Predicted Revenue Tomorrow</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">
        {loading ? "Loading..." : error ? "Unavailable" : formatCurrency(value)}
      </p>
      {loading || error || !hasRange ? (
        <p className="mt-1 text-xs text-slate-500">Based on recent trends and historical data</p>
      ) : (
        <p className="mt-1 text-xs text-slate-500">
          Expected range: {formatCurrency(lowerBound)} - {formatCurrency(upperBound)}
        </p>
      )}
      {error ? <p className="mt-2 text-xs text-amber-700">{error}</p> : null}
    </div>
  );
}

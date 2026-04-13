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
    <div className="relative overflow-hidden rounded-lg bg-white p-6 text-[#131b2e] shadow-[0_12px_32px_rgba(19,27,46,0.05)]">
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#f2f3ff]" />
      <div className="relative">
      <p className="text-xs font-bold uppercase tracking-wider text-[#45464d]">Predicted Tomorrow</p>
      <p className="mt-3 text-4xl font-black text-[#131b2e]">
        {loading ? "Loading..." : error ? "Unavailable" : formatCurrency(value)}
      </p>
      {loading || error || !hasRange ? (
        <p className="mt-2 text-sm text-[#45464d]">Based on recent trends and historical data</p>
      ) : (
        <p className="mt-2 text-sm text-[#45464d]">
          Expected range: {formatCurrency(lowerBound)} - {formatCurrency(upperBound)}
        </p>
      )}
      {error ? <p className="mt-2 text-xs text-amber-700">{error}</p> : null}
      </div>
    </div>
  );
}

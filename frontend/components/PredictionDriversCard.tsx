import type { GlobalFeatureImportance, PredictionDriver } from "../lib/api";

type PredictionDriversCardProps = {
  drivers: PredictionDriver[];
  globalImportance: GlobalFeatureImportance[];
  error?: string | null;
};

function formatCurrency(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.abs(value));

  return `${sign}${formatted}`;
}

function formatFeatureName(feature: string): string {
  const labels: Record<string, string> = {
    day_of_week: "Day of week",
    day_of_month: "Day of month",
    month: "Month",
    quarter: "Quarter",
    is_weekend: "Weekend effect",
    lag_1: "Yesterday's revenue",
    lag_2: "Revenue 2 days ago",
    lag_3: "Revenue 3 days ago",
    lag_7: "Revenue last week",
    rolling_mean_3: "Recent 3-day average",
    rolling_mean_7: "Recent 7-day average",
    rolling_mean_14: "Recent 14-day average",
    rolling_std_7: "Recent volatility",
    revenue_change_1: "Yesterday's revenue change",
  };

  return labels[feature] ?? feature.replace(/_/g, " ");
}

export default function PredictionDriversCard({
  drivers,
  globalImportance,
  error = null,
}: PredictionDriversCardProps) {
  const topGlobal = globalImportance.slice(0, 5);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6 xl:col-span-2">
      <h2 className="text-lg font-semibold text-slate-900">Why the Forecast Changed</h2>
      <p className="mt-1 text-sm text-slate-600">
        Positive values pushed tomorrow's revenue forecast higher. Negative values pulled it lower.
      </p>
      {error ? <p className="mt-2 text-sm text-amber-700">{error}</p> : null}

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Tomorrow's main drivers</h3>
          {drivers.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No driver data available</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {drivers.map((item) => (
                <li
                  key={item.feature}
                  className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 whitespace-normal break-words text-slate-700">
                    {formatFeatureName(item.feature)}
                  </span>
                  <span
                    className={
                      item.impact >= 0
                        ? "whitespace-nowrap text-right font-semibold text-emerald-700"
                        : "whitespace-nowrap text-right font-semibold text-rose-700"
                    }
                  >
                    {formatCurrency(item.impact)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-700">Most important signals overall</h3>
          {topGlobal.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No global importance data available</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {topGlobal.map((item) => (
                <li
                  key={item.feature}
                  className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 whitespace-normal break-words text-slate-700">
                    {formatFeatureName(item.feature)}
                  </span>
                  <span className="whitespace-nowrap text-right font-semibold text-slate-900">
                    {item.mean_abs_shap.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

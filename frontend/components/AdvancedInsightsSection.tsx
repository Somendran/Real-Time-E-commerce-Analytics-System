import type {
  AnomalyExplanationResponse,
  ChurnRiskResponse,
  CohortRetentionResponse,
  CustomerLTVResponse,
  RevenueDecompositionResponse,
} from "../lib/api";

type AdvancedInsightsSectionProps = {
  cohortRetention: CohortRetentionResponse;
  revenueDecomposition: RevenueDecompositionResponse;
  churnRisk: ChurnRiskResponse;
  anomalyExplanation: AnomalyExplanationResponse;
  customerLTV: CustomerLTVResponse;
  error?: string | null;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function valueColor(value: number): string {
  if (value > 0) return "text-[#006c49]";
  if (value < 0) return "text-rose-700";
  return "text-[#45464d]";
}

function retentionCellClass(value: number): string {
  if (value >= 75) return "bg-[#006c49] text-white";
  if (value >= 50) return "bg-[#6cf8bb] text-[#002113]";
  if (value >= 25) return "bg-[#c9e6ff] text-[#001e2f]";
  if (value > 0) return "bg-[#f2f3ff] text-[#131b2e]";
  return "bg-[#faf8ff] text-[#76777d]";
}

function CohortRetentionTable({ data }: { data: CohortRetentionResponse }) {
  const maxMonths = Math.max(0, ...data.cohorts.map((cohort) => cohort.retention.length));
  const months = Array.from({ length: maxMonths }, (_, index) => `month_${index}`);

  return (
    <section className="rounded-lg bg-white p-5 shadow-[0_12px_32px_rgba(19,27,46,0.05)] xl:col-span-2">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold text-[#131b2e]">Cohort Retention</h3>
        <p className="text-sm text-[#45464d]">Monthly return rate by first purchase month.</p>
      </div>

      <div className="mt-5 overflow-x-auto">
        {data.cohorts.length === 0 || months.length === 0 ? (
          <p className="rounded-lg bg-[#f2f3ff] px-4 py-3 text-sm text-[#45464d]">No cohort data available</p>
        ) : (
          <table className="min-w-full border-separate border-spacing-y-2 text-left text-sm">
            <thead>
              <tr className="text-xs font-bold uppercase tracking-wider text-[#45464d]">
                <th className="whitespace-nowrap px-3 py-2">Cohort</th>
                {months.map((month) => (
                  <th key={month} className="whitespace-nowrap px-3 py-2">
                    {month}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.cohorts.slice(0, 12).map((cohort) => (
                <tr key={cohort.cohort_month}>
                  <td className="whitespace-nowrap rounded-l-lg bg-[#faf8ff] px-3 py-3 font-bold text-[#131b2e]">
                    {cohort.cohort_month}
                  </td>
                  {months.map((month, index) => {
                    const value = cohort.retention[index] ?? 0;
                    return (
                      <td key={`${cohort.cohort_month}-${month}`} className="px-1 py-1">
                        <span
                          className={`block rounded-md px-3 py-2 text-center text-xs font-bold ${retentionCellClass(
                            value,
                          )}`}
                        >
                          {value.toFixed(0)}%
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function RevenueDecompositionCard({ data }: { data: RevenueDecompositionResponse }) {
  const items = [
    { label: "Total change", value: data.total_change_pct },
    { label: "Order volume impact", value: data.order_contribution_pct },
    { label: "Average order value impact", value: data.aov_contribution_pct },
  ];

  return (
    <section className="rounded-lg bg-white p-5 shadow-[0_12px_32px_rgba(19,27,46,0.05)]">
      <h3 className="text-lg font-bold text-[#131b2e]">Revenue Decomposition</h3>
      <p className="mt-1 text-sm text-[#45464d]">Revenue movement split by volume and order value.</p>
      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-lg bg-[#f2f3ff] px-4 py-3">
            <span className="text-sm font-semibold text-[#45464d]">{item.label}</span>
            <span className={`text-lg font-black ${valueColor(item.value)}`}>{formatPercent(item.value)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ChurnRiskCard({ data }: { data: ChurnRiskResponse }) {
  return (
    <section className="rounded-lg bg-white p-5 shadow-[0_12px_32px_rgba(19,27,46,0.05)]">
      <h3 className="text-lg font-bold text-[#131b2e]">Churn Risk</h3>
      <p className="mt-1 text-sm text-[#45464d]">Customers with declining recent activity.</p>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <div className="rounded-lg bg-[#fff8e8] px-4 py-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[#4f2d00]">High risk customers</p>
          <p className="mt-2 text-3xl font-black text-[#131b2e]">
            {data.high_risk_customers.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg bg-[#ecfff6] px-4 py-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[#006c49]">Potential revenue loss</p>
          <p className="mt-2 text-3xl font-black text-[#131b2e]">
            {formatCurrency(data.potential_revenue_loss)}
          </p>
        </div>
      </div>
    </section>
  );
}

function AnomalyExplanationPanel({ data }: { data: AnomalyExplanationResponse }) {
  return (
    <section className="rounded-lg bg-[#fff8e8] p-5 text-[#4f2d00] shadow-[0_12px_32px_rgba(79,45,0,0.06)]">
      <h3 className="text-lg font-bold">Anomaly Explanation</h3>
      <p className="mt-1 text-sm opacity-80">Top category and state drivers on anomaly dates.</p>
      <div className="mt-5 space-y-3">
        {data.length === 0 ? (
          <p className="rounded-lg bg-white/80 px-4 py-3 text-sm text-[#45464d]">No anomaly explanation available</p>
        ) : (
          data.slice(0, 5).map((item) => (
            <article key={item.date} className="rounded-lg bg-white/85 px-4 py-4 shadow-[0_6px_18px_rgba(79,45,0,0.04)]">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h4 className="font-bold text-[#131b2e]">{item.date}</h4>
                <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Revenue spike driver</span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-[#45464d]">Top category</p>
                  <p className="mt-1 font-bold text-[#131b2e]">
                    {item.top_category.replace(/_/g, " ")}{" "}
                    <span className={valueColor(item.category_increase_pct)}>
                      {formatPercent(item.category_increase_pct)}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-[#45464d]">Top state</p>
                  <p className="mt-1 font-bold text-[#131b2e]">
                    {item.top_state}{" "}
                    <span className={valueColor(item.state_increase_pct)}>
                      {formatPercent(item.state_increase_pct)}
                    </span>
                  </p>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function CustomerLTVTable({ data }: { data: CustomerLTVResponse }) {
  return (
    <section className="rounded-lg bg-white p-5 shadow-[0_12px_32px_rgba(19,27,46,0.05)]">
      <h3 className="text-lg font-bold text-[#131b2e]">Customer LTV</h3>
      <p className="mt-1 text-sm text-[#45464d]">Top customers by estimated lifetime value.</p>
      <div className="mt-5 overflow-x-auto">
        {data.top_customers.length === 0 ? (
          <p className="rounded-lg bg-[#f2f3ff] px-4 py-3 text-sm text-[#45464d]">No LTV data available</p>
        ) : (
          <table className="min-w-full border-separate border-spacing-y-2 text-left text-sm">
            <thead>
              <tr className="text-xs font-bold uppercase tracking-wider text-[#45464d]">
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2 text-right">LTV</th>
              </tr>
            </thead>
            <tbody>
              {data.top_customers.slice(0, 10).map((customer) => (
                <tr key={customer.customer_id}>
                  <td className="max-w-[260px] truncate rounded-l-lg bg-[#faf8ff] px-3 py-3 font-semibold text-[#131b2e]">
                    {customer.customer_id}
                  </td>
                  <td className="whitespace-nowrap rounded-r-lg bg-[#faf8ff] px-3 py-3 text-right font-black text-[#006c49]">
                    {formatCurrency(customer.ltv)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export default function AdvancedInsightsSection({
  cohortRetention,
  revenueDecomposition,
  churnRisk,
  anomalyExplanation,
  customerLTV,
  error = null,
}: AdvancedInsightsSectionProps) {
  return (
    <section className="mt-8">
      <div className="mb-4">
        <h2 className="text-xl font-black text-[#131b2e]">Advanced Insights</h2>
        {error ? <p className="mt-1 text-sm text-amber-700">{error}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <CohortRetentionTable data={cohortRetention} />
        <RevenueDecompositionCard data={revenueDecomposition} />
        <ChurnRiskCard data={churnRisk} />
        <AnomalyExplanationPanel data={anomalyExplanation} />
        <CustomerLTVTable data={customerLTV} />
      </div>
    </section>
  );
}

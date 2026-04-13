"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import AnomalyAlert from "../components/AnomalyAlert";
import BarChartCard from "../components/BarChartCard";
import CustomerSegmentationChart from "../components/CustomerSegmentationChart";
import InsightList from "../components/InsightList";
import KpiCard from "../components/KpiCard";
import LineChartCard from "../components/LineChartCard";
import PredictionCard from "../components/PredictionCard";
import {
  type Anomaly,
  type CategoryAnalysisPoint,
  type CustomerSegmentPoint,
  type DashboardFilters,
  type FilterOptions,
  type GeoAnalysisPoint,
  type GrowthPoint,
  type Insight,
  type ModelMetrics,
  type Metrics,
  type OrdersPoint,
  type Prediction,
  type Recommendation,
  type RevenuePoint,
  type WeekdayAnalysisPoint,
  getDashboardData,
  getFilterOptions,
} from "../lib/api";

type DashboardState = {
  metrics: Metrics | null;
  dailyRevenue: RevenuePoint[];
  dailyOrders: OrdersPoint[];
  dataGrowth: GrowthPoint[];
  prediction: Prediction | null;
  anomalies: Anomaly[];
  categoryAnalysis: CategoryAnalysisPoint[];
  customerSegmentation: CustomerSegmentPoint[];
  weekdayAnalysis: WeekdayAnalysisPoint[];
  insights: Insight[];
  recommendations: Recommendation[];
  geoAnalysis: GeoAnalysisPoint[];
  modelMetrics: ModelMetrics;
};

const REFRESH_INTERVAL_MS = 30000;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_MODEL_METRICS: ModelMetrics = {
  mae: null,
  rmse: null,
  mape: null,
  last_trained_at: null,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function DashboardPage() {
  const [state, setState] = useState<DashboardState>({
    metrics: null,
    dailyRevenue: [],
    dailyOrders: [],
    dataGrowth: [],
    prediction: null,
    anomalies: [],
    categoryAnalysis: [],
    customerSegmentation: [],
    weekdayAnalysis: [],
    insights: [],
    recommendations: [],
    geoAnalysis: [],
    modelMetrics: DEFAULT_MODEL_METRICS,
  });
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const [anomalyError, setAnomalyError] = useState<string | null>(null);
  const [biError, setBiError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setError(null);
      const data = await getDashboardData(filters);
      setState(data);
      setLastUpdated(new Date());
      setPredictionError(data.predictionError);
      setAnomalyError(data.anomalyError);
      setBiError(data.biError);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown API error";
      setError(message);
      setPredictionError("Prediction endpoint temporarily unavailable");
      setAnomalyError("Anomaly endpoint temporarily unavailable");
      setBiError("BI insights temporarily unavailable");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadDashboard();

    const intervalId = window.setInterval(() => {
      void loadDashboard();
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadDashboard]);

  useEffect(() => {
    getFilterOptions()
      .then(setFilterOptions)
      .catch(() => setFilterOptions(null));
  }, []);

  const metrics = useMemo(
    () => ({
      totalOrders: state.metrics?.total_orders ?? 0,
      totalRevenue: state.metrics?.total_revenue ?? 0,
      predictedRevenue: state.prediction?.predicted_revenue ?? 0,
    }),
    [state.metrics, state.prediction],
  );

  const categoryChartData = useMemo(
    () =>
      state.categoryAnalysis.slice(0, 10).map((item) => ({
        category: item.category.replace(/_/g, " "),
        revenue: item.revenue,
      })),
    [state.categoryAnalysis],
  );

  const weekdayChartData = useMemo(
    () =>
      [...state.weekdayAnalysis]
        .sort((a, b) => a.day - b.day)
        .map((item) => ({
          day: WEEKDAY_LABELS[item.day] ?? String(item.day),
          avg_revenue: item.avg_revenue,
        })),
    [state.weekdayAnalysis],
  );

  const geoChartData = useMemo(
    () =>
      state.geoAnalysis.slice(0, 10).map((item, index) => ({
        state: index === 0 ? `${item.state} (Top)` : item.state,
        revenue: item.revenue,
      })),
    [state.geoAnalysis],
  );

  const insightItems = useMemo(
    () => state.insights.map((item) => ({ text: item.insight })),
    [state.insights],
  );

  const recommendationItems = useMemo(
    () => state.recommendations.map((item) => ({ text: item.recommendation })),
    [state.recommendations],
  );

  const updateFilter = (key: keyof DashboardFilters, value: string) => {
    setFilters((current) => {
      const next = { ...current };

      if (value === "") {
        delete next[key];
      } else if (key === "minRevenue" || key === "maxRevenue") {
        next[key] = Number(value);
      } else {
        next[key] = value;
      }

      return next;
    });
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              E-commerce Real-Time Analytics Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Live operational metrics from the Olist streaming pipeline.
            </p>
          </div>
          <div className="text-sm text-slate-500">
            Last updated: {lastUpdated ? lastUpdated.toLocaleString() : "-"}
          </div>
        </header>

        {loading ? (
          <section className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
            Loading dashboard data...
          </section>
        ) : null}

        {error ? (
          <section className="mb-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            Failed to load dashboard data: {error}
          </section>
        ) : null}

        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Dashboard Filters</h2>
              <p className="text-sm text-slate-600">Filter metrics, BI charts, and recommendations.</p>
            </div>
            <button
              type="button"
              onClick={() => setFilters({})}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Reset Filters
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm font-medium text-slate-700">
              Start Date
              <input
                type="date"
                value={filters.startDate ?? ""}
                min={filterOptions?.min_date || undefined}
                max={filterOptions?.max_date || undefined}
                onChange={(event) => updateFilter("startDate", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              End Date
              <input
                type="date"
                value={filters.endDate ?? ""}
                min={filterOptions?.min_date || undefined}
                max={filterOptions?.max_date || undefined}
                onChange={(event) => updateFilter("endDate", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Product Category
              <select
                value={filters.category ?? ""}
                onChange={(event) => updateFilter("category", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              >
                <option value="">All categories</option>
                {filterOptions?.categories.map((category) => (
                  <option key={category} value={category}>
                    {category.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Customer State
              <select
                value={filters.state ?? ""}
                onChange={(event) => updateFilter("state", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              >
                <option value="">All states</option>
                {filterOptions?.states.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Min Revenue
              <input
                type="number"
                value={filters.minRevenue ?? ""}
                min={filterOptions?.min_revenue}
                max={filterOptions?.max_revenue}
                placeholder={filterOptions ? String(Math.floor(filterOptions.min_revenue)) : "0"}
                onChange={(event) => updateFilter("minRevenue", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Max Revenue
              <input
                type="number"
                value={filters.maxRevenue ?? ""}
                min={filterOptions?.min_revenue}
                max={filterOptions?.max_revenue}
                placeholder={filterOptions ? String(Math.ceil(filterOptions.max_revenue)) : "0"}
                onChange={(event) => updateFilter("maxRevenue", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </label>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            title="Total Orders"
            value={new Intl.NumberFormat("en-US").format(metrics.totalOrders)}
            subtitle="Filtered rows currently available in orders_clean"
          />
          <KpiCard
            title="Total Revenue"
            value={formatCurrency(metrics.totalRevenue)}
            subtitle="Filtered payment_value from loaded batches"
          />
          <PredictionCard
            value={metrics.predictedRevenue}
            loading={loading}
            error={predictionError}
          />
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <LineChartCard
            title="Daily Revenue"
            data={state.dailyRevenue}
            xKey="date"
            yKey="revenue"
            yAxisLabel="Revenue"
            stroke="#0f766e"
          />

          <LineChartCard
            title="Daily Orders"
            data={state.dailyOrders}
            xKey="date"
            yKey="count"
            yAxisLabel="Orders"
            stroke="#1d4ed8"
          />

          <div className="xl:col-span-2">
            <LineChartCard
              title="Data Growth (Cumulative Rows)"
              data={state.dataGrowth}
              xKey="date"
              yKey="total_rows"
              yAxisLabel="Cumulative Rows"
              stroke="#be123c"
            />
          </div>
        </section>

        <section className="mt-6">
          <AnomalyAlert anomalies={state.anomalies} loading={loading} error={anomalyError} />
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Business Intelligence</h2>
            {biError ? <p className="mt-1 text-sm text-amber-700">{biError}</p> : null}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <BarChartCard
              title="Category Analysis"
              data={categoryChartData}
              xKey="category"
              yKey="revenue"
              yAxisLabel="Revenue"
              fill="#0f766e"
            />

            <CustomerSegmentationChart data={state.customerSegmentation} />

            <BarChartCard
              title="Weekday Analysis"
              data={weekdayChartData}
              xKey="day"
              yKey="avg_revenue"
              yAxisLabel="Avg Revenue"
              fill="#2563eb"
            />

            <BarChartCard
              title="Geographic Analysis"
              data={geoChartData}
              xKey="state"
              yKey="revenue"
              yAxisLabel="Revenue"
              fill="#be123c"
            />

            <InsightList
              title="Key Insights"
              items={insightItems}
              emptyMessage="No insights available yet ⚠️"
            />

            <InsightList
              title="Recommendations"
              items={recommendationItems}
              emptyMessage="No recommendations available yet ⚠️"
            />

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6 xl:col-span-2">
              <h2 className="text-lg font-semibold text-slate-900">Model Metrics</h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
                <KpiCard
                  title="MAE"
                  value={state.modelMetrics.mae === null ? "-" : formatCurrency(state.modelMetrics.mae)}
                />
                <KpiCard
                  title="RMSE"
                  value={state.modelMetrics.rmse === null ? "-" : formatCurrency(state.modelMetrics.rmse)}
                />
                <KpiCard
                  title="MAPE"
                  value={state.modelMetrics.mape === null ? "-" : `${state.modelMetrics.mape.toFixed(2)}%`}
                />
                <KpiCard
                  title="Last Trained"
                  value={
                    state.modelMetrics.last_trained_at
                      ? new Date(state.modelMetrics.last_trained_at).toLocaleDateString()
                      : "-"
                  }
                />
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

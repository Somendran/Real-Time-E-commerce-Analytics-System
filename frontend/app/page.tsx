"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import AnomalyAlert from "../components/AnomalyAlert";
import KpiCard from "../components/KpiCard";
import LineChartCard from "../components/LineChartCard";
import PredictionCard from "../components/PredictionCard";
import {
  type Anomaly,
  type GrowthPoint,
  type Metrics,
  type OrdersPoint,
  type Prediction,
  type RevenuePoint,
  getDashboardData,
} from "../lib/api";

type DashboardState = {
  metrics: Metrics | null;
  dailyRevenue: RevenuePoint[];
  dailyOrders: OrdersPoint[];
  dataGrowth: GrowthPoint[];
  prediction: Prediction | null;
  anomalies: Anomaly[];
};

const REFRESH_INTERVAL_MS = 30000;

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
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const [anomalyError, setAnomalyError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setError(null);
      const data = await getDashboardData();
      setState(data);
      setLastUpdated(new Date());
      setPredictionError(data.predictionError);
      setAnomalyError(data.anomalyError);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown API error";
      setError(message);
      setPredictionError("Prediction endpoint temporarily unavailable");
      setAnomalyError("Anomaly endpoint temporarily unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();

    const intervalId = window.setInterval(() => {
      void loadDashboard();
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadDashboard]);

  const metrics = useMemo(
    () => ({
      totalOrders: state.metrics?.total_orders ?? 0,
      totalRevenue: state.metrics?.total_revenue ?? 0,
      predictedRevenue: state.prediction?.predicted_revenue ?? 0,
    }),
    [state.metrics, state.prediction],
  );

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
          <section className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
            Loading dashboard data...
          </section>
        ) : null}

        {error ? (
          <section className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            Failed to load dashboard data: {error}
          </section>
        ) : null}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            title="Total Orders"
            value={new Intl.NumberFormat("en-US").format(metrics.totalOrders)}
            subtitle="All records currently available in orders_clean"
          />
          <KpiCard
            title="Total Revenue"
            value={formatCurrency(metrics.totalRevenue)}
            subtitle="Aggregated payment_value from all loaded batches"
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
      </div>
    </main>
  );
}

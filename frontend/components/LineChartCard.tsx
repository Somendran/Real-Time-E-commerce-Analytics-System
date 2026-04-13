"use client";

import {
  CartesianGrid,
  Label,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type LineChartCardProps = {
  title: string;
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKey: string;
  yAxisLabel: string;
  stroke: string;
};

export default function LineChartCard({
  title,
  data,
  xKey,
  yKey,
  yAxisLabel,
  stroke,
}: LineChartCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-4 h-72 w-full sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey={xKey} tick={{ fill: "#475569", fontSize: 12 }} minTickGap={24} />
            <YAxis tick={{ fill: "#475569", fontSize: 12 }}>
              <Label
                value={yAxisLabel}
                angle={-90}
                position="insideLeft"
                style={{ fill: "#475569", textAnchor: "middle" }}
              />
            </YAxis>
            <Tooltip />
            <Line
              type="monotone"
              dataKey={yKey}
              stroke={stroke}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

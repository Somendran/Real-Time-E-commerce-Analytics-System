"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type BarChartCardProps = {
  title: string;
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKey: string;
  yAxisLabel: string;
  fill: string;
};

export default function BarChartCard({
  title,
  data,
  xKey,
  yKey,
  yAxisLabel,
  fill,
}: BarChartCardProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-4 h-72 w-full sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey={xKey}
              interval={0}
              minTickGap={12}
              tick={{ fill: "#475569", fontSize: 12 }}
              tickMargin={10}
            />
            <YAxis tick={{ fill: "#475569", fontSize: 12 }}>
              <Label
                value={yAxisLabel}
                angle={-90}
                position="insideLeft"
                style={{ fill: "#475569", textAnchor: "middle" }}
              />
            </YAxis>
            <Tooltip />
            <Bar dataKey={yKey} fill={fill} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

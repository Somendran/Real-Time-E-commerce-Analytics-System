type KpiCardProps = {
  title: string;
  value: string;
  subtitle?: string;
};

export default function KpiCard({ title, value, subtitle }: KpiCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

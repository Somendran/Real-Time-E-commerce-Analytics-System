type KpiCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  variant?: "light" | "dark";
  badge?: string;
};

export default function KpiCard({ title, value, subtitle, variant = "light", badge }: KpiCardProps) {
  const isDark = variant === "dark";

  return (
    <div
      className={
        isDark
          ? "relative overflow-hidden rounded-lg bg-[#131b2e] p-6 text-white shadow-[0_16px_36px_rgba(19,27,46,0.12)]"
          : "relative overflow-hidden rounded-lg bg-white p-6 text-[#131b2e] shadow-[0_12px_32px_rgba(19,27,46,0.05)]"
      }
    >
      <div
        className={
          isDark
            ? "absolute -right-14 -top-14 h-32 w-32 rounded-full bg-[#006591]/25 blur-2xl"
            : "absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#f2f3ff]"
        }
      />
      <div className="relative">
        <div className="flex items-center gap-2">
          <p
            className={
              isDark
                ? "text-xs font-bold uppercase tracking-wider text-white/65"
                : "text-xs font-bold uppercase tracking-wider text-[#45464d]"
            }
          >
            {title}
          </p>
          {badge ? (
            <span className="rounded-md bg-[#6cf8bb] px-2 py-0.5 text-[11px] font-bold text-[#005236]">
              {badge}
            </span>
          ) : null}
        </div>
        <p className={isDark ? "mt-3 text-4xl font-black text-white" : "mt-3 text-4xl font-black text-[#131b2e]"}>
          {value}
        </p>
        {subtitle ? <p className={isDark ? "mt-2 text-sm text-white/65" : "mt-2 text-sm text-[#45464d]"}>{subtitle}</p> : null}
      </div>
    </div>
  );
}

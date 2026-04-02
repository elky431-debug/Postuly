"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ChartPeriod = "hier" | "semaine" | "mois" | "annee";

type CampaignChartProps = {
  period: ChartPeriod;
  values?: number[];
  labels?: string[];
};

const ORANGE = "#F97316";

export function CampaignChart({ period, values, labels: labelsProp }: CampaignChartProps) {
  const defaults: Record<ChartPeriod, { labels: string[]; count: number }> = {
    hier:    { labels: ["0h","2h","4h","6h","8h","10h","12h","14h","16h","18h","20h","22h"], count: 12 },
    semaine: { labels: ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"], count: 7 },
    mois:    { labels: Array.from({ length: 30 }, (_, i) => String(i + 1)), count: 30 },
    annee:   { labels: ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"], count: 12 },
  };

  const def = defaults[period];
  const labels = labelsProp?.length === def.count ? labelsProp : def.labels;
  const heights = values?.length === def.count ? values : Array(def.count).fill(0);
  const data = labels.map((name, i) => ({ name, v: heights[i] ?? 0 }));

  const showEveryN = period === "mois" ? 4 : 0;

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ORANGE} stopOpacity={0.30} />
              <stop offset="100%" stopColor={ORANGE} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 6" stroke="#EDEBE9" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#A8A29E" }}
            axisLine={false}
            tickLine={false}
            interval={showEveryN > 0 ? showEveryN - 1 : 0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#A8A29E" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ stroke: ORANGE, strokeWidth: 1, strokeDasharray: "4 3" }}
            formatter={(v) => [String(v ?? 0), "Candidatures"]}
            contentStyle={{
              fontSize: 12,
              fontFamily: "var(--font-geist-sans)",
              borderRadius: 10,
              border: "1px solid #E7E5E4",
              backgroundColor: "#FFFFFF",
              color: "#1C1917",
              boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
              padding: "8px 12px",
            }}
            labelStyle={{ color: "#78716C", marginBottom: 2 }}
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke={ORANGE}
            strokeWidth={2.5}
            fill="url(#areaGradient)"
            dot={false}
            activeDot={{ r: 5, fill: ORANGE, strokeWidth: 2, stroke: "#fff" }}
            isAnimationActive
            animationDuration={500}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

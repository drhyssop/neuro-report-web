'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface Point {
  date: string;
  [key: string]: string | number | null | undefined;
}

interface Props {
  data: Point[];
  series: { key: string; label: string; color: string }[];
  yMax?: number;
  yMin?: number;
  title: string;
}

export function TrendChart({ data, series, yMax = 5, yMin = 0, title }: Props) {
  if (data.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
        {title} — 데이터 없음
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 text-xs font-medium text-slate-700">{title}</div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 12, bottom: 6, left: -16 }}>
            <CartesianGrid stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis domain={[yMin, yMax]} tick={{ fontSize: 10 }} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                name={s.label}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

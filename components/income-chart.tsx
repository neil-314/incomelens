"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type Month = { month: string; label: string; income: number; expenses: number };
export function IncomeChart({
  months,
  currency,
}: {
  months: Month[];
  currency: string;
}) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={months}
          margin={{ top: 16, right: 8, left: 4, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke="#e5e7eb" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${value / 1000}k`}
          />
          <Tooltip
            formatter={(value) =>
              new Intl.NumberFormat("en-US", {
                style: "currency",
                currency,
              }).format(Number(value))
            }
          />
          <Legend
            iconType="square"
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
          />
          <Bar
            dataKey="income"
            name="Income"
            fill="#315d9c"
            isAnimationActive={false}
            maxBarSize={28}
          />
          <Bar
            dataKey="expenses"
            name="Expenses"
            fill="#b8c0cc"
            isAnimationActive={false}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

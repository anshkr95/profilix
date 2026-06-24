"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
import { RedditPost, RedditComment } from "@/types/reddit";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface SubredditChartProps {
  posts: RedditPost[];
  comments: RedditComment[];
}

export function SubredditChart({ posts, comments }: SubredditChartProps) {
  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};

    posts.forEach(p => {
      counts[p.subreddit] = (counts[p.subreddit] || 0) + 1;
    });
    comments.forEach(c => {
      counts[c.subreddit] = (counts[c.subreddit] || 0) + 1;
    });

    const data = Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Group tail into "Other"
    if (data.length > 8) {
      const topData = data.slice(0, 7);
      const otherValue = data.slice(7).reduce((acc, curr) => acc + curr.value, 0);
      topData.push({ name: "Other", value: otherValue });
      return topData;
    }

    return data;
  }, [posts, comments]);

  const COLORS = [
    '#ffffff', // foreground
    '#a3a3a3', // neutral-400
    '#737373', // neutral-500
    '#525252', // neutral-600
    '#404040', // neutral-700
    '#262626', // neutral-800
    '#171717', // neutral-900
    '#0a0a0a', // neutral-950
  ];

  if (chartData.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Subreddit Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[300px] w-full pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <RechartsTooltip
              contentStyle={{
                backgroundColor: 'var(--background)',
                borderColor: 'var(--border)',
                borderRadius: '6px',
                color: 'var(--foreground)'
              }}
              itemStyle={{ color: 'var(--foreground)' }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              wrapperStyle={{ fontSize: '12px', color: 'var(--muted-foreground)' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

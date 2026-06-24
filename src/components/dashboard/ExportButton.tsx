"use client";

import { Button } from "../ui/button";
import { Download } from "lucide-react";
import { AppState } from "@/types/reddit";

export function ExportButton({ state }: { state: AppState }) {
  const handleExport = () => {
    const csvContent = [];
    csvContent.push("Type,ID,Subreddit,Created UTC,Score,URL/Permalink,Title/Body");

    state.posts.forEach(p => {
      csvContent.push(`Post,${p.id},${p.subreddit},${p.created_utc},${p.score},https://reddit.com${p.permalink},"${(p.title || '').replace(/"/g, '""')}"`);
    });

    state.comments.forEach(c => {
      csvContent.push(`Comment,${c.id},${c.subreddit},${c.created_utc},${c.score},https://reddit.com${c.permalink},"${(c.body || '').replace(/"/g, '""')}"`);
    });

    const blob = new Blob([csvContent.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `profilix_${state.username}_export.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={state.posts.length === 0 && state.comments.length === 0}
      className="flex items-center gap-2"
    >
      <Download className="w-4 h-4" />
      Export CSV
    </Button>
  );
}

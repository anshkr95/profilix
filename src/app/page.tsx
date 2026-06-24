"use client";

import { useState } from "react";
import { Search, Activity, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRedditFetcher } from "@/hooks/useRedditFetcher";
import { ContentFeed } from "@/components/dashboard/ContentFeed";
import { SubredditChart } from "@/components/dashboard/SubredditChart";
import { ExportButton } from "@/components/dashboard/ExportButton";

export default function Home() {
  const [usernameInput, setUsernameInput] = useState("");
  const { state, scanUser } = useRedditFetcher();
  const [activeTab, setActiveTab] = useState<"posts" | "comments">("posts");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput.trim()) {
      scanUser(usernameInput.trim());
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-muted-foreground/30">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold tracking-tight text-lg">
            <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center">
               <Activity className="w-5 h-5" />
            </div>
            Profilix
          </div>

          <form onSubmit={handleSearch} className="flex-1 max-w-md mx-4 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search Reddit username..."
                className="pl-9 bg-muted/50 border-none focus-visible:ring-1 focus-visible:bg-transparent"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={state.loading}>
              {state.loading ? "Scanning..." : "Scan"}
            </Button>
          </form>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {!state.scanned && !state.loading && (
           <div className="flex flex-col items-center justify-center py-32 text-center">
             <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-6">
               <Search className="w-8 h-8 text-muted-foreground" />
             </div>
             <h1 className="text-3xl font-semibold tracking-tight mb-3">Audit Digital Footprints</h1>
             <p className="text-muted-foreground max-w-md text-balance">
               Enter a Reddit username to scan and recover deleted posts, removed comments, and analyze subreddit activity.
             </p>
           </div>
        )}

        {state.error && (
          <div className="p-4 mb-8 border border-red-500/20 bg-red-500/10 text-red-500 rounded-lg flex items-center gap-3">
             <AlertCircle className="w-5 h-5" />
             <p>{state.error}</p>
          </div>
        )}

        {state.scanned && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">

            <div className="md:col-span-4 space-y-6 sticky top-24">
               <div>
                  <h2 className="text-2xl font-semibold tracking-tight mb-1">u/{state.username}</h2>
                  <p className="text-sm text-muted-foreground flex items-center gap-4">
                     <span>{state.posts.length} Posts</span>
                     <span>{state.comments.length} Comments</span>
                  </p>
               </div>

               <SubredditChart posts={state.posts} comments={state.comments} />

               <div className="pt-4">
                 <ExportButton state={state} />
               </div>
            </div>

            <div className="md:col-span-8 space-y-6">
              <div className="flex items-center border-b border-border pb-px">
                <button
                  onClick={() => setActiveTab("posts")}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "posts"
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                  }`}
                >
                  Posts <span className="ml-2 bg-muted px-2 py-0.5 rounded-full text-xs">{state.posts.length}</span>
                </button>
                <button
                  onClick={() => setActiveTab("comments")}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "comments"
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                  }`}
                >
                  Comments <span className="ml-2 bg-muted px-2 py-0.5 rounded-full text-xs">{state.comments.length}</span>
                </button>
              </div>

              <div className="pt-4">
                <ContentFeed
                   items={activeTab === "posts" ? state.posts : state.comments}
                   type={activeTab}
                />
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}

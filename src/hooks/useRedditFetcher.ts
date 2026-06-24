"use client";

import { useState } from "react";
import { AppState, RedditPost, RedditComment } from "@/types/reddit";

export function useRedditFetcher() {
  const [state, setState] = useState<AppState>({
    username: "",
    posts: [],
    comments: [],
    loading: false,
    error: null,
    scanned: false,
  });

  const scanUser = async (username: string) => {
    if (!username) return;

    setState(prev => ({ ...prev, loading: true, error: null, username }));

    try {
      const [livePostsRes, searchPostsRes, liveCommentsRes, searchCommentsRes] = await Promise.allSettled([
        fetch(`/api/reddit/user/${username}/submitted.json?limit=100`).then(res => res.json()),
        fetch(`/api/arctic-shift/posts/search?author=${username}&limit=100`).then(res => res.json()),
        fetch(`/api/reddit/user/${username}/comments.json?limit=100`).then(res => res.json()),
        fetch(`/api/arctic-shift/comments/search?author=${username}&limit=100`).then(res => res.json()),
      ]);

      const newPosts: RedditPost[] = [];
      const newComments: RedditComment[] = [];

      // Process Posts
      if (livePostsRes.status === 'fulfilled' && livePostsRes.value?.data?.children) {
        livePostsRes.value.data.children.forEach((c: { data: RedditPost }) => newPosts.push(c.data));
      }
      if (searchPostsRes.status === 'fulfilled' && searchPostsRes.value?.data) {
        searchPostsRes.value.data.forEach((p: RedditPost) => {
          if (!newPosts.find(existing => existing.id === p.id)) {
             newPosts.push(p);
          }
        });
      }

      // Process Comments
      if (liveCommentsRes.status === 'fulfilled' && liveCommentsRes.value?.data?.children) {
        liveCommentsRes.value.data.children.forEach((c: { data: RedditComment }) => newComments.push(c.data));
      }
      if (searchCommentsRes.status === 'fulfilled' && searchCommentsRes.value?.data) {
        searchCommentsRes.value.data.forEach((c: RedditComment) => {
          if (!newComments.find(existing => existing.id === c.id)) {
            newComments.push({
               ...c,
               link_title: c.link_title || 'Unknown Post'
            });
          }
        });
      }

      // Sort by newest
      newPosts.sort((a, b) => b.created_utc - a.created_utc);
      newComments.sort((a, b) => b.created_utc - a.created_utc);

      setState(prev => ({
        ...prev,
        posts: newPosts,
        comments: newComments,
        loading: false,
        scanned: true,
      }));

    } catch (err: unknown) {
      setState(prev => ({ ...prev, loading: false, error: (err as Error).message || "Failed to scan" }));
    }
  };

  return { state, scanUser };
}

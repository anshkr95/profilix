"use client";

import { RedditPost, RedditComment } from "@/types/reddit";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, ArrowUp, ExternalLink, FileText } from "lucide-react";
import { Card, CardContent } from "../ui/card";

interface ContentFeedProps {
  items: (RedditPost | RedditComment)[];
  type: "posts" | "comments";
}

export function ContentFeed({ items, type }: ContentFeedProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground border border-dashed border-border rounded-lg">
        <FileText className="w-8 h-8 mb-4 opacity-50" />
        <p>No {type} found for this user.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <Card key={`${item.id}-${index}`} className="hover:border-muted-foreground/30 transition-colors">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">r/{item.subreddit}</span>
                  <span>•</span>
                  <span>{formatDistanceToNow(item.created_utc * 1000, { addSuffix: true })}</span>
                  <span>•</span>
                  <a
                    href={`https://reddit.com${item.permalink}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    View on Reddit <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {type === "posts" ? (
                  <PostContent post={item as RedditPost} />
                ) : (
                  <CommentContent comment={item as RedditComment} />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PostContent({ post }: { post: RedditPost }) {
  const isImage = post.url?.match(/\.(jpeg|jpg|gif|png|webp)$/i);

  return (
    <div>
      <h3 className="text-base sm:text-lg font-semibold leading-tight mb-2">
        {post.title}
      </h3>
      {post.selftext && (
        <p className="text-sm text-muted-foreground line-clamp-3 mb-3 whitespace-pre-wrap">
          {post.selftext}
        </p>
      )}
      {isImage && (
        <div className="mt-3 relative rounded-md overflow-hidden bg-muted border border-border flex items-center justify-center min-h-[200px] max-h-[400px]">
           {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.url} alt={post.title} className="object-contain max-h-[400px]" loading="lazy" />
        </div>
      )}
      <div className="flex items-center gap-4 mt-4 text-xs font-medium text-muted-foreground">
        <div className="flex items-center gap-1">
          <ArrowUp className="w-4 h-4" />
          {post.score}
        </div>
        <div className="flex items-center gap-1">
          <MessageSquare className="w-4 h-4" />
          {post.num_comments}
        </div>
      </div>
    </div>
  );
}

function CommentContent({ comment }: { comment: RedditComment }) {
  return (
    <div>
      <div className="text-sm font-medium mb-1 line-clamp-1 text-muted-foreground">
        On: {comment.link_title}
      </div>
      <p className="text-sm text-foreground whitespace-pre-wrap mt-2 pl-3 border-l-2 border-border">
        {comment.body}
      </p>
      <div className="flex items-center gap-4 mt-4 text-xs font-medium text-muted-foreground">
        <div className="flex items-center gap-1">
          <ArrowUp className="w-4 h-4" />
          {comment.score} points
        </div>
      </div>
    </div>
  );
}

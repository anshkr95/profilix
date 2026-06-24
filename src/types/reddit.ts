export interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  selftext?: string;
  url: string;
  permalink: string;
  created_utc: number;
  score: number;
  num_comments: number;
  domain?: string;
  media?: unknown;
  secure_media?: unknown;
  preview?: unknown;
  thumbnail?: string;
  author: string;
  is_self?: boolean;
}

export interface RedditComment {
  id: string;
  subreddit: string;
  body: string;
  link_title: string;
  link_permalink: string;
  permalink: string;
  created_utc: number;
  score: number;
  author: string;
}

export interface AppState {
  username: string;
  posts: RedditPost[];
  comments: RedditComment[];
  loading: boolean;
  error: string | null;
  scanned: boolean;
}

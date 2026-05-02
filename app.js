/* ===== STATE ===== */
const state = {
  username: '',
  allPosts: [],
  allComments: [],
  redditPostAfter: null,
  pullpushPostAfter: null,
  redditCommentAfter: null,
  pullpushCommentAfter: null,
  currentTab: 'posts',
  loading: false,
};

/* ===== REDDIT API via LOCAL PROXY ===== */
// Our Express server at /api/reddit/* proxies Reddit server-side,
// completely avoiding any browser CORS issues.
async function redditFetch(redditUrl) {
  // Convert https://www.reddit.com/user/X/about.json
  // to /api/reddit/user/X/about
  const urlObj = new URL(redditUrl);
  let pathname = urlObj.pathname; // e.g. /user/spez/about.json
  pathname = pathname.replace(/\.json$/, ''); // strip .json — server adds it
  const query = urlObj.search; // e.g. ?limit=25&after=...
  const localUrl = `/api/reddit${pathname}${query}`;

  // Try Local Server Proxy first (fastest, but might be blocked by Reddit on Render)
  try {
    const res = await fetch(localUrl);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("Local proxy fetch failed, falling back to public CORS proxies...");
  }

  // Fallback 1: corsproxy.io
  try {
    const corsUrl = `https://corsproxy.io/?${encodeURIComponent(redditUrl)}`;
    const res2 = await fetch(corsUrl);
    if (res2.ok) {
      return await res2.json();
    }
  } catch (e) {}

  // Fallback 2: allorigins.win
  const allOriginsUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(redditUrl)}`;
  const res3 = await fetch(allOriginsUrl);
  if (!res3.ok) {
    const err = await res3.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res3.status}`);
  }
  return res3.json();
}

const PAGE_SIZE = 100;

/* ===== UTILS ===== */
function timeAgo(utcSeconds) {
  const now = Date.now() / 1000;
  const diff = now - utcSeconds;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
  return `${Math.floor(diff / 31536000)}y ago`;
}

function accountAge(utcSeconds) {
  const now = Date.now() / 1000;
  const diff = now - utcSeconds;
  const years = Math.floor(diff / 31536000);
  const months = Math.floor((diff % 31536000) / 2592000);
  if (years > 0) return `${years}y ${months}m`;
  return `${months}mo`;
}

function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function setLoading(show, text = 'Fetching profile…') {
  const ov = document.getElementById('loading-overlay');
  document.getElementById('loader-text').textContent = text;
  ov.style.display = show ? 'flex' : 'none';
}

/* ===== KEY PRESS ===== */
document.getElementById('username-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') searchUser();
});

/* ===== SEARCH ===== */
async function searchUser() {
  const raw = document.getElementById('username-input').value.trim();
  if (!raw) { showToast('Please enter a username'); return; }

  // strip u/ prefix
  const username = raw.replace(/^u\//, '').replace(/^\/u\//, '');
  if (!username) { showToast('Invalid username'); return; }

  state.username = username;
  state.allPosts = [];
  state.allComments = [];
  state.redditPostAfter = null;
  state.pullpushPostAfter = null;
  state.redditCommentAfter = null;
  state.pullpushCommentAfter = null;
  state.currentTab = 'posts';
  state.loading = true;

  setLoading(true, `Looking up u/${username}…`);

  try {
    // Fetch profile via proxy
    let aboutData;
    try {
      aboutData = await redditFetch(`https://www.reddit.com/user/${username}/about.json`);
    } catch (e) {
      console.warn('User profile not found (might be deleted/suspended). Falling back to basic profile.');
    }

    if (!aboutData || !aboutData.data) {
      // Provide a generic fallback profile if the user is suspended or deleted
      aboutData = {
        data: {
          name: username,
          icon_img: '',
          created_utc: null,
          link_karma: 0,
          comment_karma: 0,
          is_gold: false,
          is_mod: false
        }
      };
    }

    renderProfile(aboutData.data);

    setLoading(true, 'Fetching posts & comments…');

    // Fetch posts and comments in parallel
    await Promise.all([
      loadPosts(username, true),
      loadComments(username, true),
    ]);

    // Switch to results section
    document.getElementById('results-section').style.display = 'block';
    document.getElementById('dashboard-row').style.display = 'flex';
    document.getElementById('local-filter-container').style.display = 'block';
    document.getElementById('local-filter').value = '';
    document.getElementById('results-section').scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Reset tab UI
    switchTab('posts');

  } catch (err) {
    console.error(err);
    showToast('Network error. Is Reddit accessible?');
  } finally {
    setLoading(false);
    state.loading = false;
  }
}

/* ===== FETCH POSTS ===== */
async function loadPosts(username, reset = false) {
  let redditUrl = `https://www.reddit.com/user/${username}/submitted.json?limit=${PAGE_SIZE}${state.redditPostAfter ? '&after=' + state.redditPostAfter : ''}`;
  let pullpushUrl = `https://api.pullpush.io/reddit/search/submission/?author=${username}&size=${PAGE_SIZE}&sort=desc`;
  if (state.pullpushPostAfter) {
    pullpushUrl += `&before=${state.pullpushPostAfter}`;
  }
  
  let newRedditItems = [];
  let newArchiveItems = [];

  try {
    const [redditRes, pullpushRes] = await Promise.allSettled([
      redditFetch(redditUrl),
      fetch(pullpushUrl).then(r => r.ok ? r.json() : {data:[]})
    ]);

    if (redditRes.status === 'fulfilled' && redditRes.value.data) {
      let rData = redditRes.value.data;
      
      // Fallback: If Reddit blocks the user profile API (returns 0 items)
      // we can often bypass this by using Reddit's Search API instead.
      if ((!rData.children || rData.children.length === 0) && !state.redditPostAfter) {
        try {
          const fallback = await redditFetch(`https://www.reddit.com/search.json?q=author:${username}&type=link&sort=new&limit=${PAGE_SIZE}`);
          if (fallback.data && fallback.data.children) rData = fallback.data;
        } catch (e) {}
      }

      state.redditPostAfter = rData.after || null;
      newRedditItems.push(...(rData.children || []).map(c => c.data));
    } else { state.redditPostAfter = null; }

    if (pullpushRes.status === 'fulfilled' && pullpushRes.value.data) {
      const pItems = pullpushRes.value.data || [];
      if (pItems.length > 0) state.pullpushPostAfter = pItems[pItems.length - 1].created_utc;
      else state.pullpushPostAfter = null;
      newArchiveItems.push(...pItems);
    } else { state.pullpushPostAfter = null; }

    // ULTIMATE FALLBACK: TrackTheirProfile API
    if (newRedditItems.length === 0 && newArchiveItems.length === 0 && !state.redditPostAfter && !state.pullpushPostAfter) {
      try {
        const ttpRes = await fetch(`/api/tracktheirprofile/${username}`);
        if (ttpRes.ok) {
          const ttpData = await ttpRes.json();
          if (ttpData.posts && ttpData.posts.length > 0) {
            newArchiveItems.push(...ttpData.posts);
          }
        }
      } catch(e) {}
    }

  } catch (e) {
    console.warn('Posts fetch error:', e);
  }

  // Deduplicate and tag hidden posts
  const map = new Map();
  if (!reset) state.allPosts.forEach(i => map.set(i.id, i));
  
  newRedditItems.forEach(i => {
    i._is_live = true;
    map.set(i.id, i);
  });
  
  newArchiveItems.forEach(i => {
    if (map.has(i.id)) {
      map.get(i.id)._is_live = true;
    } else {
      i._is_archive_only = true;
      map.set(i.id, i);
    }
  });

  state.allPosts = Array.from(map.values()).sort((a, b) => b.created_utc - a.created_utc);

  renderFeed('posts');
  document.getElementById('posts-count').textContent = state.allPosts.length + ((state.redditPostAfter || state.pullpushPostAfter) ? '+' : '');
}

/* ===== FETCH COMMENTS ===== */
async function loadComments(username, reset = false) {
  let redditUrl = `https://www.reddit.com/user/${username}/comments.json?limit=${PAGE_SIZE}${state.redditCommentAfter ? '&after=' + state.redditCommentAfter : ''}`;
  let pullpushUrl = `https://api.pullpush.io/reddit/search/comment/?author=${username}&size=${PAGE_SIZE}&sort=desc`;
  if (state.pullpushCommentAfter) {
    pullpushUrl += `&before=${state.pullpushCommentAfter}`;
  }
  
  let newRedditItems = [];
  let newArchiveItems = [];

  try {
    const [redditRes, pullpushRes] = await Promise.allSettled([
      redditFetch(redditUrl),
      fetch(pullpushUrl).then(r => r.ok ? r.json() : {data:[]})
    ]);

    if (redditRes.status === 'fulfilled' && redditRes.value.data) {
      let rData = redditRes.value.data;

      // Fallback to Search API for comments
      if ((!rData.children || rData.children.length === 0) && !state.redditCommentAfter) {
        try {
          const fallback = await redditFetch(`https://www.reddit.com/search.json?q=author:${username}&type=comment&sort=new&limit=${PAGE_SIZE}`);
          if (fallback.data && fallback.data.children) rData = fallback.data;
        } catch (e) {}
      }

      state.redditCommentAfter = rData.after || null;
      newRedditItems.push(...(rData.children || []).map(c => c.data));
    } else { state.redditCommentAfter = null; }

    if (pullpushRes.status === 'fulfilled' && pullpushRes.value.data) {
      const pItems = pullpushRes.value.data || [];
      if (pItems.length > 0) state.pullpushCommentAfter = pItems[pItems.length - 1].created_utc;
      else state.pullpushCommentAfter = null;
      newArchiveItems.push(...pItems);
    } else { state.pullpushCommentAfter = null; }

    // ULTIMATE FALLBACK: TrackTheirProfile API
    if (newRedditItems.length === 0 && newArchiveItems.length === 0 && !state.redditCommentAfter && !state.pullpushCommentAfter) {
      try {
        const ttpRes = await fetch(`/api/tracktheirprofile/${username}`);
        if (ttpRes.ok) {
          const ttpData = await ttpRes.json();
          if (ttpData.comments && ttpData.comments.length > 0) {
            // TrackTheirProfile returns comments without permalink sometimes, we can construct it or just use the thread link
            const mappedComments = ttpData.comments.map(c => ({
              ...c,
              permalink: c.permalink || c.link_permalink || `/r/${c.subreddit}/comments/`,
              link_title: c.link_title || ''
            }));
            newArchiveItems.push(...mappedComments);
          }
        }
      } catch(e) {}
    }

  } catch (e) {
    console.warn('Comments fetch error:', e);
  }

  // Deduplicate and tag hidden comments
  const map = new Map();
  if (!reset) state.allComments.forEach(i => map.set(i.id, i));
  
  newRedditItems.forEach(i => {
    i._is_live = true;
    map.set(i.id, i);
  });
  
  newArchiveItems.forEach(i => {
    if (map.has(i.id)) {
      map.get(i.id)._is_live = true;
    } else {
      i._is_archive_only = true;
      map.set(i.id, i);
    }
  });

  state.allComments = Array.from(map.values()).sort((a, b) => b.created_utc - a.created_utc);

  renderFeed('comments');
  document.getElementById('comments-count').textContent = state.allComments.length + ((state.redditCommentAfter || state.pullpushCommentAfter) ? '+' : '');
}

/* ===== RENDER PROFILE ===== */
function renderProfile(data) {
  const card = document.getElementById('profile-card');
  const avatar = data.icon_img
    ? `<img src="${escapeHtml(data.icon_img.split('?')[0])}" alt="avatar" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,0.1);" />`
    : `<div class="profile-avatar">👤</div>`;

  const joined = data.created_utc ? accountAge(data.created_utc) : 'Unknown';
  const postKarma = formatNum(data.link_karma || 0);
  const commentKarma = formatNum(data.comment_karma || 0);
  const totalKarma = formatNum((data.link_karma || 0) + (data.comment_karma || 0));
  const isGold = data.is_gold;
  const isMod = data.is_mod;

  card.innerHTML = `
    ${avatar}
    <div class="profile-info">
      <div class="profile-name">
        <a href="https://reddit.com/user/${escapeHtml(data.name)}" target="_blank" rel="noopener">u/${escapeHtml(data.name)}</a>
        ${isGold ? '<span class="verified-badge">⭐ Gold</span>' : ''}
        ${isMod ? '<span class="verified-badge" style="background:#ff6b35;color:#000;">🛡️ Mod</span>' : ''}
      </div>
      <div class="profile-meta">Account age: ${joined}</div>
      <div class="profile-stats">
        <div class="stat">
          <span class="stat-value green">${totalKarma}</span>
          <span class="stat-label">Total Karma</span>
        </div>
        <div class="stat">
          <span class="stat-value orange">${postKarma}</span>
          <span class="stat-label">Post Karma</span>
        </div>
        <div class="stat">
          <span class="stat-value blue">${commentKarma}</span>
          <span class="stat-label">Comment Karma</span>
        </div>
      </div>
    </div>
  `;
}

/* ===== RENDER FEED ===== */
function renderFeed(type) {
  const feed = document.getElementById(`${type}-feed`);
  const items = type === 'posts' ? state.allPosts : state.allComments;

  if (items.length === 0) {
    feed.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${type === 'posts' ? '📭' : '🤐'}</div>
        <h3>No ${type} found</h3>
        <p>This user hasn't made any ${type} recently.</p>
      </div>`;
    return;
  }

  feed.innerHTML = items.map((item, i) => renderItem(item, type, i)).join('');
  updateLoadMoreBtn();
  updateChart();
}

function renderItem(item, type, index) {
  const delay = Math.min(index * 0.04, 0.4);
  const sub = item.subreddit || '';
  const time = timeAgo(item.created_utc);
  const score = formatNum(item.score || 0);
  const link = `https://reddit.com${item.permalink}`;
  
  const isHidden = item._is_archive_only || item.author === '[deleted]' || item.removed_by_category;
  const hiddenBadge = isHidden ? `<span class="item-flair hidden-badge">👻 Hidden/Deleted</span>` : '';

  if (type === 'posts') {
    const numComments = formatNum(item.num_comments || 0);
    const title = escapeHtml(item.title || '');
    const selftext = item.selftext ? escapeHtml(item.selftext).substring(0, 240) : '';
    const flair = item.link_flair_text ? `<span class="item-flair">${escapeHtml(item.link_flair_text)}</span>` : '';
    const isImage = item.post_hint === 'image' || (item.url && /\.(jpg|jpeg|png|gif|webp)$/i.test(item.url));
    const isLink = !item.is_self && !isImage;

    return `
      <div class="feed-item" style="animation-delay:${delay}s" onclick="window.open('${link}','_blank')">
        <div class="item-header">
          <a class="item-sub" href="https://reddit.com/r/${escapeHtml(sub)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">r/${escapeHtml(sub)}</a>
          ${hiddenBadge}
          ${flair}
          ${isLink ? `<span class="item-flair" style="background:rgba(0,229,160,0.1);color:var(--accent);">🔗 Link</span>` : ''}
          ${isImage ? `<span class="item-flair" style="background:rgba(255,107,53,0.1);color:var(--orange);">🖼️ Image</span>` : ''}
          <span class="item-time">${time}</span>
        </div>
        <div class="item-title">${title}</div>
        ${selftext ? `<div class="item-body">${selftext}${item.selftext.length > 240 ? '…' : ''}</div>` : ''}
        <div class="item-footer">
          <span class="item-stat upvote">⬆ ${score}</span>
          <span class="item-stat comments">💬 ${numComments}</span>
          <button class="copy-btn" title="Copy Link" onclick="event.stopPropagation(); navigator.clipboard.writeText('${link}'); showToast('Link copied!');">📋</button>
          <a class="item-link-btn" href="${link}" target="_blank" rel="noopener" onclick="event.stopPropagation()">View →</a>
        </div>
      </div>`;
  } else {
    // Comment
    const body = item.body ? escapeHtml(item.body).substring(0, 320) : '';
    const context = item.link_title ? escapeHtml(item.link_title).substring(0, 80) : '';

    return `
      <div class="feed-item" style="animation-delay:${delay}s" onclick="window.open('${link}','_blank')">
        <div class="item-header">
          <a class="item-sub" href="https://reddit.com/r/${escapeHtml(sub)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">r/${escapeHtml(sub)}</a>
          ${hiddenBadge}
          <span class="item-time">${time}</span>
        </div>
        ${context ? `<div class="item-title" style="font-size:0.85rem;color:var(--text2);font-weight:500;margin-bottom:6px;">📌 ${context}${item.link_title && item.link_title.length > 80 ? '…' : ''}</div>` : ''}
        <div class="item-body">${body}${item.body && item.body.length > 320 ? '…' : ''}</div>
        <div class="item-footer">
          <span class="item-stat upvote">⬆ ${score}</span>
          <button class="copy-btn" title="Copy Link" onclick="event.stopPropagation(); navigator.clipboard.writeText('${link}'); showToast('Link copied!');">📋</button>
          <a class="item-link-btn" href="${link}" target="_blank" rel="noopener" onclick="event.stopPropagation()">View →</a>
        </div>
      </div>`;
  }
}

function escapeHtml(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ===== TABS ===== */
function switchTab(tab) {
  state.currentTab = tab;
  const postFeed = document.getElementById('posts-feed');
  const commentFeed = document.getElementById('comments-feed');
  const postBtn = document.getElementById('tab-posts');
  const commentBtn = document.getElementById('tab-comments');

  // Clear filter and reset visibility
  const filterInput = document.getElementById('local-filter');
  if (filterInput) filterInput.value = '';
  const allItems = document.querySelectorAll('.feed-item');
  allItems.forEach(item => item.style.display = 'block');

  if (tab === 'posts') {
    postFeed.style.display = 'flex';
    commentFeed.style.display = 'none';
    postBtn.classList.add('active');
    commentBtn.classList.remove('active');
  } else {
    postFeed.style.display = 'none';
    commentFeed.style.display = 'flex';
    postBtn.classList.remove('active');
    commentBtn.classList.add('active');
  }
  updateLoadMoreBtn();
}

/* ===== LOAD MORE ===== */
function updateLoadMoreBtn() {
  const row = document.getElementById('load-more-row');
  const hasMore = state.currentTab === 'posts' 
    ? (!!state.redditPostAfter || !!state.pullpushPostAfter) 
    : (!!state.redditCommentAfter || !!state.pullpushCommentAfter);
  row.style.display = hasMore ? 'flex' : 'none';
}

async function loadMore() {
  if (state.loading) return;
  state.loading = true;
  const btn = document.getElementById('load-more-btn');
  btn.textContent = 'Loading…';
  btn.disabled = true;

  try {
    if (state.currentTab === 'posts') {
      await loadPosts(state.username, false);
    } else {
      await loadComments(state.username, false);
    }
  } finally {
    state.loading = false;
    btn.textContent = 'Load More';
    btn.disabled = false;
  }
}

/* ===== NAVBAR SCROLL & GO TO TOP ===== */
window.addEventListener('scroll', () => {
  const nav = document.getElementById('navbar');
  const topBtn = document.getElementById('scroll-top-btn');
  if (window.scrollY > 20) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
  
  if (window.scrollY > 500) {
    topBtn.classList.add('show');
  } else {
    topBtn.classList.remove('show');
  }
});

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ===== THEME TOGGLE ===== */
function initTheme() {
  const savedTheme = localStorage.getItem('profilix_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('profilix_theme', next);
  updateThemeIcon(next);
  if (typeof updateChart === 'function' && document.getElementById('dashboard-row').style.display !== 'none') {
    updateChart();
  }
}

function updateThemeIcon(theme) {
  const icon = document.querySelector('.theme-icon');
  icon.textContent = theme === 'dark' ? '🌙' : '☀️';
}

initTheme();

/* ===== EXPORT CSV ===== */
function exportCSV() {
  const type = state.currentTab;
  const items = type === 'posts' ? state.allPosts : state.allComments;
  
  if (items.length === 0) {
    showToast('No data to export.');
    return;
  }

  let csvContent = '';
  
  if (type === 'posts') {
    csvContent = 'ID,Date,Subreddit,Title,Score,Comments,Link,Hidden\n';
    items.forEach(i => {
      const id = i.id || '';
      const date = new Date((i.created_utc || 0) * 1000).toISOString();
      const sub = i.subreddit || '';
      const title = `"${(i.title || '').replace(/"/g, '""')}"`;
      const score = i.score || 0;
      const comments = i.num_comments || 0;
      const link = `https://reddit.com${i.permalink || ''}`;
      const isHidden = (i._is_archive_only || i.author === '[deleted]' || i.removed_by_category) ? 'Yes' : 'No';
      csvContent += `${id},${date},${sub},${title},${score},${comments},${link},${isHidden}\n`;
    });
  } else {
    csvContent = 'ID,Date,Subreddit,Body,Score,Link,Hidden\n';
    items.forEach(i => {
      const id = i.id || '';
      const date = new Date((i.created_utc || 0) * 1000).toISOString();
      const sub = i.subreddit || '';
      const body = `"${(i.body || '').replace(/"/g, '""')}"`;
      const score = i.score || 0;
      const link = `https://reddit.com${i.permalink || ''}`;
      const isHidden = (i._is_archive_only || i.author === '[deleted]' || i.removed_by_category) ? 'Yes' : 'No';
      csvContent += `${id},${date},${sub},${body},${score},${link},${isHidden}\n`;
    });
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('href', url);
  a.setAttribute('download', `profilix_${state.username}_${type}.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ===== LOCAL FILTER ===== */
function filterFeed() {
  const query = document.getElementById('local-filter').value.toLowerCase();
  const type = state.currentTab;
  const feed = document.getElementById(`${type}-feed`);
  const items = Array.from(feed.getElementsByClassName('feed-item'));

  let visibleCount = 0;
  items.forEach(item => {
    const text = item.innerText.toLowerCase();
    if (text.includes(query)) {
      item.style.display = 'block';
      visibleCount++;
    } else {
      item.style.display = 'none';
    }
  });

  let emptyMsg = feed.querySelector('.filter-empty-msg');
  if (visibleCount === 0 && items.length > 0) {
    if (!emptyMsg) {
      emptyMsg = document.createElement('div');
      emptyMsg.className = 'filter-empty-msg';
      emptyMsg.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text3); font-weight: bold;">No matching items found. 👻</div>';
      feed.appendChild(emptyMsg);
    }
    emptyMsg.style.display = 'block';
  } else if (emptyMsg) {
    emptyMsg.style.display = 'none';
  }
}

/* ===== SORT FEED ===== */
function sortFeed() {
  const sortBy = document.getElementById('sort-select').value;
  const sortFn = (a, b) => {
    if (sortBy === 'new') return (b.created_utc || 0) - (a.created_utc || 0);
    if (sortBy === 'old') return (a.created_utc || 0) - (b.created_utc || 0);
    if (sortBy === 'top') return (b.score || 0) - (a.score || 0);
    return 0;
  };
  state.allPosts.sort(sortFn);
  state.allComments.sort(sortFn);
  
  // Re-render both feeds secretly, but we only visually see the active one
  renderFeed('posts');
  renderFeed('comments');
}

/* ===== DASHBOARD CHART ===== */
let chartInstance = null;
function updateChart() {
  const ctx = document.getElementById('subredditChart').getContext('2d');
  
  // Tally subreddits
  const tally = {};
  [...state.allPosts, ...state.allComments].forEach(item => {
    if (!item.subreddit) return;
    tally[item.subreddit] = (tally[item.subreddit] || 0) + 1;
  });

  const sortedSubs = Object.entries(tally).sort((a,b) => b[1] - a[1]).slice(0, 5);
  const labels = sortedSubs.map(s => 'r/' + s[0]);
  const data = sortedSubs.map(s => s[1]);

  if (chartInstance) {
    chartInstance.destroy();
  }

  // Get current theme color
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const textColor = isLight ? '#1a1525' : '#f0f0f5';

  const isMobile = window.innerWidth <= 768;

  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        label: 'Activity',
        data: data,
        backgroundColor: [
          '#ff2e93', // accent
          '#00e5ff', // cyan
          '#8c30f5', // violet
          '#ff4d6a', // red
          '#ffaa00'
        ],
        borderWidth: 0,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: isMobile ? 'bottom' : 'right',
          labels: { color: textColor, font: { family: 'Outfit', size: 14 } }
        },
        title: {
          display: true,
          text: 'Top Subreddits Activity',
          color: textColor,
          font: { family: 'Outfit', size: 16, weight: 'bold' },
          padding: { top: 10, bottom: 20 }
        }
      }
    }
  });
}

/* ===== MODALS ===== */
function openModal(id) {
  document.getElementById(id).classList.add('active');
  document.body.style.overflow = 'hidden'; // prevent background scroll
}

function closeModal(event, id) {
  if (event && event.target !== event.currentTarget && !event.target.classList.contains('close-btn')) {
    return; // Don't close if clicking inside the modal content
  }
  document.getElementById(id).classList.remove('active');
  document.body.style.overflow = '';
}


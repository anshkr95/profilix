const state = {
  username: '',
  allPosts: [],
  allComments: [],
  redditPostAfter: null,
  redditCommentAfter: null,
  searchPostAfter: null,
  pullpushCommentAfter: null,
  currentTab: 'posts',
  loading: false,
};

/* ===== REDDIT API via LOCAL PROXY ===== */
// Our Express server at /api/reddit/* proxies Reddit server-side,
// completely avoiding any browser CORS issues.
async function redditFetch(redditUrl) {
  // Try JSONP first: it natively bypasses CORS and utilizes the client's own IP
  // This avoids situations where the server/proxy IP is rate-limited or blocked.
  try {
    return await new Promise((resolve, reject) => {
      const cbName = 'reddit_cb_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      window[cbName] = (data) => {
        delete window[cbName];
        if (script.parentNode) script.parentNode.removeChild(script);
        resolve(data);
      };
      const script = document.createElement('script');
      script.src = redditUrl + (redditUrl.includes('?') ? '&' : '?') + 'jsonp=' + cbName;
      script.onerror = () => {
        delete window[cbName];
        if (script.parentNode) script.parentNode.removeChild(script);
        reject(new Error('JSONP failed'));
      };
      document.head.appendChild(script);
    });
  } catch (e) {
    console.warn("JSONP fetch failed, falling back to local proxy...", e);
  }

  // Fallback to our local proxy (bypasses WAF blocks via curl server-side)
  const urlObj = new URL(redditUrl);
  let pathname = urlObj.pathname.replace(/\.json$/, '');
  const localUrl = `/api/reddit${pathname}${urlObj.search}`;
  
  try {
    const res2 = await fetch(localUrl);
    if (res2.ok) {
      return await res2.json();
    }
  } catch (e) {
    console.warn("Local proxy fetch failed.", e);
  }

  throw new Error("Reddit fetch failed completely.");
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
  state.redditCommentAfter = null;
  state.searchPostAfter = null;
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
  if (reset) {
    state.redditPostAfter = null;
    state.searchPostAfter = null;
  }

  // 1. Fetch live profile posts
  let liveUrl = state.redditPostAfter === 'END' ? null : `https://www.reddit.com/user/${username}/submitted.json?limit=${PAGE_SIZE}${state.redditPostAfter ? '&after=' + state.redditPostAfter : ''}`;
  
  // 2. Fetch search API posts
  let searchUrl = state.searchPostAfter === 'END' ? null : `https://www.reddit.com/search.json?q=author:${username}&type=link&sort=new&limit=${PAGE_SIZE}${state.searchPostAfter ? '&after=' + state.searchPostAfter : ''}`;

  let liveItems = [];
  let searchItems = [];

  try {
    const promises = [];
    if (liveUrl) promises.push(redditFetch(liveUrl).then(res => ({ type: 'live', res })));
    if (searchUrl) promises.push(redditFetch(searchUrl).then(res => ({ type: 'search', res })));

    const results = await Promise.allSettled(promises);

    results.forEach(result => {
      if (result.status === 'fulfilled') {
        const { type, res } = result.value;
        if (res && res.data) {
          const items = (res.data.children || []).map(c => c.data);
          const after = res.data.after || 'END';
          if (type === 'live') {
            liveItems = items;
            state.redditPostAfter = after;
          } else {
            searchItems = items;
            state.searchPostAfter = after;
          }
        } else {
          if (type === 'live') state.redditPostAfter = 'END';
          if (type === 'search') state.searchPostAfter = 'END';
        }
      }
    });
  } catch (e) {
    console.warn('Posts fetch error:', e);
  }

  // Deduplicate and tag hidden posts
  const map = new Map();
  if (!reset) state.allPosts.forEach(i => map.set(i.id, i));
  
  // Archive/search items first (default to hidden)
  searchItems.forEach(i => {
    i._is_archive_only = true;
    map.set(i.id, i);
  });

  // Live items override archive tag
  liveItems.forEach(i => {
    i._is_live = true;
    i._is_archive_only = false;
    map.set(i.id, i);
  });

  state.allPosts = Array.from(map.values()).sort((a, b) => b.created_utc - a.created_utc);

  renderFeed('posts');
  document.getElementById('posts-count').textContent = state.allPosts.length;
}

/* ===== FETCH COMMENTS ===== */
async function loadComments(username, reset = false) {
  if (reset) {
    state.redditCommentAfter = null;
    state.pullpushCommentAfter = null;
  }

  // 1. Fetch live profile comments
  let liveUrl = state.redditCommentAfter === 'END' ? null : `https://www.reddit.com/user/${username}/comments.json?limit=${PAGE_SIZE}${state.redditCommentAfter ? '&after=' + state.redditCommentAfter : ''}`;
  
  // 2. Fetch pullpush comments via local proxy
  let ppUrl = state.pullpushCommentAfter === 'END' ? null : `/api/pullpush/reddit/comment/search?author=${username}&limit=${PAGE_SIZE}`;
  if (ppUrl && state.pullpushCommentAfter) {
    ppUrl += `&before=${state.pullpushCommentAfter}`;
  }

  let liveItems = [];
  let ppItems = [];

  try {
    const promises = [];
    if (liveUrl) promises.push(redditFetch(liveUrl).then(res => ({ type: 'live', res })));
    if (ppUrl) promises.push(fetch(ppUrl).then(res => res.json()).then(res => ({ type: 'pullpush', res })));

    const results = await Promise.allSettled(promises);

    results.forEach(result => {
      if (result.status === 'fulfilled') {
        const { type, res } = result.value;
        if (type === 'live') {
          if (res && res.data) {
            state.redditCommentAfter = res.data.after || 'END';
            liveItems = (res.data.children || []).map(c => c.data);
          } else {
            state.redditCommentAfter = 'END';
          }
        } else if (type === 'pullpush') {
          if (res && res.data && res.data.length > 0) {
            state.pullpushCommentAfter = res.data[res.data.length - 1].created_utc;
            ppItems = res.data.map(item => ({
              id: item.id,
              subreddit: item.subreddit,
              created_utc: item.created_utc,
              body: item.body,
              score: item.score,
              permalink: item.permalink || `/r/${item.subreddit}/comments/${item.link_id?.split('_')[1] || '0'}/_/${item.id}/`,
              link_title: item.link_title || ''
            }));
          } else {
            state.pullpushCommentAfter = 'END';
          }
        }
      }
    });

  } catch (e) {
    console.warn('Comments fetch error:', e);
  }

  // Deduplicate and tag hidden comments
  const map = new Map();
  if (!reset) state.allComments.forEach(i => map.set(i.id, i));
  
  // Archive items first
  ppItems.forEach(i => {
    i._is_archive_only = true;
    map.set(i.id, i);
  });

  // Live items override archive tag
  liveItems.forEach(i => {
    i._is_live = true;
    i._is_archive_only = false;
    map.set(i.id, i);
  });

  state.allComments = Array.from(map.values()).sort((a, b) => b.created_utc - a.created_utc);

  renderFeed('comments');
  document.getElementById('comments-count').textContent = state.allComments.length;
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
  const perm = item.permalink || '';
  const link = perm.startsWith('http') ? perm : `https://reddit.com${perm}`;
  
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
      <div class="feed-item" data-subreddit="${escapeHtml(sub).toLowerCase()}" style="animation-delay:${delay}s" onclick="window.open('${link}','_blank')">
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
      <div class="feed-item" data-subreddit="${escapeHtml(sub).toLowerCase()}" style="animation-delay:${delay}s" onclick="window.open('${link}','_blank')">
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

  // Re-apply filter instead of clearing it
  if (typeof filterFeed === 'function') {
    filterFeed();
  }
}

/* ===== LOAD MORE ===== */
function updateLoadMoreBtn() {
  const row = document.getElementById('load-more-row');
  const hasMore = state.currentTab === 'posts' 
    ? (state.redditPostAfter !== 'END' || state.searchPostAfter !== 'END')
    : (state.redditCommentAfter !== 'END' || state.pullpushCommentAfter !== 'END');
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
      const perm = i.permalink || '';
      const link = perm.startsWith('http') ? perm : `https://reddit.com${perm}`;
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
      const perm = i.permalink || '';
      const link = perm.startsWith('http') ? perm : `https://reddit.com${perm}`;
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
  if (!feed) return;
  const items = Array.from(feed.getElementsByClassName('feed-item'));

  const isExactSub = query.startsWith('r/');
  const targetSub = isExactSub ? query.substring(2).trim() : null;

  let visibleCount = 0;
  items.forEach(item => {
    let match = false;
    if (isExactSub) {
      match = item.getAttribute('data-subreddit') === targetSub;
    } else {
      const text = item.innerText.toLowerCase();
      match = text.includes(query);
    }
    
    if (match) {
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
      onClick: (e, elements) => {
        if (elements && elements.length > 0) {
          const index = elements[0].index;
          const subLabel = chartInstance.data.labels[index];
          const filterInput = document.getElementById('local-filter');
          if (filterInput.value.toLowerCase() === subLabel.toLowerCase()) {
            filterInput.value = ''; // Toggle off
          } else {
            filterInput.value = subLabel;
          }
          filterFeed();
          document.getElementById('results-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      },
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


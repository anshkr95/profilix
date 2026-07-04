const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const { execFile } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files (our HTML/CSS/JS)
app.use(express.static(path.join(__dirname)));

// Stub for KV store ping to avoid 404s
app.post('/api/reddit/user/:username/kv-store', (req, res) => res.json({}));
app.get('/api/reddit/user/:username/kv-store', (req, res) => res.json({}));

// Proxy for Reddit videos (avoid CORS issues with HLS/MP4)
app.get('/api/reddit/video-proxy', async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) return res.status(400).send('Missing url');
  try {
    const response = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Content-Type', response.headers.get('content-type') || 'video/mp4');
    response.body.pipe(res);
  } catch (err) {
    res.status(500).send('Proxy error');
  }
});



// Reddit API proxy — avoids CORS entirely since this runs server-side
app.get('/api/reddit/*', async (req, res) => {
  const redditPath = req.params[0];
  const query = req.url.split('?')[1] ? '?' + req.url.split('?')[1] : '';

  // Try old.reddit.com first (less aggressively blocked), then www.reddit.com
  const urls = [
    `https://old.reddit.com/${redditPath}${redditPath.endsWith('.json') ? '' : '.json'}${query}`,
    `https://www.reddit.com/${redditPath}${redditPath.endsWith('.json') ? '' : '.json'}${query}`,
  ];

  const curlCommand = process.platform === 'win32' ? 'curl.exe' : 'curl';

  // Rotate user agents to reduce fingerprinting
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  ];
  const userAgent = agents[Math.floor(Math.random() * agents.length)];

  const tryFetch = (url) => new Promise((resolve, reject) => {
    const args = [
      '-s', '-L',
      '-A', userAgent,
      '-H', 'Accept: application/json, text/javascript, */*',
      '-H', 'Accept-Language: en-US,en;q=0.9',
      '-H', 'Accept-Encoding: gzip, deflate, br',
      '-H', 'Cache-Control: no-cache',
      '-H', 'Pragma: no-cache',
      '-H', 'Sec-Fetch-Dest: empty',
      '-H', 'Sec-Fetch-Mode: cors',
      '-H', 'Sec-Fetch-Site: same-origin',
      '--compressed',
      '--max-time', '15',
      url
    ];
    execFile(curlCommand, args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
      if (error) return reject(error);
      // Check if Reddit returned an HTML block page instead of JSON
      const trimmed = stdout.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        return reject(new Error('Reddit returned non-JSON (likely block page)'));
      }
      try {
        resolve(JSON.parse(trimmed));
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
  });

  for (const url of urls) {
    try {
      const data = await tryFetch(url);
      return res.json(data);
    } catch (err) {
      console.warn('Reddit proxy attempt failed for', url, ':', err.message);
    }
  }

  res.status(503).json({ error: 'Reddit blocked server-side requests. JSONP should still work from browser.' });
});


// Proxy for Pullpush API to avoid browser CORS/adblocker issues
app.get('/api/pullpush/*', async (req, res) => {
  const pullpushPath = req.params[0];
  const query = req.url.split('?')[1] ? '?' + req.url.split('?')[1] : '';
  const ppUrl = `https://api.pullpush.io/${pullpushPath}${query}`;

  const curlCommand = process.platform === 'win32' ? 'curl.exe' : 'curl';
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  execFile(curlCommand, ['-s', '-A', userAgent, '-H', 'Accept: application/json', '-H', 'Accept-Language: en-US,en;q=0.9', ppUrl], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) {
      console.error('Pullpush Curl error:', error.message);
      return res.status(500).json({ error: 'Curl error' });
    }
    try {
      const data = JSON.parse(stdout);
      res.json(data);
    } catch (parseErr) {
      res.status(500).json({ error: 'Invalid JSON from Pullpush' });
    }
  });
});

// Proxy for Arctic Shift API to avoid browser CORS/adblocker issues
app.get('/api/arctic-shift/*', async (req, res) => {
  const asPath = req.params[0];
  const query = req.url.split('?')[1] ? '?' + req.url.split('?')[1] : '';
  const asUrl = `https://arctic-shift.photon-reddit.com/api/${asPath}${query}`;

  const curlCommand = process.platform === 'win32' ? 'curl.exe' : 'curl';
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  execFile(curlCommand, ['-s', '-A', userAgent, '-H', 'Accept: application/json', '-H', 'Accept-Language: en-US,en;q=0.9', asUrl], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) {
      console.error('Arctic Shift Curl error:', error.message);
      return res.status(500).json({ error: 'Curl error' });
    }
    try {
      const data = JSON.parse(stdout);
      res.json(data);
    } catch (parseErr) {
      res.status(500).json({ error: 'Invalid JSON from Arctic Shift' });
    }
  });
});


app.listen(PORT, () => {
  console.log(`\nProfilix running at http://localhost:${PORT}\n`);
});

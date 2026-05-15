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
  // Strip /api/reddit prefix to get the actual Reddit path
  const redditPath = req.params[0];
  const query = req.url.split('?')[1] ? '?' + req.url.split('?')[1] : '';
  const redditUrl = `https://www.reddit.com/${redditPath}${redditPath.endsWith('.json') ? '' : '.json'}${query}`;

  try {
    // We use curl instead of node-fetch to bypass Reddit's strict TLS fingerprinting
    const curlCommand = process.platform === 'win32' ? 'curl.exe' : 'curl';
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    
    execFile(curlCommand, ['-s', '-A', userAgent, '-H', 'Accept: application/json', '-H', 'Accept-Language: en-US,en;q=0.9', redditUrl], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error('Curl exec error:', error.message);
        return res.status(500).json({ error: 'Curl error' });
      }
      try {
        const data = JSON.parse(stdout);
        res.json(data);
      } catch (parseErr) {
        // Fallback for when Reddit sends a string or HTML instead of JSON
        res.status(500).json({ error: 'Invalid JSON from Reddit', fallback: true });
      }
    });

  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(500).json({ error: err.message, fallback: true });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Profilix running at http://localhost:${PORT}\n`);
});

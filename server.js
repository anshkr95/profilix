const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files (our HTML/CSS/JS)
app.use(express.static(path.join(__dirname)));

// Reddit API proxy — avoids CORS entirely since this runs server-side
app.get('/api/reddit/*', async (req, res) => {
  // Strip /api/reddit prefix to get the actual Reddit path
  const redditPath = req.params[0];
  const query = req.url.split('?')[1] ? '?' + req.url.split('?')[1] : '';

  const redditUrl = `https://www.reddit.com/${redditPath}.json${query}`;

  const { execFile } = require('child_process');

  try {
    // We use curl instead of node-fetch to bypass Reddit's strict TLS fingerprinting
    // which blocks Node.js HTTP requests with a 403 Forbidden.
    const curlCommand = process.platform === 'win32' ? 'curl.exe' : 'curl';
    execFile(curlCommand, ['-s', '-A', 'Profilix/2.0', redditUrl], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error('Curl exec error:', error.message);
        return res.status(500).json({ error: 'Curl error' });
      }
      try {
        const data = JSON.parse(stdout);
        res.json(data);
      } catch (parseErr) {
        res.status(500).json({ error: 'Invalid JSON from Reddit' });
      }
    });

  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// TrackTheirProfile API proxy (Ultimate fallback)
app.get('/api/tracktheirprofile/:username', async (req, res) => {
  const username = req.params.username;
  try {
    const response = await fetch(`https://tracktheirprofile.com/api/search?username=${encodeURIComponent(username)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json',
      },
      timeout: 10000,
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: `TTP API error: ${response.status}` });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Profilix running at http://localhost:${PORT}\n`);
});

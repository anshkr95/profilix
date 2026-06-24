import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';

const agents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const redditPath = params.path.join('/');
  const { searchParams } = new URL(req.url);
  const query = searchParams.toString() ? `?${searchParams.toString()}` : '';

  const urls = [
    `https://old.reddit.com/${redditPath}${redditPath.endsWith('.json') ? '' : '.json'}${query}`,
    `https://www.reddit.com/${redditPath}${redditPath.endsWith('.json') ? '' : '.json'}${query}`,
  ];

  const curlCommand = process.platform === 'win32' ? 'curl.exe' : 'curl';
  const userAgent = agents[Math.floor(Math.random() * agents.length)];

  const tryFetch = (url: string) => new Promise<unknown>((resolve, reject) => {
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
      const trimmed = stdout.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        return reject(new Error('Reddit returned non-JSON (likely block page)'));
      }
      try {
        resolve(JSON.parse(trimmed));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
  });

  for (const url of urls) {
    try {
      const data = await tryFetch(url);
      return NextResponse.json(data);
    } catch (err) {
      console.warn('Reddit proxy attempt failed for', url, ':', (err as Error).message);
    }
  }

  return NextResponse.json(
    { error: 'Reddit blocked server-side requests. JSONP should still work from browser.' },
    { status: 503 }
  );
}

export async function POST() {
    return NextResponse.json({});
}

import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const pullpushPath = params.path.join('/');
  const { searchParams } = new URL(req.url);
  const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const ppUrl = `https://api.pullpush.io/${pullpushPath}${query}`;

  const curlCommand = process.platform === 'win32' ? 'curl.exe' : 'curl';
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  return new Promise<NextResponse>((resolve) => {
    execFile(curlCommand, ['-s', '-A', userAgent, '-H', 'Accept: application/json', '-H', 'Accept-Language: en-US,en;q=0.9', ppUrl], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
      if (error) {
        console.error('Pullpush Curl error:', error.message);
        return resolve(NextResponse.json({ error: 'Curl error' }, { status: 500 }));
      }
      try {
        const data = JSON.parse(stdout);
        resolve(NextResponse.json(data));
      } catch {
        resolve(NextResponse.json({ error: 'Invalid JSON from Pullpush' }, { status: 500 }));
      }
    });
  });
}

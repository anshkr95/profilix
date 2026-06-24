import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoUrl = searchParams.get('url');

  if (!videoUrl) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  try {
    const response = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.statusText}`);
    }

    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Content-Type', response.headers.get('content-type') || 'video/mp4');

    return new NextResponse(response.body, {
      status: 200,
      headers
    });
  } catch (err) {
    console.error('Video proxy error:', err);
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 });
  }
}

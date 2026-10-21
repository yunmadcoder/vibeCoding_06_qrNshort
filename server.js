const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = 3000;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // 1. URL 단축 프록시 엔드포인트 (/api/shorten?url=...)
  //    서버가 대신 OpenAPI를 호출하므로 브라우저 CORS 차단 환경에서도 항상 동작한다.
  //    is.gd → v.gd → TinyURL 순서로 시도 (is.gd/v.gd는 중간 광고 페이지가 없음)
  if (pathname === '/api/shorten') {
    let targetUrl = parsedUrl.searchParams.get('url');
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'URL query parameter is required' }));
      return;
    }
    // 한글 등 비ASCII 문자가 포함된 URL을 표준 퍼센트 인코딩으로 정규화 (da.gd 호환)
    try { targetUrl = new URL(targetUrl).href; } catch (e) { /* 원본 그대로 사용 */ }

    const respond = (obj, status = 200) => {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(obj));
    };

    (async () => {
      // 1차: da.gd
      try {
        const r = await fetch(`https://da.gd/shorten?url=${encodeURIComponent(targetUrl)}`);
        if (r.ok) {
          const shortUrl = (await r.text()).trim();
          if (shortUrl.startsWith('http')) {
            return respond({ shortUrl, original: targetUrl, service: 'da.gd' });
          }
        }
      } catch (e) {
        console.warn('[proxy] da.gd failed:', e.message);
      }

      // 2차: is.gd
      try {
        const r = await fetch(`https://is.gd/create.php?format=json&url=${encodeURIComponent(targetUrl)}`);
        if (r.ok) {
          const data = await r.json();
          if (data && data.shorturl) {
            return respond({ shortUrl: data.shorturl, original: targetUrl, service: 'is.gd' });
          }
        }
      } catch (e) {
        console.warn('[proxy] is.gd failed:', e.message);
      }

      // 2차: v.gd
      try {
        const r = await fetch(`https://v.gd/create.php?format=json&url=${encodeURIComponent(targetUrl)}`);
        if (r.ok) {
          const data = await r.json();
          if (data && data.shorturl) {
            return respond({ shortUrl: data.shorturl, original: targetUrl, service: 'v.gd' });
          }
        }
      } catch (e) {
        console.warn('[proxy] v.gd failed:', e.message);
      }

      // 3차: TinyURL
      try {
        const r = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(targetUrl)}`);
        if (r.ok) {
          const shortUrl = (await r.text()).trim();
          if (shortUrl.startsWith('http')) {
            return respond({ shortUrl, original: targetUrl, service: 'TinyURL' });
          }
        }
      } catch (e) {
        console.warn('[proxy] TinyURL failed:', e.message);
      }

      respond({ error: '모든 단축 API 호출에 실패했습니다' }, 502);
    })();
    return;
  }

  // 2. 정적 파일 서비스
  let safePath = decodeURIComponent(pathname);
  if (safePath === '/') {
    safePath = '/index.html';
  }

  let filePath = path.join(__dirname, safePath);

  // 디렉토리인 경우 index.html 자동 탐색
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('500 Server Error');
      return;
    }
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`=======================================================`);
  console.log(` Link & QR Studio Local Server Started!`);
  console.log(` Portal URL : http://localhost:${PORT}/`);
  console.log(` QR Code    : http://localhost:${PORT}/url2qr/index.html`);
  console.log(` URL Short  : http://localhost:${PORT}/urlShort/index.html`);
  console.log(`=======================================================`);
});

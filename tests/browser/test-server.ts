// Simple test server for Playwright browser tests
const projectRoot = new URL('../..', import.meta.url).pathname;

const server = Bun.serve({
  port: 3456,
  async fetch(req) {
    const url = new URL(req.url);
    let filePath: string;

    if (url.pathname === '/') {
      filePath = `${projectRoot}/tests/browser/index.html`;
    } else if (url.pathname.startsWith('/dist/')) {
      filePath = `${projectRoot}${url.pathname}`;
    } else {
      return new Response('Not found', { status: 404 });
    }

    const file = Bun.file(filePath);
    if (await file.exists()) {
      const contentType = filePath.endsWith('.js')
        ? 'application/javascript'
        : filePath.endsWith('.html')
          ? 'text/html'
          : 'text/plain';
      return new Response(file, {
        headers: { 'Content-Type': contentType },
      });
    }
    return new Response('Not found', { status: 404 });
  },
});

console.log(`Test server running at http://localhost:${server.port}`);

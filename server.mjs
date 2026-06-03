import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

const root = process.cwd();
const rootPath = resolve(root);
const port = 4173;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
};

http
  .createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
    const cleanPath = decodeURIComponent(url.pathname === "/" ? "index.html" : url.pathname.slice(1));
    const filePath = resolve(rootPath, cleanPath);

    if (!filePath.startsWith(rootPath)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    try {
      const body = await readFile(filePath);
      response.writeHead(200, { "Content-Type": types[extname(filePath)] ?? "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`Prototype running at http://127.0.0.1:${port}`);
  });

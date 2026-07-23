// Zero-dependency static server for the built SPA (replaces nginx).
// Dokploy/Traefik routes "/" → this container and "/api" → the backend,
// so no proxying happens here.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const ROOT = new URL("./dist", import.meta.url).pathname;
const PORT = Number(process.env.PORT || 3000);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

function send(res, status, filePath) {
  const ext = extname(filePath).toLowerCase();
  res.writeHead(status, {
    "Content-Type": MIME[ext] ?? "application/octet-stream",
    // Hashed assets are immutable; everything else revalidates.
    "Cache-Control": filePath.includes(`${sep}assets${sep}`) || filePath.includes("/assets/")
      ? "public, max-age=31536000, immutable"
      : "no-cache",
  });
  createReadStream(filePath).pipe(res);
}

const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url || "/").split("?")[0]);
  const safePath = normalize(url).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(ROOT, safePath);

  if (existsSync(filePath) && statSync(filePath).isFile()) {
    return send(res, 200, filePath);
  }
  // SPA fallback: unknown non-file paths render the app shell.
  return send(res, 200, join(ROOT, "index.html"));
});

const sep = process.platform === "win32" ? "\\" : "/";

server.listen(PORT, () => {
  console.log(`DocumentOS web listening on :${PORT}`);
});

import http from "http";
import fs from "fs";
import path from "path";

const FIXTURES_DIR = path.resolve(__dirname, "../../fixtures");

export function startFixtureServer(): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = req.url === "/" ? "/test-page.html" : req.url!;
      const filePath = path.join(FIXTURES_DIR, url);

      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const ext = path.extname(filePath);
        const contentType =
          ext === ".css" ? "text/css" : ext === ".js" ? "text/javascript" : "text/html";
        res.writeHead(200, { "Content-Type": contentType });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    // Port 0 = OS picks a random available port
    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ server, port });
    });
  });
}

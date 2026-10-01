const http = require("http");
const fs = require("fs");
const path = require("path");

const HOST = "127.0.0.1";
const PORT = 3000;
const ROOT = __dirname;
const STORAGE_DIR = path.join(ROOT, "storage");

fs.mkdirSync(STORAGE_DIR, { recursive: true });

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify(payload));
}

function safeName(name) {
  if (typeof name !== "string") return false;
  const value = name.trim();
  if (!value || value === "." || value === "..") return false;
  if (value.includes("/") || value.includes("\\") || value.includes("\0")) return false;
  return true;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10000) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON."));
      }
    });

    req.on("error", reject);
  });
}

function listStorage() {
  return fs.readdirSync(STORAGE_DIR, { withFileTypes: true })
    .map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? "folder" : "file"
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    return res.end();
  }

  if (url.pathname === "/api/items" && req.method === "GET") {
    return sendJson(res, 200, { items: listStorage() });
  }

  if (url.pathname === "/api/items" && req.method === "POST") {
    try {
      const body = await readJson(req);
      const type = body.type;
      const name = typeof body.name === "string" ? body.name.trim() : "";

      if (!["file", "folder"].includes(type)) {
        return sendJson(res, 400, { error: "Invalid item type." });
      }

      if (!safeName(name)) {
        return sendJson(res, 400, {
          error: "Invalid name. Use a simple file or folder name without / or \\."
        });
      }

      const target = path.join(STORAGE_DIR, name);

      if (fs.existsSync(target)) {
        return sendJson(res, 409, { error: "A file or folder with that name already exists." });
      }

      if (type === "folder") {
        fs.mkdirSync(target);
      } else {
        fs.writeFileSync(target, "");
      }

      return sendJson(res, 201, {
        message: `Created ${type} in storage.`,
        item: { name, type }
      });
    } catch (error) {
      return sendJson(res, 500, {
        error: error.message || "Could not create item."
      });
    }
  }

  let requestPath = decodeURIComponent(url.pathname);
  if (requestPath === "/") requestPath = "/index.html";

  const filePath = path.resolve(ROOT, "." + requestPath);
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== path.join(ROOT, "index.html")) {
    return sendJson(res, 403, { error: "Forbidden." });
  }

  try {
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) throw new Error("Not a file.");

    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream"
    });
    fs.createReadStream(filePath).pipe(res);
  } catch {
    sendJson(res, 404, { error: "Not found." });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`mOS backend running at http://${HOST}:${PORT}`);
  console.log(`Storage directory: ${STORAGE_DIR}`);
});

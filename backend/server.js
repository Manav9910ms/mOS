const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const HOST = "127.0.0.1";
const PORT = 3000;
const ROOT = path.resolve(__dirname);
const STORAGE = path.resolve(ROOT, "..", "storage");

fs.mkdirSync(STORAGE, { recursive: true });

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(body);
}

function safeStoragePath(name) {
  if (typeof name !== "string") {
    throw new Error("Invalid name.");
  }

  const trimmed = name.trim();

  if (!trimmed) {
    throw new Error("Name cannot be empty.");
  }

  if (trimmed === "." || trimmed === ".." || /[\\/]/.test(trimmed)) {
    throw new Error("Only a single file or folder name is allowed.");
  }

  const target = path.resolve(STORAGE, trimmed);

  if (!target.startsWith(STORAGE + path.sep)) {
    throw new Error("Invalid storage path.");
  }

  return target;
}

function listStorage() {
  return fs.readdirSync(STORAGE, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? "folder" : "file"
    }));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;

      if (body.length > 10000) {
        reject(new Error("Request body is too large."));
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

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    return res.end();
  }

  if (parsed.pathname === "/api/storage" && req.method === "GET") {
    return sendJson(res, 200, { items: listStorage() });
  }

  if (parsed.pathname === "/api/storage/create" && req.method === "POST") {
    try {
      const body = await readRequestBody(req);
      const type = body.type;
      const target = safeStoragePath(body.name);

      if (type !== "file" && type !== "folder") {
        return sendJson(res, 400, { error: "Type must be file or folder." });
      }

      if (fs.existsSync(target)) {
        return sendJson(res, 409, { error: "A file or folder with that name already exists." });
      }

      if (type === "folder") {
        fs.mkdirSync(target);
      } else {
        fs.writeFileSync(target, "", "utf8");
      }

      return sendJson(res, 201, {
        item: {
          name: path.basename(target),
          type
        }
      });
    } catch (error) {
      return sendJson(res, 400, {
        error: error.message || "Could not create the item."
      });
    }
  }

  res.writeHead(404, {
    "Content-Type": "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });
  res.end("mOS backend route not found.");
});

server.listen(PORT, HOST, () => {
  console.log(`mOS backend running at http://${HOST}:${PORT}`);
  console.log(`mOS storage: ${STORAGE}`);
});

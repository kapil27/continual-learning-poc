import { createServer } from "node:http";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { homedir } from "node:os";

const KEY_FILE = join(homedir(), ".teach-me-api-key");
function loadApiKey() {
  try { return readFileSync(KEY_FILE, "utf-8").trim(); }
  catch { return process.env.CURSOR_API_KEY; }
}

const apiKey = loadApiKey();
if (!apiKey) {
  console.error("Missing API key. Please run: echo 'crsr_YOUR_KEY' > ~/.teach-me-api-key");
  process.exit(1);
}

// Recursively load markdown files for context
function loadContext(dir) {
  let context = "";
  try {
    for (const file of readdirSync(dir)) {
      const fullPath = join(dir, file);
      if (file === "node_modules" || file.startsWith(".")) continue;
      if (statSync(fullPath).isDirectory()) {
        context += loadContext(fullPath);
      } else if (extname(file) === ".md") {
        context += `\n--- ${file} ---\n` + readFileSync(fullPath, "utf-8");
      }
    }
  } catch (e) {
    // ignore dir read errors
  }
  return context;
}

const contextText = loadContext(process.cwd()).substring(0, 12000);
console.log(`Loaded ${contextText.length} chars of markdown context.`);

let busy = false;

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Serve static files for the UI
  if (req.method === "GET" && req.url === "/") {
    try {
      const content = readFileSync(join(process.cwd(), "index.html"));
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(content);
    } catch (e) {
      res.writeHead(404);
      res.end("index.html not found");
    }
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/pages/")) {
    const pagePath = join(process.cwd(), req.url);
    try {
      const content = readFileSync(pagePath);
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(content);
    } catch (e) {
      res.writeHead(404);
      res.end("Page not found");
    }
    return;
  }

  if (req.method === "GET" && req.url.startsWith("/shared/")) {
    const assetPath = join(process.cwd(), req.url);
    try {
      const type = req.url.endsWith(".css") ? "text/css" : "application/javascript";
      const content = readFileSync(assetPath);
      res.writeHead(200, { "Content-Type": type });
      res.end(content);
    } catch (e) {
      res.writeHead(404);
      res.end("Asset not found");
    }
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", busy }));
    return;
  }

  if (req.method === "POST" && req.url === "/ask") {
    if (busy) {
      res.writeHead(429, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "busy", answer: "Still thinking..." }));
      return;
    }

    let body = "";
    req.on("data", chunk => body += chunk.toString());
    req.on("end", async () => {
      try {
        busy = true;
        const { question, context: pageContext } = JSON.parse(body);
        
        let Agent;
        try {
          const sdk = await import("@cursor/sdk");
          Agent = sdk.Agent;
        } catch (e) {
          throw new Error("Missing @cursor/sdk. Run: npm install -g @cursor/sdk");
        }

        const prompt = `Answer in 2-3 short sentences. Very simple language. No jargon. No markdown.\n\nCurrent page context: ${pageContext || "None"}\n\nGlobal context: ${contextText}\n\nUser Question: ${question}`;

        const result = await Agent.prompt(prompt, {
          apiKey,
          model: { id: "composer-2" },
          local: { cwd: process.cwd() }
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ answer: result.result || result.text || JSON.stringify(result) }));
      } catch (err) {
        console.error(err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message, answer: `Error: ${err.message}` }));
      } finally {
        busy = false;
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(3847, () => {
  console.log("AI assistant running at http://localhost:3847");
});
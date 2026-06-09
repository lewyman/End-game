import { Hono } from "hono";
import { handle } from "hono/vercel";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import authRoutes from "../server/routes/auth";
import accountRoutes from "../server/routes/account";
import adminRoutes from "../server/routes/admin";
import billingRoutes from "../server/routes/billing";
import blogRoutes from "../server/routes/blog";
import clinicalRoutes from "../server/routes/clinical";
import communityRoutes from "../server/routes/community";
import conversationsRoutes from "../server/routes/conversations";
import drugsRoutes from "../server/routes/drugs";
import educatorRoutes from "../server/routes/educator";
import filesRoutes from "../server/routes/files";
import knowledgeWebRoutes from "../server/routes/knowledge-web";
import nclexRoutes from "../server/routes/nclex";
import pathwaysRoutes from "../server/routes/pathways";
import proceduresRoutes from "../server/routes/procedures";
import sitemapRoutes from "../server/routes/sitemap";

const app = new Hono();

app.route("/", authRoutes);
app.route("/", accountRoutes);
app.route("/", adminRoutes);
app.route("/", billingRoutes);
app.route("/", blogRoutes);
app.route("/", clinicalRoutes);
app.route("/", communityRoutes);
app.route("/", conversationsRoutes);
app.route("/", drugsRoutes);
app.route("/", educatorRoutes);
app.route("/", filesRoutes);
app.route("/", knowledgeWebRoutes);
app.route("/", nclexRoutes);
app.route("/", pathwaysRoutes);
app.route("/", proceduresRoutes);
app.route("/", sitemapRoutes);

app.get("/api/hello-zo", (c) => c.json({ msg: "Hello from Zo" }));
app.get("/api/status", (c) => c.json({ ok: true, ts: new Date().toISOString() }));

const mimeTypes: Record<string, string> = {
  ".html": "text/html", ".js": "application/javascript",
  ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg",
  ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".woff": "font/woff",
};

app.get("/favicon.ico", (c) => c.redirect("/favicon.png", 302));

// SPA fallback — serve static files from dist/, else index.html
app.get("/*", async (c) => {
  const filePath = c.req.path === "/" ? "/index.html" : c.req.path;
  const fullPath = join(process.cwd(), "dist", filePath);
  try {
    const content = await readFile(fullPath);
    const ext = extname(fullPath).toLowerCase();
    return new Response(content, {
      headers: { "Content-Type": mimeTypes[ext] || "application/octet-stream" },
    });
  } catch {
    try {
      const html = await readFile(join(process.cwd(), "dist", "index.html"));
      return new Response(html, {
        headers: { "Content-Type": "text/html" },
      });
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  }
});

export default handle(app);
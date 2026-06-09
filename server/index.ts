import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import type { ViteDevServer } from "vite";
import { createServer as createViteServer } from "vite";
import config from "../zosite.json";
import { getPageMeta } from "./lib/blog-engine";

import authRoutes from "./routes/auth";
import accountRoutes from "./routes/account";
import adminRoutes from "./routes/admin";
import billingRoutes from "./routes/billing";
import blogRoutes from "./routes/blog";
import clinicalRoutes from "./routes/clinical";
import communityRoutes from "./routes/community";
import conversationsRoutes from "./routes/conversations";
import drugsRoutes from "./routes/drugs";
import educatorRoutes from "./routes/educator";
import filesRoutes from "./routes/files";
import knowledgeWebRoutes from "./routes/knowledge-web";
import nclexRoutes from "./routes/nclex";
import pathwaysRoutes from "./routes/pathways";
import proceduresRoutes from "./routes/procedures";
import sitemapRoutes from "./routes/sitemap";

const app = new Hono();
const mode = process.env.NODE_ENV === "production" ? "production" : "development";

// Mount all route modules
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

// Proxy /api/* to bio-api backend on port 3131
app.all("/api/:path*", async (c) => {
  const p = c.req.path.replace("/api/", "");
  const apiHost = process.env.BIO_API_URL || "http://127.0.0.1:3131";
  try {
    const url = `${apiHost}/${p}${c.req.url.includes("?") ? "?" + c.req.url.split("?")[1] : ""}`;
    const headers: Record<string, string> = {};
    c.req.raw.headers.forEach((v, k) => { headers[k] = v; });
    const body = c.req.method !== "GET" && c.req.method !== "HEAD" ? await c.req.blob() : undefined;
    const resp = await fetch(url, { method: c.req.method, headers, body, redirect: "manual" });
    const contentType = resp.headers.get("content-type") || "";
    const data = contentType.includes("json") ? await resp.json() : await resp.text();
    return c.json(data, resp.status);
  } catch {
    return c.json({ error: "API unavailable" }, 502);
  }
});

if (mode === "production") {
  configureProduction(app);
} else {
  await configureDevelopment(app);
}

const port = process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : mode === "production"
    ? (config.publish?.published_port ?? config.local_port)
    : config.local_port;

export default { fetch: app.fetch, port, idleTimeout: 255 };

function configureProduction(app: Hono) {
  app.use("/assets/*", serveStatic({ root: "./dist" }));
  app.get("/favicon.ico", (c) => c.redirect("/favicon.png", 302));

  app.use(async (c, next) => {
    if (c.req.method !== "GET") return next();
    const p = c.req.path;
    if (p.startsWith("/api/") || p.startsWith("/assets/")) return next();

    // SSR blog routes
    if (p === "/blog" || p.startsWith("/blog/")) return next();

    const file = Bun.file(`./dist${p}`);
    if (await file.exists()) {
      const stat = await file.stat();
      if (stat && !stat.isDirectory()) {
        const contentType = p.endsWith(".js") ? "application/javascript"
          : p.endsWith(".css") ? "text/css"
          : p.endsWith(".png") ? "image/png"
          : p.endsWith(".svg") ? "image/svg+xml"
          : undefined;
        return new Response(file, contentType ? { headers: { "Content-Type": contentType } } : {});
      }
    }

    const meta = await getPageMeta(p);
    let html = await Bun.file("./dist/index.html").text();

    html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${meta.title}</title>`);
    html = html.replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${meta.description}"`);
    html = html.replace(/<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${meta.ogTitle}"`);
    html = html.replace(/<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${meta.ogDescription}"`);
    html = html.replace(/<meta name="twitter:title" content="[^"]*"/, `<meta name="twitter:title" content="${meta.ogTitle}"`);
    html = html.replace(/<meta name="twitter:description" content="[^"]*"/, `<meta name="twitter:description" content="${meta.ogDescription}"`);
    html = html.replace(/<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="https://academy.endgameenhancements.com${p}"`);
    html = html.replace(/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="https://academy.endgameenhancements.com${p}"`);

    if (p.startsWith("/blog/") && p !== "/blog") {
      const slug = p.split("/blog/")[1];
      const { getBlogPost } = await import("./lib/blog-engine");
      const post = await getBlogPost(slug);
      if (post) {
        const ld = JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          datePublished: post.date,
          author: { "@type": "Person", "name": "Bio-Sync Academy", "url": "https://academy.endgameenhancements.com" },
          publisher: { "@type": "Organization", "name": "Bio-Sync Academy", "logo": { "@type": "ImageObject", "url": "https://academy.endgameenhancements.com/images/logo.jpg" } },
          description: post.excerpt,
          keywords: (post as any).keywords,
          mainEntityOfPage: { "@type": "WebPage", "@id": `https://academy.endgameenhancements.com/blog/${slug}` }
        });
        html = html.replace("</head>", `<script type="application/ld+json">${ld}</script></head>`);
      }
    }

    return c.html(html);
  });
}

async function configureDevelopment(app: Hono): Promise<ViteDevServer> {
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
  });

  app.use("*", async (c, next) => {
    const p = c.req.path;
    if (p.startsWith("/api/")) return next();
    if (p === "/blog" || p.startsWith("/blog/")) return next();
    if (p === "/favicon.ico") return c.redirect("/favicon.svg", 302);

    try {
      if (p === "/" || p === "/index.html") {
        let template = await Bun.file("./index.html").text();
        template = await vite.transformIndexHtml(p, template);
        return c.html(template, { headers: { "Cache-Control": "no-store, must-revalidate" } });
      }

      const publicFile = Bun.file(`./public${p}`);
      if (await publicFile.exists()) {
        const stat = await publicFile.stat();
        if (stat && !stat.isDirectory()) {
          return new Response(publicFile, { headers: { "Cache-Control": "no-store, must-revalidate" } });
        }
      }

      let result;
      try { result = await vite.transformRequest(p); } catch { result = null; }
      if (result) {
        return new Response(result.code, { headers: { "Content-Type": "application/javascript", "Cache-Control": "no-store, must-revalidate" } });
      }

      let template = await Bun.file("./index.html").text();
      template = await vite.transformIndexHtml("/", template);
      return c.html(template, { headers: { "Cache-Control": "no-store, must-revalidate" } });
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      console.error(error);
      return c.text("Internal Server Error", 500);
    }
  });

  return vite;
}

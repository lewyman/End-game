import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
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

app.use("/assets/*", serveStatic({ root: "./dist" }));

app.use(async (c, next) => {
  if (c.req.method !== "GET") return next();
  const p = c.req.path;
  if (p.startsWith("/api/") || p.startsWith("/assets/")) return next();

  if (p === "/blog" || p.startsWith("/blog/")) return next();

  const filePath = join("./dist", p);
  if (existsSync(filePath) && !existsSync(filePath + "/")) {
    const stat = Bun.file(filePath);
    const mime = p.endsWith(".js") ? "application/javascript"
      : p.endsWith(".css") ? "text/css"
      : p.endsWith(".png") ? "image/png"
      : p.endsWith(".svg") ? "image/svg+xml"
      : p.endsWith(".ico") ? "image/x-icon"
      : p.endsWith(".woff2") ? "font/woff2"
      : "application/octet-stream";
    return new Response(stat, { headers: { "Content-Type": mime } });
  }

  const meta = await getPageMeta(p);
  let html = readFileSync("./dist/index.html", "utf-8");

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

const port = parseInt(process.env.PORT || "8080", 10);

export default { fetch: app.fetch, port, idleTimeout: 255 };

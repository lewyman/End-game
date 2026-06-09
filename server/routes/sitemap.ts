import { Hono } from "hono";
import { listBlogPosts } from "../lib/blog-engine";

const app = new Hono();

app.get("/sitemap.xml", async (c) => {
  const posts = await listBlogPosts();
  const baseUrl = "https://academy.endgameenhancements.com";
  const today = new Date().toISOString().split("T")[0];

  const staticPages = [
    { loc: "/", priority: "1.0", changefreq: "daily" },
    { loc: "/pricing", priority: "0.9", changefreq: "weekly" },
    { loc: "/drug-cards", priority: "0.9", changefreq: "weekly" },
    { loc: "/clinical-tools", priority: "0.8", changefreq: "weekly" },
    { loc: "/pathways", priority: "0.8", changefreq: "weekly" },
    { loc: "/procedures", priority: "0.7", changefreq: "weekly" },
    { loc: "/blog", priority: "0.9", changefreq: "daily" },
  ];

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const p of staticPages) {
    xml += `  <url>\n    <loc>${baseUrl}${p.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>\n`;
  }

  for (const post of posts) {
    xml += `  <url>\n    <loc>${baseUrl}/blog/${post.slug}</loc>\n    <lastmod>${post.date}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
  }

  xml += '</urlset>';
  return c.text(xml, { headers: { "Content-Type": "application/xml" } });
});

export default app;

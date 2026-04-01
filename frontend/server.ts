import { Hono } from "hono";
import { serveStatic } from "hono/bun";

const app = new Hono();

// Manual image serving to fix serveStatic issue
app.get("/images/*", async (c) => {
  const path = c.req.path;
  // Check dist first (built assets), then public (uploaded images)
  const distPath = `./dist${path}`;
  const publicPath = `./public${path}`;
  
  try {
    // Try dist first (for built-time assets)
    const distFile = Bun.file(distPath);
    if (await distFile.exists()) {
      const content = await distFile.bytes();
      const ext = path.split('.').pop()?.toLowerCase();
      const contentType = ext === 'png' ? 'image/png' : 
                         ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 
                         'application/octet-stream';
      return new Response(content, { 
        headers: { 'Content-Type': contentType }
      });
    }
    
    // Fall back to public (for runtime uploads from API)
    const publicFile = Bun.file(publicPath);
    if (await publicFile.exists()) {
      const content = await publicFile.bytes();
      const ext = path.split('.').pop()?.toLowerCase();
      const contentType = ext === 'png' ? 'image/png' : 
                         ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 
                         'application/octet-stream';
      return new Response(content, { 
        headers: { 'Content-Type': contentType }
      });
    }
  } catch (e) {
    console.error('Image serve error:', e);
  }
  return c.notFound();
});

// Sitemap for SEO
app.get("/sitemap.xml", async (c) => {
  const SITE_URL = "https://nursingpharm-crusius.zocomputer.io";
  const API_URL = "https://nursingpharmapi-crusius.zocomputer.io";
  
  let articles: any[] = [];
  try {
    const res = await fetch(`${API_URL}/api/articles`);
    const data = await res.json();
    articles = data.articles || [];
  } catch (e) {
    console.error("Failed to fetch articles for sitemap:", e);
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${SITE_URL}/products</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${SITE_URL}/privacy</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  ${articles.map((a: any) => `  <url>
    <loc>${SITE_URL}/articles/${a.slug}</loc>
    <lastmod>${new Date(a.published_at).toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`).join('\n')}
</urlset>`;

  c.header("Content-Type", "application/xml");
  return c.body(sitemap);
});

// Robots.txt for SEO
app.get("/robots.txt", (c) => {
  const SITE_URL = "https://nursingpharm-crusius.zocomputer.io";
  
  const robots = `User-agent: *
Allow: /
Disallow: /admin

Sitemap: ${SITE_URL}/sitemap.xml`;

  c.header("Content-Type", "text/plain");
  return c.body(robots);
});

if (process.env.NODE_ENV === "production") {
  // Serve static files with explicit image handling
  app.use("/images/*", serveStatic({ root: "./dist" }));
  app.use("/assets/*", serveStatic({ root: "./dist" }));
  app.use("/*", serveStatic({ root: "./dist" }));
  app.get("*", serveStatic({ path: "./dist/index.html" }));
}

export default { 
  port: process.env.PORT || 53005, 
  fetch: app.fetch 
};

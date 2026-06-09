import { Hono } from "hono";
import { listBlogPosts, getBlogPost, renderBlogPost, renderBlogIndex } from "../lib/blog-engine";

const app = new Hono();

app.get("/blog", async (c) => {
  const posts = await listBlogPosts();
  return c.html(renderBlogIndex(posts));
});

app.get("/blog/:slug", async (c) => {
  const slug = c.req.param("slug");
  const post = await getBlogPost(slug);
  if (!post) return c.html("<h1>Not Found</h1>", 404);
  return c.html(renderBlogPost(post));
});

app.get("/api/blog", async (c) => {
  const posts = await listBlogPosts();
  return c.json(posts.map(p => ({ title: p.title, slug: p.slug, date: p.date, keywords: p.keywords, excerpt: p.excerpt })));
});

app.get("/api/blog/:slug", async (c) => {
  const slug = c.req.param("slug");
  const post = await getBlogPost(slug);
  if (!post) return c.json({ error: "Post not found" }, 404);
  return c.json({ title: post.title, slug: post.slug, date: post.date, keywords: post.keywords, excerpt: post.excerpt, content: post.content });
});

export default app;

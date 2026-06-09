import path from "node:path";
import { mkdir, readFile, readdir } from "node:fs/promises";


interface BlogPost {
  title: string;
  slug: string;
  date: string;
  keywords: string;
  excerpt: string;
  content: string;
}

interface BlogMeta {
  title: string;
  slug: string;
  date: string;
  keywords: string;
  excerpt: string;
}

async function listBlogPosts(): Promise<BlogMeta[]> {
  const blogDir = path.join(process.cwd(), "data", "blog");
  await mkdir(blogDir, { recursive: true });
  const files = await readdir(blogDir);
  const posts: BlogMeta[] = [];

  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const slug = file.replace(/\.md$/, "");
    const raw = await readFile(path.join(blogDir, file), "utf-8");
    const meta = parseFrontmatter(raw);
    posts.push({ ...meta, slug });
  }

  posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return posts;
}

async function getBlogPost(slug: string): Promise<BlogPost | null> {
  const blogDir = path.join(process.cwd(), "data", "blog");
  const filePath = path.join(blogDir, `${slug}.md`);
  try {
    const raw = await readFile(filePath, "utf-8");
    const meta = parseFrontmatter(raw);
    return { ...meta, slug, content: meta.content };
  } catch {
    return null;
  }
}

function parseFrontmatter(raw: string): BlogPost {
  const lines = raw.split("\n");
  let inFrontmatter = false;
  let frontmatterEnded = false;
  const meta: Record<string, string> = {};
  let contentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0 && line.trim() === "---") {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter && line.trim() === "---") {
      inFrontmatter = false;
      frontmatterEnded = true;
      continue;
    }
    if (inFrontmatter) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        let value = line.slice(colonIdx + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        meta[key] = value;
      }
    } else if (frontmatterEnded) {
      contentLines.push(line);
    }
  }

  return {
    title: meta.title || "Untitled",
    slug: "",
    date: meta.date || new Date().toISOString().split("T")[0],
    keywords: meta.keywords || "",
    excerpt: meta.excerpt || "",
    content: contentLines.join("\n").trim(),
  };
}

function renderMarkdown(md: string): string {
  let html = "";
  const lines = md.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith("```")) {
      html += '<pre><code>';
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        html += escapeHtml(lines[i]) + "\n";
        i++;
      }
      html += '</code></pre>';
      i++;
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // H3
    if (line.trim().startsWith("### ")) {
      const text = line.trim().slice(4);
      html += `<h3>${renderInline(text)}</h3>`;
      i++;
      continue;
    }
    // H2
    if (line.trim().startsWith("## ")) {
      const text = line.trim().slice(3);
      html += `<h2>${renderInline(text)}</h2>`;
      i++;
      continue;
    }
    // H1
    if (line.trim().startsWith("# ")) {
      const text = line.trim().slice(2);
      html += `<h1>${renderInline(text)}</h1>`;
      i++;
      continue;
    }

    // Horizontal rule
    if (line.trim().match(/^(-{3,}|\*{3,}|_{3,})$/)) {
      html += '<hr>';
      i++;
      continue;
    }

    // Blockquote
    if (line.trim().startsWith("> ")) {
      html += '<blockquote>';
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        const text = lines[i].trim().slice(2);
        html += `<p>${renderInline(text)}</p>`;
        i++;
      }
      html += '</blockquote>';
      continue;
    }

    // Unordered list
    if (line.trim().match(/^[-*]\s/)) {
      html += '<ul>';
      while (i < lines.length && lines[i].trim().match(/^[-*]\s/)) {
        const text = lines[i].trim().replace(/^[-*]\s+/, "");
        html += `<li>${renderInline(text)}</li>`;
        i++;
      }
      html += '</ul>';
      continue;
    }

    // Ordered list
    if (line.trim().match(/^\d+\.\s/)) {
      html += '<ol>';
      while (i < lines.length && lines[i].trim().match(/^\d+\.\s/)) {
        const text = lines[i].trim().replace(/^\d+\.\s+/, "");
        html += `<li>${renderInline(text)}</li>`;
        i++;
      }
      html += '</ol>';
      continue;
    }

    // Table
    if (line.trim().startsWith("|")) {
      const rawRows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rawRows.push(lines[i].trim());
        i++;
      }
      if (rawRows.length >= 2) {
        const sepIdx = rawRows.findIndex(r => /^\|[-:\s|]+\|$/.test(r));
        const headerIdx = sepIdx >= 0 ? 0 : 0;
        const dataStart = sepIdx >= 0 ? sepIdx + 1 : 1;
        const headerCells = rawRows[headerIdx].split("|").map(c => c.trim()).filter(Boolean);
        html += '<table><thead><tr>';
        for (const c of headerCells) html += '<th>' + renderInline(c) + '</th>';
        html += '</tr></thead><tbody>';
        for (let ri = dataStart; ri < rawRows.length; ri++) {
          const dCells = rawRows[ri].split("|").map(c => c.trim()).filter(Boolean);
          html += '<tr>';
          for (const c of dCells) html += '<td>' + renderInline(c) + '</td>';
          html += '</tr>';
        }
        html += '</tbody></table>';
        continue;
      }
    }

    // Regular paragraph
    let paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].trim().startsWith("#") && !lines[i].trim().startsWith("```") && !lines[i].trim().match(/^[-*>]\s/) && !lines[i].trim().match(/^\d+\.\s/) && !lines[i].trim().match(/^(-{3,}|\*{3,}|_{3,})$/)) {
      paraLines.push(lines[i].trim());
      i++;
    }
    if (paraLines.length > 0) {
      html += `<p>${renderInline(paraLines.join(" "))}</p>`;
    }
  }

  return html;
}

function renderInline(text: string): string {
  // Inline code
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return text;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderBlogPost(post: BlogPost): string {
  const contentHtml = renderMarkdown(post.content);
  const keywordsMeta = post.keywords ? `<meta name="keywords" content="${escapeHtml(post.keywords)}">` : "";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "datePublished": post.date,
    "description": post.excerpt,
    "author": { "@type": "Organization", "name": "Bio-Sync Academy" },
    "publisher": { "@type": "Organization", "name": "Bio-Sync Academy" },
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(post.title)} — Bio-Sync Academy</title>
<meta name="description" content="${escapeHtml(post.excerpt)}">
<meta property="og:title" content="${escapeHtml(post.title)}">
<meta property="og:description" content="${escapeHtml(post.excerpt)}">
<meta property="og:type" content="article">
<meta property="og:url" content="https://academy.endgameenhancements.com/blog/${escapeHtml(post.slug)}">
<meta property="og:image" content="https://academy.endgameenhancements.com/images/logo.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="https://academy.endgameenhancements.com/blog/${escapeHtml(post.slug)}">
<link rel="icon" type="image/png" href="/favicon.png">
${keywordsMeta}
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.8; max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem; background: #060b1a; color: #e8e0d0; }
  h1 { font-size: 2rem; color: #fff; margin-bottom: 0.25rem; }
  h2 { font-size: 1.5rem; color: #c9a84c; margin-top: 2rem; }
  h3 { font-size: 1.2rem; color: #d0d0d0; margin-top: 1.5rem; }
  p { margin: 1rem 0; }
  a { color: #4da6ff; text-decoration: none; }
  a:hover { text-decoration: underline; }
  code { background: #0c1230; padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.9em; }
  pre { background: #0c1230; padding: 1rem; border-radius: 8px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: 0.9rem; }
  th, td { border: 1px solid #1a2540; padding: 0.5rem 0.75rem; }
  blockquote { border-left: 3px solid #c9a84c; margin: 1rem 0; padding: 0.5rem 1rem; background: rgba(201,168,76,0.05); font-style: italic; }
  ul, ol { padding-left: 1.5rem; }
  li { margin: 0.5rem 0; }
  hr { border: none; border-top: 1px solid #1a2540; margin: 2rem 0; }
  .post-meta { color: #7a8ba0; font-size: 0.9rem; margin-bottom: 1.5rem; }
  .back-link { display: inline-block; margin-bottom: 2rem; color: #7a8ba0; font-size: 0.9rem; }
  .back-link:hover { color: #c9a84c; }
  .references { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid #1a2540; }
  .references h2 { color: #c9a84c; font-size: 1.2rem; }
  .references p { font-size: 0.9rem; color: #7a8ba0; }
  .bio-header { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid #1a2540; margin-bottom: 2rem; flex-wrap: wrap; gap: 0.5rem; }
  .bio-header .brand { display: flex; align-items: center; gap: 0.5rem; }
  .bio-header img { width: 32px; height: 32px; border-radius: 6px; }
  .bio-header .name { font-size: 1rem; font-weight: 600; color: #c9a84c; }
  .bio-header nav { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
  .bio-header nav a { color: #7a8ba0; font-size: 0.85rem; padding: 0.25rem 0.5rem; border-radius: 4px; transition: color 0.2s; }
  .bio-header nav a:hover { color: #c9a84c; text-decoration: none; }
</style>
</head>
<body>
<div class="bio-header">
  <a href="/" style="text-decoration: none;"><div class="brand">
    <img src="/images/logo.jpg" alt="Bio-Sync Academy" width="32" height="32">
    <span class="name">Bio-Sync Academy</span>
  </div></a>
  <nav>
    <a href="/">Home</a>
    <a href="/blog">Blog</a>
    <a href="/drug-cards">Drug Cards</a>
    <a href="/clinical-tools">Clinical Tools</a>
    <a href="/pricing">Pricing</a>
  </nav>
</div>
<a href="/blog" class="back-link">← All posts</a>
<h1>${escapeHtml(post.title)}</h1>
<div class="post-meta">Published ${formatDate(post.date)}</div>
${contentHtml}
<div class="references">
  <h2>References</h2>
  <p>Sources available in APA 7th edition format. Access the full reference list and interactive content on <a href="/">Bio-Sync Academy</a>.</p>
</div>
</body>
</html>`;
}

function renderBlogIndex(posts: BlogMeta[]): string {
  const postItems = posts.map(p => `
    <article style="margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid #1a2540;">
      <h2 style="margin-bottom: 0.25rem;"><a href="/blog/${escapeHtml(p.slug)}" style="color: #ffffff;">${escapeHtml(p.title)}</a></h2>
      <div style="color: #7a8ba0; font-size: 0.85rem;">${formatDate(p.date)}</div>
      <p style="color: #aaa0b0; margin-top: 0.5rem;">${escapeHtml(p.excerpt)}</p>
      <a href="/blog/${escapeHtml(p.slug)}" style="color: #4da6ff; font-size: 0.9rem;">Read more →</a>
    </article>
  `).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Blog — Bio-Sync Academy | Nursing Pharmacology</title>
<meta name="description" content="Nursing pharmacology articles, NCLEX study guides, and drug deep-dives from Bio-Sync Academy. Written for nursing students by MAIA.">
<meta property="og:title" content="Bio-Sync Academy Blog">
<meta property="og:description" content="Nursing pharmacology articles, NCLEX study guides, and drug deep-dives.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://academy.endgameenhancements.com/blog">
<meta property="og:image" content="https://academy.endgameenhancements.com/images/logo.jpg">
<link rel="canonical" href="https://academy.endgameenhancements.com/blog">
<link rel="icon" type="image/png" href="/favicon.png">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.8; max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem; background: #060b1a; color: #e8e0d0; }
  a { color: #4da6ff; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .bio-header { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid #1a2540; margin-bottom: 2rem; flex-wrap: wrap; gap: 0.5rem; }
  .bio-header .brand { display: flex; align-items: center; gap: 0.5rem; }
  .bio-header img { width: 32px; height: 32px; border-radius: 6px; }
  .bio-header .name { font-size: 1rem; font-weight: 600; color: #c9a84c; }
  .bio-header nav { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
  .bio-header nav a { color: #7a8ba0; font-size: 0.85rem; padding: 0.25rem 0.5rem; border-radius: 4px; transition: color 0.2s; }
  .bio-header nav a:hover { color: #c9a84c; text-decoration: none; }
</style>
</head>
<body>
<div class="bio-header">
  <a href="/" style="text-decoration: none;"><div class="brand">
    <img src="/images/logo.jpg" alt="Bio-Sync Academy" width="32" height="32">
    <span class="name">Bio-Sync Academy</span>
  </div></a>
  <nav>
    <a href="/">Home</a>
    <a href="/blog">Blog</a>
    <a href="/drug-cards">Drug Cards</a>
    <a href="/clinical-tools">Clinical Tools</a>
    <a href="/pricing">Pricing</a>
  </nav>
</div>
<h1 style="color: #ffffff; font-size: 1.8rem;">Blog</h1>
<p style="color: #7a8ba0; margin-bottom: 2rem;">Nursing pharmacology deep-dives, NCLEX study guides, and clinical reasoning articles.</p>
${postItems || '<p style="color: #7a8ba0;">No posts yet. Check back soon.</p>'}
</body>
</html>`;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return dateStr;
  }
}

async function getPageMeta(path: string): Promise<{ title: string; description: string; ogTitle: string; ogDescription: string }> {
  const base = "Bio-Sync Academy";
  if (path === "/" || path === "") {
    return { title: "Bio-Sync Academy", description: "Nursing pharmacology, NCLEX study guides, and drug deep-dives from Bio-Sync Academy. Written for nursing students by MAIA.", ogTitle: "Bio-Sync Academy", ogDescription: "Nursing pharmacology, NCLEX study guides, and drug deep-dives from Bio-Sync Academy. Written for nursing students by MAIA." };
  }
  if (path.startsWith("/blog/")) {
    const slug = path.slice(6);
    const post = await getBlogPost(slug);
    if (post) {
      return { title: post.title, description: post.excerpt, ogTitle: post.title, ogDescription: post.excerpt };
    }
  }
  if (path === "/drug-cards") {
    return { title: "Drug Cards", description: "Browse FDA drug labels, NDC products, and adverse events for nursing pharmacology.", ogTitle: "Drug Cards", ogDescription: "Browse FDA drug labels, NDC products, and adverse events for nursing pharmacology." };
  }
  if (path === "/clinical-tools") {
    return { title: "Clinical Tools", description: "Interactive clinical tools for nursing education, including drug interactions, dosing, and NCLEX practice.", ogTitle: "Clinical Tools", ogDescription: "Interactive clinical tools for nursing education, including drug interactions, dosing, and NCLEX practice." };
  }
  if (path === "/pricing") {
    return { title: "Pricing", description: "View Bio-Sync Academy Pro MAIA subscription plans and features.", ogTitle: "Pricing", ogDescription: "View Bio-Sync Academy Pro MAIA subscription plans and features." };
  }
  if (path === "/terms") {
    return { title: "Terms", description: "Terms of service for Bio-Sync Academy.", ogTitle: "Terms", ogDescription: "Terms of service for Bio-Sync Academy." };
  }
  if (path === "/privacy") {
    return { title: "Privacy", description: "Privacy policy for Bio-Sync Academy.", ogTitle: "Privacy", ogDescription: "Privacy policy for Bio-Sync Academy." };
  }
  if (path === "/refund-policy") {
    return { title: "Refund Policy", description: "Refund policy for Bio-Sync Academy.", ogTitle: "Refund Policy", ogDescription: "Refund policy for Bio-Sync Academy." };
  }
  if (path === "/procedures") {
    return { title: "Procedures", description: "Clinical procedures for nursing education.", ogTitle: "Procedures", ogDescription: "Clinical procedures for nursing education." };
  }
  return { title: "Bio-Sync Academy", description: "Nursing pharmacology, NCLEX study guides, and drug deep-dives from Bio-Sync Academy. Written for nursing students by MAIA.", ogTitle: "Bio-Sync Academy", ogDescription: "Nursing pharmacology, NCLEX study guides, and drug deep-dives from Bio-Sync Academy. Written for nursing students by MAIA." };
}
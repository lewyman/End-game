import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Calendar, Tag, ArrowLeft } from "lucide-react";

interface BlogPost {
  title: string;
  slug: string;
  date: string;
  keywords: string;
  excerpt: string;
  content: string;
}

function renderMarkdown(md: string): { __html: string } {
  let html = "";
  const lines = md.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

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

    if (line.trim() === "") { i++; continue; }

    if (line.trim().startsWith("### ")) {
      html += `<h3 class="text-xl font-semibold text-foreground mt-8 mb-3">${renderInline(line.trim().slice(4))}</h3>`;
      i++; continue;
    }
    if (line.trim().startsWith("## ")) {
      html += `<h2 class="text-2xl font-bold text-foreground mt-8 mb-3 border-b border-border pb-2">${renderInline(line.trim().slice(3))}</h2>`;
      i++; continue;
    }
    if (line.trim().startsWith("# ")) {
      html += `<h1 class="text-3xl font-bold text-foreground mt-8 mb-4">${renderInline(line.trim().slice(2))}</h1>`;
      i++; continue;
    }

    if (line.trim().match(/^[-*]\s/)) {
      html += '<ul class="list-disc pl-5 space-y-1 my-3 text-muted-foreground">';
      while (i < lines.length && lines[i].trim().match(/^[-*]\s/)) {
        html += `<li>${renderInline(lines[i].trim().replace(/^[-*]\s+/, ""))}</li>`;
        i++;
      }
      html += '</ul>';
      continue;
    }

    if (line.trim().match(/^\d+\.\s/)) {
      html += '<ol class="list-decimal pl-5 space-y-1 my-3 text-muted-foreground">';
      while (i < lines.length && lines[i].trim().match(/^\d+\.\s/)) {
        html += `<li>${renderInline(lines[i].trim().replace(/^\d+\.\s+/, ""))}</li>`;
        i++;
      }
      html += '</ol>';
      continue;
    }

    if (line.trim().startsWith("> ")) {
      html += '<blockquote class="border-l-3 border-primary/50 pl-4 italic text-muted-foreground my-3">';
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        html += `<p>${renderInline(lines[i].trim().slice(2))}</p>`;
        i++;
      }
      html += '</blockquote>';
      continue;
    }

    if (line.trim().startsWith("|")) {
      const rawRows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) { rawRows.push(lines[i].trim()); i++; }
      if (rawRows.length >= 2) {
        const sepIdx = rawRows.findIndex(r => /^\|[-:\s|]+\|$/.test(r));
        const headerIdx = sepIdx >= 0 ? 0 : 0;
        const dataStart = sepIdx >= 0 ? sepIdx + 1 : 1;
        const headerCells = rawRows[headerIdx].split("|").map(c => c.trim()).filter(Boolean);
        html += '<div class="overflow-x-auto my-4"><table class="w-full border-collapse text-sm"><thead><tr class="bg-muted/50">';
        for (const c of headerCells) html += `<th class="border border-border px-3 py-2 text-left font-medium text-foreground">${renderInline(c)}</th>`;
        html += '</tr></thead><tbody>';
        for (let ri = dataStart; ri < rawRows.length; ri++) {
          const dCells = rawRows[ri].split("|").map(c => c.trim()).filter(Boolean);
          html += '<tr class="border-t border-border">';
          for (const c of dCells) html += `<td class="border border-border px-3 py-2 text-muted-foreground">${renderInline(c)}</td>`;
          html += '</tr>';
        }
        html += '</tbody></table></div>';
        continue;
      }
    }

    if (line.trim().match(/^(-{3,}|\*{3,}|_{3,})$/)) {
      html += '<hr class="border-border my-6" />';
      i++;
      continue;
    }

    let paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].trim().startsWith("#") && !lines[i].trim().startsWith("```") && !lines[i].trim().match(/^[-*>]\s/) && !lines[i].trim().match(/^\d+\.\s/) && !lines[i].trim().match(/^(-{3,}|\*{3,}|_{3,})$/) && !lines[i].trim().startsWith("|")) {
      paraLines.push(lines[i].trim()); i++;
    }
    if (paraLines.length > 0) {
      html += `<p class="text-muted-foreground leading-relaxed my-3">${renderInline(paraLines.join(" "))}</p>`;
    }
  }

  return { __html: html };
}

function renderInline(text: string): string {
  text = text.replace(/`([^`]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm text-primary">$1</code>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>');
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary hover:underline">$1</a>');
  return text;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/blog/${slug}`)
      .then(r => { if (!r.ok) throw new Error("not found"); return r.json(); })
      .then(data => { setPost(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-2/3" />
          <div className="h-4 bg-muted rounded w-1/4" />
          <div className="h-4 bg-muted rounded w-full mt-6" />
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-foreground mb-3">Post not found</h1>
        <p className="text-muted-foreground mb-6">This article doesn't exist or may have been removed.</p>
        <Link to="/blog" className="inline-flex items-center gap-1.5 text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to Blog
        </Link>
      </div>
    );
  }

  return (
    <article className="max-w-3xl mx-auto px-4 py-12">
      <Link to="/blog" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Blog
      </Link>

      <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">{post.title}</h1>

      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-8 pb-6 border-b border-border">
        <span className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" /> {post.date}
        </span>
        {post.keywords && (
          <span className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" /> {post.keywords}
          </span>
        )}
      </div>

      <div className="prose-content" dangerouslySetInnerHTML={renderMarkdown(post.content)} />
    </article>
  );
}

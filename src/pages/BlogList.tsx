import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Calendar, Tag, ArrowRight } from "lucide-react";

interface BlogMeta {
  title: string;
  slug: string;
  date: string;
  keywords: string;
  excerpt: string;
}

export default function BlogList() {
  const [posts, setPosts] = useState<BlogMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/blog")
      .then(r => r.json())
      .then(data => { setPosts(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-6">
          {[1,2,3].map(i => (
            <div key={i} className="bg-card rounded-xl p-6 border border-border">
              <div className="h-6 bg-muted rounded w-3/4 mb-3" />
              <div className="h-4 bg-muted rounded w-1/4 mb-3" />
              <div className="h-4 bg-muted rounded w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="text-3xl font-bold text-foreground mb-4">Blog</h1>
        <p className="text-muted-foreground text-lg mb-2">No articles yet.</p>
        <p className="text-muted-foreground">Check back soon for nursing pharmacology guides, NCLEX tips, and clinical pearls.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-foreground mb-2">Blog</h1>
      <p className="text-muted-foreground mb-8">Nursing pharmacology guides, NCLEX tips, and clinical pearls.</p>

      <div className="space-y-6">
        {posts.map(post => (
          <Link
            key={post.slug}
            to={`/blog/${post.slug}`}
            className="block bg-card hover:bg-card/80 border border-border hover:border-primary/30 rounded-xl p-6 transition-all group"
          >
            <h2 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
              {post.title}
            </h2>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {post.date}
              </span>
              {post.keywords && (
                <span className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  {post.keywords}
                </span>
              )}
            </div>
            <p className="text-muted-foreground leading-relaxed">{post.excerpt}</p>
            <span className="inline-flex items-center gap-1 mt-3 text-sm text-primary font-medium group-hover:gap-2 transition-all">
              Read more <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

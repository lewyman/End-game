import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";

const API_URL = "/api";

export default function Article() {
  const { slug } = useParams();
  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/articles/${slug}`)
      .then((res) => res.json())
      .then((data) => {
        setArticle(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load article:", err);
        setLoading(false);
      });
  }, [slug]);

  if (loading) return <div className="p-8 text-center">Loading article...</div>;
  if (!article) return <div className="p-8 text-center text-red-500">Article not found.</div>;

  return (
    <div className="min-h-screen pt-24 bg-background">
      {/* Logo - Upper Left (3 inches = 288px) */}
      <div className="absolute top-4 left-4 z-10">
        <img 
          src="/images/Bio_Logo_white-87f86ab6b807.png" 
          alt="Bio-Sync Academy Logo" 
          className="w-[288px] h-[288px] object-contain"
        />
      </div>

      <div className="container mx-auto max-w-3xl px-4 py-12">
        <p className="text-sm text-muted-foreground mb-4">
          <a href="/" className="hover:underline">Tech at the Bedside</a> by EndGameEnhancements
        </p>
        <header className="mb-8 border-b pb-8">
          <h1 className="text-4xl font-bold leading-tight md:text-5xl">{article.title}</h1>
          <p className="mt-4 text-muted-foreground">
            By {article.author} • {new Date(article.published_at).toLocaleDateString()}
          </p>
        </header>

        <article className="prose prose-lg dark:prose-invert max-w-none">
          <ReactMarkdown>{article.content}</ReactMarkdown>
        </article>

        <div className="mt-12 rounded-lg bg-secondary p-8 text-center text-secondary-foreground">
          <h3 className="text-2xl font-bold">Enjoyed this guide?</h3>
          <p className="mt-2 text-secondary-foreground/80">
            Subscribe for weekly nursing tech tips and exclusive cheat sheets.
          </p>
          <form 
            className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
            onSubmit={async (e) => {
              e.preventDefault();
              const email = (e.target as any).email.value;
              await fetch(`${API_URL}/subscribe`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
              });
              alert("Thanks for subscribing!");
            }}
          >
            <input 
              name="email"
              type="email" 
              placeholder="nurse@student.edu" 
              className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              required 
            />
            <button className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
              Get Weekly Tips
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
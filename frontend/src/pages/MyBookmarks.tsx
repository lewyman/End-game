import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { ArrowLeft, Heart, Bookmark, Trash2 } from "lucide-react";

const API_URL = "/api";

interface BookmarkItem {
  drugSlug: string;
  blockId: number;
  drugName: string;
  blockTitle: string;
  savedAt: string;
}

export default function MyBookmarks() {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("pharma_bookmarks");
    if (stored) {
      setBookmarks(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  const removeBookmark = (drugSlug: string, blockId: number) => {
    const updated = bookmarks.filter(b => !(b.drugSlug === drugSlug && b.blockId === blockId));
    setBookmarks(updated);
    localStorage.setItem("pharma_bookmarks", JSON.stringify(updated));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
      {/* Logo - Upper Left (3 inches = 288px) */}
      <div className="absolute top-4 left-4 z-10">
        <img 
          src="/images/Bio_Logo_white-87f86ab6b807.png" 
          alt="Bio-Sync Academy Logo" 
          className="w-[288px] h-[288px] object-contain"
        />
      </div>

        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 bg-white">
      <div className="container mx-auto px-4 py-8">
        <Link to="/drugs" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="w-5 h-5" />
          Back to Drugs
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Bookmarks</h1>
        <p className="text-gray-600 mb-8">Your saved content for quick review</p>

        {bookmarks.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-xl">
            <Bookmark className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No bookmarks yet</p>
            <Link to="/drugs" className="text-blue-600 hover:text-blue-800 font-medium">
              Browse drugs to save content →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bookmarks.map((bookmark, idx) => (
              <div key={`${bookmark.drugSlug}-${bookmark.blockId}`} className="bg-white border rounded-xl p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Heart className="w-4 h-4 text-red-500" />
                      <span className="text-sm text-gray-500">{bookmark.drugName}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{bookmark.blockTitle}</h3>
                    <p className="text-sm text-gray-400">Saved on {new Date(bookmark.savedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/drugs/${bookmark.drugSlug}?block=${bookmark.blockId}`}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => removeBookmark(bookmark.drugSlug, bookmark.blockId)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Remove bookmark"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

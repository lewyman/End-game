import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Play,
  Pause,
  Music,
  Clock,
  Heart,
  HeartOff,
  Plus,
  Share2,
  X,
} from "lucide-react";

const API_URL = "https://www.endgameenhancements.com";

interface Song {
  id: number;
  slug: string;
  title: string;
  artist: string;
  drug_name: string;
  drug_class: string;
  description: string;
  lyrics: string;
  audio_path: string;
  cover_path: string;
  duration_seconds: number;
  tier: string;
  genre: string;
  play_count: number;
  created_at: string;
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export default function Songs() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    fetchSongs();
    
    const storedFav = localStorage.getItem("pharma_favorites");
    if (storedFav) {
      setFavorites(new Set(JSON.parse(storedFav)));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("pharma_favorites", JSON.stringify([...favorites]));
  }, [favorites]);

  async function fetchSongs() {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api?path=/songs`);
      const data = await res.json();
      setSongs(data.songs || []);
    } catch (error) {
      console.error("Failed to fetch songs:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredSongs = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    return songs.filter((song) => {
      const matchesSearch = !search || 
        song.title.toLowerCase().includes(lowerSearch) || 
        song.drug_name.toLowerCase().includes(lowerSearch);
      return matchesSearch;
    });
  }, [songs, search]);

  const toggleFavorite = (songId: number) => {
    setFavorites((prev) => {
      const updated = new Set(prev);
      if (updated.has(songId)) {
        updated.delete(songId);
      } else {
        updated.add(songId);
      }
      return updated;
    });
  };

  const playSong = (song: Song) => {
    setCurrentSong(song);
    setIsPlaying(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center relative">
        <div className="absolute top-4 left-4 z-10">
          <Link to="/">
            <img 
              src="/images/Bio_Logo_white-87f86ab6b807.png" 
              alt="Bio-Sync Academy Logo" 
              className="w-[288px] h-[288px] object-contain"
            />
          </Link>
        </div>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="absolute top-4 left-4 z-10">
        <Link to="/">
          <img 
            src="/images/Bio_Logo_white-87f86ab6b807.png" 
            alt="Bio-Sync Academy Logo" 
            className="w-[288px] h-[288px] object-contain"
          />
        </Link>
      </div>

      <div className="bg-gray-100 text-gray-900 py-12 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-center gap-3">
            <Music className="w-8 h-8" />
            <h1 className="text-4xl font-bold">Drug Songs</h1>
          </div>
          <p className="text-gray-600 text-lg mt-2">
            Pharmacology taught through playlists.
          </p>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search songs or drugs..."
            className="w-full max-w-md px-4 py-3 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {filteredSongs.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Music className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-xl font-medium">No songs found</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredSongs.map((song) => (
              <div key={song.id} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-100 w-16 h-16 rounded-xl flex items-center justify-center">
                    <Music className="w-8 h-8 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{song.title}</h3>
                    <p className="text-sm text-gray-500">
                      {song.drug_name} · {song.drug_class}
                    </p>
                    <p className="mt-2 text-sm text-gray-600 line-clamp-2">{song.description}</p>
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        onClick={() => playSong(song)}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold"
                      >
                        Play
                      </button>
                      <button
                        onClick={() => toggleFavorite(song.id)}
                        className="p-2 rounded-full text-gray-500 hover:text-red-500"
                      >
                        {favorites.has(song.id) ? <Heart className="w-5 h-5" /> : <HeartOff className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <audio ref={audioRef} />
    </div>
  );
}

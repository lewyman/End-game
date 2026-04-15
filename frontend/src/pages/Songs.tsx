import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Play, Pause, Music, Clock, Headphones, Search, Filter, ChevronDown } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "";

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

export default function Songs() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [expandedLyrics, setExpandedLyrics] = useState<number | null>(null);
  const [user, setUser] = useState<any>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const u = localStorage.getItem("pharma_current_user") || sessionStorage.getItem("pharma_current_user");
    if (u) setUser(JSON.parse(u));
    fetchSongs();
  }, []);

  useEffect(() => {
    if (currentSong && audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentSong]);

  async function fetchSongs() {
    try {
      const res = await fetch(`${API_URL}/api?path=/songs`);
      const data = await res.json();
      setSongs(data.songs || []);
    } catch (e) {
      console.error("Failed to fetch songs:", e);
    } finally {
      setLoading(false);
    }
  }

  function playSong(song: Song) {
    if (currentSong?.id === song.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentSong(song);
      setIsPlaying(true);
    }
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  const genres = [...new Set(songs.map((s) => s.genre).filter(Boolean))];

  const filtered = songs.filter((s) => {
    const matchSearch = !search || s.title.toLowerCase().includes(search.toLowerCase()) || s.drug_name.toLowerCase().includes(search.toLowerCase());
    const matchGenre = !genreFilter || s.genre === genreFilter;
    return matchSearch && matchGenre;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Hero */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-12 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-center gap-3 mb-4">
            <Music className="w-8 h-8" />
            <h1 className="text-4xl font-bold">Drug Songs</h1>
          </div>
          <p className="text-purple-100 text-lg max-w-2xl">
            Pharmacology taught through music. Learn drug mechanisms, side effects, and nursing considerations through catchy songs — made for nurses, by nurses.
          </p>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-8">
        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search songs or drugs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={genreFilter}
              onChange={(e) => setGenreFilter(e.target.value)}
              className="pl-9 pr-8 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 outline-none appearance-none cursor-pointer"
            >
              <option value="">All Genres</option>
              {genres.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Songs Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Music className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-xl font-medium">No songs yet</p>
            <p className="mt-2">Songs will appear here once created.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map((song) => (
              <div
                key={song.id}
                className={`bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all ${currentSong?.id === song.id ? "ring-2 ring-blue-500" : ""}`}
              >
                <div className="flex items-center gap-4">
                  {/* Play Button */}
                  <button
                    onClick={() => playSong(song)}
                    className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center flex-shrink-0 transition-colors"
                  >
                    {currentSong?.id === song.id && isPlaying ? (
                      <Pause className="w-6 h-6" />
                    ) : (
                      <Play className="w-6 h-6 ml-1" />
                    )}
                  </button>

                  {/* Cover placeholder */}
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                    <Music className="w-6 h-6 text-white" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg truncate">{song.title}</h3>
                    <p className="text-gray-500 text-sm">
                      {song.drug_name} {song.drug_class && `· ${song.drug_class}`}
                    </p>
                  </div>

                  {/* Meta */}
                  <div className="hidden sm:flex items-center gap-4 text-sm text-gray-500">
                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-lg capitalize">{song.genre}</span>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatTime(song.duration_seconds || 180)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Headphones className="w-4 h-4" />
                      {song.play_count || 0}
                    </div>
                  </div>

                  {/* Expand */}
                  <button
                    onClick={() => setExpandedLyrics(expandedLyrics === song.id ? null : song.id)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium flex-shrink-0"
                  >
                    {expandedLyrics === song.id ? "Hide" : "Lyrics"}
                  </button>
                </div>

                {/* Lyrics */}
                {expandedLyrics === song.id && song.lyrics && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <pre className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">{song.lyrics}</pre>
                  </div>
                )}

                {/* Description */}
                {song.description && (
                  <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{song.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audio element (hidden) */}
      <audio ref={audioRef} src={currentSong?.audio_path} onEnded={() => setIsPlaying(false)} />
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  Music,
  Clock,
  Headphones,
  Search,
  Filter,
  ChevronDown,
  SkipBack,
  SkipForward,
  Shuffle,
  List,
  Volume2,
  VolumeX,
  Heart,
  HeartOff,
  Plus,
  Share2,
  Repeat,
  X,
} from "lucide-react";

const API_URL = "";

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

interface Playlist {
  id: string;
  name: string;
  description?: string;
  songIds: number[];
  coverUrl?: string;
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const generateId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2, 10);
};

export default function Songs() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState("all");
  const [expandedLyrics, setExpandedLyrics] = useState<number | null>(null);
  const [isShuffled, setIsShuffled] = useState(false);
  const [isLooped, setIsLooped] = useState(false);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [showFavorites, setShowFavorites] = useState(false);
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState<Song | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [recentlyPlayed, setRecentlyPlayed] = useState<Song[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const [showShareModal, setShowShareModal] = useState<Song | null>(null);
  const [shareFeedback, setShareFeedback] = useState("");
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    fetchSongs();
  }, []);

  useEffect(() => {
    const storedFav = localStorage.getItem("pharma_favorites");
    if (storedFav) {
      setFavorites(new Set(JSON.parse(storedFav)));
    }
    const storedPlaylists = localStorage.getItem("pharma_playlists");
    if (storedPlaylists) {
      setPlaylists(JSON.parse(storedPlaylists));
    } else {
      setPlaylists([
        { id: generateId(), name: "Cardiac Hits", songIds: [], coverUrl: "" },
      ]);
    }
    const storedRecent = localStorage.getItem("pharma_recently_played");
    if (storedRecent) {
      setRecentlyPlayed(JSON.parse(storedRecent));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("pharma_favorites", JSON.stringify([...favorites]));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem("pharma_playlists", JSON.stringify(playlists));
  }, [playlists]);

  useEffect(() => {
    localStorage.setItem("pharma_recently_played", JSON.stringify(recentlyPlayed));
  }, [recentlyPlayed]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (currentSong && isPlaying && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  }, [currentSong, isPlaying]);

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
      const matchesSearch = !search || song.title.toLowerCase().includes(lowerSearch) || song.drug_name.toLowerCase().includes(lowerSearch);
      const matchesGenre = genreFilter === "all" || song.genre === genreFilter;
      return matchesSearch && matchesGenre;
    });
  }, [songs, search, genreFilter]);

  const displaySongs = showFavorites ? filteredSongs.filter((song) => favorites.has(song.id)) : filteredSongs;

  const setQueue = (songsToQueue: Song[], targetSong: Song) => {
    const queue = isShuffled ? [...songsToQueue].sort(() => Math.random() - 0.5) : [...songsToQueue];
    setPlaylist(queue);
    const idx = queue.findIndex((item) => item.id === targetSong.id);
    setCurrentIndex(idx >= 0 ? idx : 0);
  };

  const addToRecentlyPlayed = (song: Song) => {
    setRecentlyPlayed((prev) => {
      const updated = [song, ...prev.filter((item) => item.id !== song.id)];
      return updated.slice(0, 10);
    });
  };

  const playSong = (song: Song, songList = displaySongs) => {
    setQueue(songList, song);
    setCurrentSong(song);
    setIsPlaying(true);
    addToRecentlyPlayed(song);
  };

  const handleNext = () => {
    if (playlist.length === 0) return;
    const nextIndex = currentIndex + 1;
    if (nextIndex < playlist.length) {
      setCurrentIndex(nextIndex);
      setCurrentSong(playlist[nextIndex]);
      addToRecentlyPlayed(playlist[nextIndex]);
      setIsPlaying(true);
      return;
    }
    if (isLooped) {
      setCurrentIndex(0);
      setCurrentSong(playlist[0]);
      addToRecentlyPlayed(playlist[0]);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  };

  const handlePrev = () => {
    if (playlist.length === 0) return;
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      setCurrentIndex(prevIndex);
      setCurrentSong(playlist[prevIndex]);
      addToRecentlyPlayed(playlist[prevIndex]);
      setIsPlaying(true);
    }
  };

  const toggleShuffle = () => {
    setIsShuffled((prev) => !prev);
  };

  const toggleLoop = () => {
    setIsLooped((prev) => !prev);
  };

  const toggleFavorite = (song: Song) => {
    setFavorites((prev) => {
      const updated = new Set(prev);
      if (updated.has(song.id)) {
        updated.delete(song.id);
      } else {
        updated.add(song.id);
      }
      return updated;
    });
  };

  const handleCreatePlaylist = () => {
    if (!newPlaylistName.trim()) return;
    setPlaylists((prev) => [
      ...prev,
      { id: generateId(), name: newPlaylistName.trim(), songIds: [], coverUrl: "" },
    ]);
    setNewPlaylistName("");
    setShowAddToPlaylist(null);
  };

  const handleAddSongToPlaylist = (playlistId: string, songId: number) => {
    setPlaylists((prev) =>
      prev.map((list) => {
        if (list.id !== playlistId) return list;
        if (list.songIds.includes(songId)) return list;
        return { ...list, songIds: [...list.songIds, songId] };
      }),
    );
  };

  const playlistSongs = (playlistId: string) => {
    const list = playlists.find((item) => item.id === playlistId);
    if (!list) return [];
    return songs.filter((song) => list.songIds.includes(song.id));
  };

  const handleShare = (song: Song) => {
    if (!song) return;
    setShareFeedback("");
    setShowShareModal(song);
  };

  const handleCopyShareLink = () => {
    if (!showShareModal) return;
    const link = typeof window !== "undefined" ? `${window.location.origin}/songs?highlight=${showShareModal.slug}` : "";
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      setShareFeedback("Link copied!");
    });
  };

  const shareLink = showShareModal && typeof window !== "undefined" ? `${window.location.origin}/songs?highlight=${showShareModal.slug}` : "";

  const gradientPairs = [
    ["#FF6F61", "#6B5B95"],
    ["#6B5B95", "#8DC26F"],
    ["#8DC26F", "#F7CAC9"],
    ["#F7CAC9", "#92A8D1"],
    ["#92A8D1", "#F39F86"],
    ["#F39F86", "#F9E79F"],
    ["#F9E79F", "#81ECA9"],
    ["#81ECA9", "#74B9FF"],
    ["#74B9FF", "#A1C4FD"],
    ["#A1C4FD", "#C2E9FB"],
    ["#C2E9FB", "#FF6F61"],
  ];

  const gradientStyles = (idx: number) => ({
    backgroundImage: `linear-gradient(135deg, ${gradientPairs[idx % gradientPairs.length].join(", ")})`,
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 pb-32">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-12 px-6">
        <div className="container mx-auto max-w-6xl flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Music className="w-8 h-8" />
            <h1 className="text-4xl font-bold">Drug Songs</h1>
          </div>
          <p className="text-purple-100 text-lg max-w-2xl">
            Pharmacology taught through playlists. Build routines, favorite the hits, and queue up your NCLEX study soundtrack.
          </p>
          <div className="flex flex-wrap gap-3 mt-2 text-sm font-medium">
            <button
              onClick={() => setShowFavorites((prev) => !prev)}
              className={`px-4 py-2 rounded-full border ${showFavorites ? "border-white bg-white/10" : "border-white/40"}`}
            >
              {showFavorites ? "Showing Favorites" : "Favorites"}
            </button>
            <button
              onClick={() => setShowRecent((prev) => !prev)}
              className="px-4 py-2 rounded-full border border-white/70"
            >
              Recently Played
            </button>
            <button
              onClick={() => setShowPlaylist((prev) => !prev)}
              className="px-4 py-2 rounded-full border border-white/70"
            >
              Queue
            </button>
            <button
              onClick={() => setShowAddToPlaylist(null)}
              className="px-4 py-2 rounded-full border border-white/70"
            >
              Playlists
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row items-stretch">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search songs or drugs..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="relative w-full sm:w-56">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={genreFilter}
              onChange={(e) => setGenreFilter(e.target.value)}
              className="w-full pl-9 pr-8 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 outline-none appearance-none cursor-pointer"
            >
              <option value="all">All Genres</option>
              {[...new Set(songs.map((song) => song.genre).filter(Boolean))].map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {displaySongs.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Music className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-xl font-medium">No songs found</p>
            <p className="mt-2">Try widening your filters or drop a new song.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {displaySongs.map((song) => (
              <div key={song.id} className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 transition-all hover:shadow-lg">
                <div className="flex items-start gap-4">
                  <div
                    style={gradientStyles(song.id)}
                    className="w-16 h-16 rounded-2xl flex-shrink-0 animate-pulse"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold truncate">{song.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {song.drug_name} · {song.drug_class}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <Clock className="w-4 h-4" />
                        {formatTime(song.duration_seconds)}
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{song.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                      <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 rounded-full">
                        {song.genre}
                      </span>
                      <span className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded-full">Tier: {song.tier}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        onClick={() => playSong(song)}
                        className="px-3 py-1 rounded-full bg-blue-600 text-white text-sm font-semibold"
                      >
                        Play
                      </button>
                      <button
                        onClick={() => toggleFavorite(song)}
                        className="p-1 rounded-full text-gray-500 hover:text-red-500"
                      >
                        {favorites.has(song.id) ? <Heart className="w-5 h-5" /> : <HeartOff className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => handleShare(song)}
                        className="p-1 rounded-full text-gray-500 hover:text-white hover:bg-blue-500"
                      >
                        <Share2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setShowAddToPlaylist(song)}
                        className="p-1 rounded-full text-gray-500 hover:text-white hover:bg-emerald-600"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
                {expandedLyrics === song.id && song.lyrics && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300">
                    <pre className="whitespace-pre-wrap font-sans leading-relaxed">{song.lyrics}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-slate-900 text-white border-t border-slate-800 px-4 py-3 z-50">
        <div className="container mx-auto max-w-6xl flex items-center gap-4">
          <div className="flex items-center gap-3 w-1/4 min-w-0">
            <div
              style={gradientStyles(currentSong?.id ?? 0)}
              className="w-12 h-12 rounded-lg flex items-center justify-center animate-pulse"
            >
              <Music className="w-8 h-8" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{currentSong?.title || "Select a song"}</p>
              <p className="text-xs text-slate-400 truncate">{currentSong?.drug_name || ""}</p>
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center gap-2">
            <div className="flex items-center gap-4">
              <button onClick={toggleShuffle} className={`p-1 rounded-full ${isShuffled ? "text-blue-400" : "text-slate-400"}`}>
                <Shuffle className="w-4 h-4" />
              </button>
              <button onClick={handlePrev} className="p-1 text-slate-300 hover:text-white">
                <SkipBack className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsPlaying((prev) => !prev)}
                className="w-10 h-10 rounded-full bg-white text-slate-900 flex items-center justify-center focus:outline-none"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <button onClick={handleNext} className="p-1 text-slate-300 hover:text-white">
                <SkipForward className="w-5 h-5" />
              </button>
              <button onClick={toggleLoop} className={`p-1 rounded-full ${isLooped ? "text-blue-400" : "text-slate-400"}`}>
                <Repeat className="w-4 h-4" />
              </button>
            </div>
            <div className="w-full flex items-center gap-2 text-xs text-slate-400">
              <span>{formatTime(currentTime)}</span>
              <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{
                    width: `${currentSong?.duration_seconds ? (currentTime / currentSong.duration_seconds) * 100 : 0}%`,
                  }}
                />
              </div>
              <span>{formatTime(currentSong?.duration_seconds || 0)}</span>
            </div>
          </div>
          <div className="w-1/4 flex items-center justify-end gap-2">
            <button onClick={() => setIsMuted((prev) => !prev)} className="p-1 text-slate-400 hover:text-white">
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(Number(e.target.value));
                setIsMuted(false);
              }}
              className="w-24 h-1 bg-slate-700 rounded-full appearance-none accent-blue-500"
            />
            <button
              onClick={() => handleShare(currentSong!)}
              className="p-1 rounded-full text-slate-300 hover:text-white"
              disabled={!currentSong}
            >
              <Share2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => toggleFavorite(currentSong!)}
              className="p-1 rounded-full text-slate-300 hover:text-white"
              disabled={!currentSong}
            >
              {currentSong && favorites.has(currentSong.id) ? <Heart className="w-5 h-5" /> : <HeartOff className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {showPlaylist && (
        <div className="fixed bottom-32 right-4 w-72 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between">
            <h3 className="font-semibold">Queue</h3>
            <button onClick={() => setShowPlaylist(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
            {playlist.map((song, index) => (
              <div key={song.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium truncate">{song.title}</p>
                  <p className="text-xs text-gray-500">{song.drug_name}</p>
                </div>
                <span className="text-xs text-gray-400">{index + 1}</span>
              </div>
            ))}
            {playlist.length === 0 && <p className="px-4 py-3 text-xs text-gray-500">Queue is empty.</p>}
          </div>
        </div>
      )}

      {showRecent && (
        <div className="fixed bottom-32 left-4 w-72 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between">
            <h3 className="font-semibold">Recently Played</h3>
            <button onClick={() => setShowRecent(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {recentlyPlayed.map((song) => (
              <div key={song.id} className="px-4 py-3 text-sm">
                <p className="font-medium truncate">{song.title}</p>
                <p className="text-xs text-gray-500">{song.drug_name}</p>
              </div>
            ))}
            {recentlyPlayed.length === 0 && <p className="px-4 py-3 text-xs text-gray-500">Play something to populate this list.</p>}
          </div>
        </div>
      )}

      {showAddToPlaylist && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add to playlist</h3>
              <button onClick={() => setShowAddToPlaylist(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              {playlists.map((list) => (
                <div key={list.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div>
                    <p className="font-medium">{list.name}</p>
                    <p className="text-xs text-gray-500">{list.songIds.length} songs</p>
                  </div>
                  <button
                    onClick={() => handleAddSongToPlaylist(list.id, showAddToPlaylist.id)}
                    className="px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-semibold"
                  >
                    Add
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="New playlist name"
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800"
                />
                <button
                  onClick={handleCreatePlaylist}
                  className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Share {showShareModal.title}</h3>
              <button onClick={() => setShowShareModal(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Copy the link below to share the song with colleagues.</p>
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-2xl px-3 py-2 text-sm">
              <span className="truncate">{shareLink}</span>
              <button
                onClick={handleCopyShareLink}
                className="px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-semibold"
              >
                Copy
              </button>
            </div>
            {shareFeedback && <p className="mt-2 text-xs text-emerald-400">{shareFeedback}</p>}
          </div>
        </div>
      )}

      <audio
        ref={audioRef}
        src={currentSong?.audio_path || undefined}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onEnded={handleNext}
      />
    </div>
  );
}

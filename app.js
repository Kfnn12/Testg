import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Play, Info, ChevronRight, Menu, X, Star, Clock, Tv, 
  Settings, Home, ArrowLeft, RefreshCw, Heart, TrendingUp, Calendar, 
  Mic, Subtitles, Volume2, Zap, ShieldCheck, Download, Smartphone, Share
} from 'lucide-react';
import { fetchFromApi, normalizeAnime, normalizeSpotlightAnime, M3U8_PROXIES } from './api';
import AnimeCard from './components/AnimeCard';
import VideoPlayer from './components/VideoPlayer';

export default function App() {
  const [view, setView] = useState('home'); 
  const [homeData, setHomeData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [streamData, setStreamData] = useState(null);
  const [availableServers, setAvailableServers] = useState({ sub: [], dub: [], raw: [] });
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [showHeader, setShowHeader] = useState(true);
  const lastScrollY = useRef(0);
  const [activeSpotlight, setActiveSpotlight] = useState(0);
  const [activeProxyIndex, setActiveProxyIndex] = useState(0);
  const [proxyKey, setProxyKey] = useState(0); 
  const [streamConfig, setStreamConfig] = useState({ version: 'sub', server: 'vidcloud' });
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  // Scroll logic
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) setShowHeader(false); 
      else setShowHeader(true); 
      lastScrollY.current = currentScrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Spotlight Rotation
  useEffect(() => {
    if (view === 'home' && homeData?.spotlightAnimes?.length > 0) {
      const interval = setInterval(() => {
        setActiveSpotlight(prev => (prev + 1) % homeData.spotlightAnimes.length);
      }, 6000);
      return () => clearInterval(interval);
    }
  }, [view, homeData]);

  // PWA Logic
  useEffect(() => {
    const handlePrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handlePrompt);
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt);
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    } else {
      setShowInstallHelp(true);
    }
  };

  useEffect(() => {
    async function loadHome() {
      try {
        setLoading(true);
        const raw = await fetchFromApi('/api/kaido/home');
        setHomeData({
          spotlightAnimes: (raw.data || []).map(normalizeSpotlightAnime),
          trendingAnimes: (raw.trending || []).map(normalizeAnime),
          latestEpisodeAnimes: (raw.recentlyUpdated || []).map(normalizeAnime),
          topUpcomingAnimes: (raw.topUpcoming || raw.upcoming || []).map(normalizeAnime),
          topAiringAnimes: (raw.topAiring || []).map(normalizeAnime),
          mostPopularAnimes: (raw.mostPopular || []).map(normalizeAnime),
        });
      } catch (err) { console.error(err); } finally { setLoading(false); }
    }
    loadHome();
  }, []);

  const handleAnimeClick = async (id) => {
    try {
      setLoading(true);
      const raw = await fetchFromApi(`/api/kaido/anime/${id}`);
      const animeData = raw.data || raw;
      const episodes = raw.providerEpisodes || animeData.providerEpisodes || [];
      setSelectedAnime({
        ...animeData,
        providerEpisodes: episodes,
        relatedSeasons: raw.relatedSeasons || animeData.relatedSeasons || []
      });
      setView('details');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      setLoading(true);
      const raw = await fetchFromApi(`/api/kaido/anime/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults((raw.data || []).map(normalizeAnime));
      setView('search');
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleWatch = async (animeId, episodeId, epNum, versionOverride = null, serverOverride = null) => {
    try {
      setLoading(true);
      const version = versionOverride || streamConfig.version;
      const serversResponse = await fetchFromApi(`/api/kaido/episode/${episodeId}/servers`);
      const serversData = serversResponse.data || serversResponse;
      setAvailableServers(serversData);

      let finalVersion = version;
      if (!serversData[finalVersion] || serversData[finalVersion].length === 0) {
        const fallbacks = ['sub', 'dub', 'raw'];
        const found = fallbacks.find(v => serversData[v] && serversData[v].length > 0);
        if (found) { finalVersion = found; setStreamConfig(prev => ({ ...prev, version: found })); }
      }

      const targetServers = serversData[finalVersion];
      let serverToUse = serverOverride || streamConfig.server;
      const vidcloudExists = targetServers.find(s => s.serverName.toLowerCase() === 'vidcloud');
      
      if (!serverOverride && vidcloudExists) {
        serverToUse = 'vidcloud';
        setStreamConfig(prev => ({ ...prev, server: 'vidcloud' }));
      } else if (!targetServers.find(s => s.serverName.toLowerCase() === serverToUse.toLowerCase())) {
        serverToUse = targetServers[0].serverName.toLowerCase();
        setStreamConfig(prev => ({ ...prev, server: serverToUse }));
      }

      const raw = await fetchFromApi(`/api/kaido/sources/${episodeId}?version=${finalVersion}&server=${serverToUse}`);
      setStreamData({ ...(raw.data || raw), episodeId, episodeNum: epNum });
      setSelectedEpisode(episodeId);
      setView('watch');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleProxySwitch = () => {
    setActiveProxyIndex(prev => (prev + 1) % M3U8_PROXIES.length);
    setProxyKey(prev => prev + 1);
  };

  const Section = ({ title, items, icon: Icon }) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="mb-12 px-4 md:px-12 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-3">
            <span className="w-1.5 h-8 bg-blue-600 rounded-full"></span>{Icon && <Icon className="w-6 h-6 text-blue-500" />}{title}
          </h2>
        </div>
        <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-6 scrollbar-hide">
          {items.map((item, idx) => item && <AnimeCard key={item.id} anime={item} index={idx} onClick={handleAnimeClick} />)}
        </div>
      </div>
    );
  };

  if (loading && !homeData) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-gray-500 font-bold animate-pulse tracking-widest uppercase text-[10px]">Initializing...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans selection:bg-blue-600 overflow-x-hidden">
      <style>{`
        @keyframes navSlideDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-nav-entry { animation: navSlideDown 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-slide-up { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-slide-up-fade { opacity: 0; animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .nav-hidden { transform: translateY(-100%); transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .nav-visible { transform: translateY(0); transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .spotlight-transition { transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>

      {/* HEADER */}
      <nav className={`fixed top-0 w-full z-50 bg-gray-950/90 backdrop-blur-xl border-b border-white/5 animate-nav-entry ${showHeader ? 'nav-visible' : 'nav-hidden'}`}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-white/5 rounded-lg lg:hidden"><Menu className="w-6 h-6" /></button>
            <div onClick={() => { setView('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-2xl font-black text-blue-500 cursor-pointer flex items-center gap-2 group">
              <Zap className="w-7 h-7 fill-current text-blue-400 transition-transform group-hover:scale-110" />
              <span className="hidden sm:inline tracking-tighter uppercase font-black italic">VidStream</span>
            </div>
          </div>
          <form onSubmit={handleSearch} className="flex-1 max-w-xl relative group">
            <input type="text" placeholder="Search Vidcloud node..." className="w-full bg-gray-900/50 border border-white/10 rounded-xl py-2 px-10 focus:outline-none focus:border-blue-600/50 focus:bg-gray-900 transition-all text-sm font-medium" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500" />
          </form>
          <div className="hidden lg:flex items-center gap-4 animate-fade-in">
            <button onClick={handleInstallApp} className="flex items-center gap-2 text-[10px] font-black bg-blue-600/10 text-blue-400 px-3 py-1.5 rounded-full border border-blue-500/20 hover:bg-blue-600 hover:text-white transition-all shadow-[0_0_20px_rgba(37,99,235,0.1)] group">
              <Smartphone className="w-3.5 h-3.5 group-hover:animate-bounce" /> DOWNLOAD APP
            </button>
            <div className="flex items-center gap-2 text-[10px] font-black bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-full border border-emerald-500/20"><ShieldCheck className="w-3 h-3" /> ADS-FREE</div>
            <button onClick={() => setView('home')} className="text-sm font-bold text-gray-400 hover:text-white flex items-center gap-2 transition-colors ml-2"><Home className="w-4 h-4" /> Home</button>
          </div>
        </div>
      </nav>

      <main className="pt-16">
        {view === 'home' && homeData && (
          <div className="animate-fade-in">
            {/* HERO / SPOTLIGHT SLIDER */}
            <div className="relative h-[65vh] md:h-[85vh] overflow-hidden group/slider">
              <div className="flex h-full spotlight-transition" style={{ transform: `translateX(-${activeSpotlight * 100}%)`, width: `${homeData.spotlightAnimes.length * 100}%` }}>
                {homeData.spotlightAnimes.map((anime, idx) => (
                  <div key={idx} className="relative w-full h-full flex-shrink-0">
                    <img src={anime.poster} className="w-full h-full object-cover" alt={anime.name} />
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/40 to-transparent"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent"></div>
                    <div className="absolute inset-0 flex flex-col justify-center px-4 md:px-12 max-w-4xl">
                      <div className={idx === activeSpotlight ? 'animate-slide-up' : 'opacity-0'}>
                        <div className="flex items-center gap-3 mb-4">
                          <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded flex items-center gap-1 uppercase tracking-tighter"><Zap className="w-3 h-3 fill-current" /> Vidcloud Powered</span>
                        </div>
                        <h1 className="text-4xl md:text-7xl font-black mb-6 line-clamp-2 leading-[1.1] uppercase tracking-tighter">{anime.name}</h1>
                        <p className="text-gray-300 text-sm md:text-lg line-clamp-3 mb-8 max-w-2xl leading-relaxed">{anime.description}</p>
                        <button onClick={() => handleAnimeClick(anime.id)} className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-xl font-black flex items-center gap-2 transition-all hover:scale-105 shadow-xl shadow-blue-600/20 w-fit"><Play className="w-6 h-6 fill-current" /> STREAM NOW</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* SLIDER CONTROLS */}
              <div className="absolute bottom-32 left-4 md:left-12 flex gap-3">
                {homeData.spotlightAnimes.map((_, idx) => (
                  <button key={idx} onClick={() => setActiveSpotlight(idx)} className={`h-1.5 rounded-full transition-all duration-500 ${idx === activeSpotlight ? 'w-12 bg-blue-600' : 'w-4 bg-white/20'}`} />
                ))}
              </div>
            </div>

            {/* SECTIONS */}
            <div className="-mt-24 relative z-10 space-y-4">
              <Section title="Trending Today" items={homeData.trendingAnimes} icon={TrendingUp} />
              <Section title="Recently Updated" items={homeData.latestEpisodeAnimes} icon={Clock} />
              <Section title="Most Popular" items={homeData.mostPopularAnimes} icon={Star} />
              <Section title="Seasonal Airing" items={homeData.topAiringAnimes} icon={Tv} />
            </div>
          </div>
        )}

        {/* DETAILS, SEARCH, AND WATCH VIEWS... */}
        {view === 'search' && (
          <div className="p-6 md:p-12 animate-slide-up"><h2 className="text-3xl font-black mb-10 flex items-center gap-4"><Search className="w-8 h-8 text-blue-600" /> Results for "{searchQuery}"</h2><div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">{searchResults?.map((anime, idx) => anime && <AnimeCard key={anime.id} anime={anime} index={idx} onClick={handleAnimeClick} />)}</div></div>
        )}

        {view === 'details' && selectedAnime && (
          <div className="animate-fade-in pb-20">
            <div className="relative h-[45vh] overflow-hidden"><img src={selectedAnime.posterImage || selectedAnime.poster} className="w-full h-full object-cover blur-3xl opacity-30 scale-110" alt="" /><div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/80 to-transparent"></div></div>
            <div className="max-w-7xl mx-auto px-4 -mt-[30vh] relative z-10">
              <div className="flex flex-col lg:flex-row gap-12">
                <div className="w-full lg:w-80 flex-shrink-0 animate-slide-up"><div className="sticky top-24"><img src={selectedAnime.posterImage || selectedAnime.poster} className="w-full aspect-[2/3] object-cover rounded-2xl shadow-2xl border border-white/10" alt={selectedAnime.name} /></div></div>
                <div className="flex-1 py-4 animate-slide-up">
                  <button onClick={() => setView('home')} className="mb-6 flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-sm font-bold uppercase tracking-widest"><ArrowLeft className="w-4 h-4" /> Home</button>
                  <h1 className="text-4xl md:text-6xl font-black mb-6 leading-tight">{selectedAnime.name}</h1>
                  <p className="text-gray-300 text-lg leading-relaxed mb-10 max-w-4xl">{selectedAnime.synopsis || selectedAnime.description}</p>
                  
                  <div className="bg-gray-900/40 rounded-3xl border border-white/5 overflow-hidden">
                    <div className="p-8 border-b border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
                      <h3 className="text-xl font-black flex items-center gap-3"><Play className="w-5 h-5 text-blue-500 fill-current" />Episodes</h3>
                      <div className="flex items-center gap-2 bg-gray-950 p-1 rounded-xl border border-white/5">
                        <button onClick={() => setStreamConfig(prev => ({...prev, version: 'sub'}))} className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${streamConfig.version === 'sub' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>SUB</button>
                        <button onClick={() => setStreamConfig(prev => ({...prev, version: 'dub'}))} className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${streamConfig.version === 'dub' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>DUB</button>
                      </div>
                    </div>
                    <div className="p-8 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 xl:grid-cols-10 gap-3">
                      {(selectedAnime.providerEpisodes || []).map((ep) => (
                        <button key={ep.episodeId} onClick={() => handleWatch(selectedAnime.id, ep.episodeId, ep.episodeNumber)} className="aspect-square flex flex-col items-center justify-center bg-gray-950 border border-white/5 hover:bg-blue-600 rounded-xl transition-all hover:scale-105 group">
                          <span className="text-lg font-black">{ep.episodeNumber}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'watch' && streamData && (
          <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col xl:flex-row gap-8 animate-fade-in">
            <div className="flex-1">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4 animate-slide-up">
                <button onClick={() => setView('details')} className="flex items-center gap-2 text-gray-400 hover:text-white transition-all font-bold text-sm uppercase tracking-widest"><ArrowLeft className="w-5 h-5" /> Info</button>
                <div className="flex items-center gap-3">
                   <div className="flex items-center gap-2 bg-gray-900 px-4 py-2 rounded-lg border border-white/5 text-xs font-black"><span className="text-gray-500 uppercase tracking-tighter">Episode</span><span className="text-blue-500 text-lg">{streamData.episodeNum}</span></div>
                   <button onClick={handleProxySwitch} className="bg-gray-900 p-2.5 rounded-lg border border-white/5 hover:bg-white/5 transition-colors group"><RefreshCw className="w-4 h-4 text-gray-400 group-active:rotate-180 transition-transform" /></button>
                </div>
              </div>

              <VideoPlayer key={`${selectedEpisode}-${proxyKey}-${streamConfig.version}-${streamConfig.server}`} sourceUrl={streamData.sources?.[0]?.url} subtitles={streamData.subtitles} onNextProxy={handleProxySwitch} proxyIndex={activeProxyIndex} proxyKey={proxyKey} />

              <div className="mt-10 space-y-8 animate-slide-up">
                <h1 className="text-3xl font-black mb-4">{selectedAnime?.name}</h1>
                <div className="p-8 bg-gray-900/40 rounded-3xl border border-white/5 space-y-8">
                  <div>
                    <h4 className="text-xs font-black mb-4 uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2"><Settings className="w-4 h-4" /> Provider Nodes</h4>
                    <div className="flex flex-wrap gap-3">
                      {(availableServers[streamConfig.version] || []).map(server => (
                        <button key={server.serverName} onClick={() => handleWatch(selectedAnime.id, selectedEpisode, streamData.episodeNum, streamConfig.version, server.serverName.toLowerCase())} className={`px-6 py-3 rounded-xl text-xs font-black transition-all border flex items-center gap-2 ${streamConfig.server === server.serverName.toLowerCase() ? 'bg-blue-600 border-blue-500 text-white shadow-xl scale-105' : 'bg-gray-950 border-white/5 text-gray-400 hover:border-blue-500/50 hover:text-gray-200'}`}>
                          {server.serverName.toLowerCase() === 'vidcloud' && <Zap className="w-3 h-3 text-yellow-400 fill-current" />}
                          {server.serverName.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="w-full xl:w-96 flex-shrink-0 animate-slide-up">
              <div className="bg-gray-900/50 rounded-3xl border border-white/5 overflow-hidden flex flex-col h-[700px] sticky top-24">
                <div className="p-6 border-b border-white/5 flex items-center justify-between"><h3 className="font-black">EPISODES</h3><span className="text-[10px] font-black text-gray-600 uppercase bg-gray-950 px-2 py-1 rounded">{selectedAnime?.providerEpisodes?.length || 0} EPS</span></div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                  {selectedAnime?.providerEpisodes?.map((ep) => (
                    <button key={ep.episodeId} onClick={() => handleWatch(selectedAnime.id, ep.episodeId, ep.episodeNumber)} className={`w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all ${selectedEpisode === ep.episodeId ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-white/5 text-gray-400'}`}>
                      <span className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl font-black text-sm ${selectedEpisode === ep.episodeId ? 'bg-white/20' : 'bg-gray-950'}`}>{ep.episodeNumber}</span>
                      <span className="text-sm font-bold line-clamp-1">{ep.title || `Episode ${ep.episodeNumber}`}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* INSTALL HELP MODAL */}
      {showInstallHelp && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowInstallHelp(false)}></div>
          <div className="relative bg-gray-900 border border-white/10 p-8 rounded-3xl max-w-sm w-full animate-zoom-in text-center">
            <div className="w-16 h-16 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto mb-6"><Download className="w-8 h-8 text-blue-500" /></div>
            <h3 className="text-xl font-black mb-4 uppercase italic">Install App</h3>
            <p className="text-sm text-gray-400 mb-8 leading-relaxed">
              To install this app on iOS/Safari:<br />
              <span className="text-white font-bold">1. Tap the Share icon <Share className="inline w-4 h-4 mb-1" /></span><br />
              <span className="text-white font-bold">2. Select "Add to Home Screen"</span>
            </p>
            <button onClick={() => setShowInstallHelp(false)} className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-xl font-black text-xs uppercase tracking-widest transition-all">Got it</button>
          </div>
        </div>
      )}

      {/* MOBILE MENU */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden animate-fade-in">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsSidebarOpen(false)}></div>
          <div className="absolute top-0 left-0 bottom-0 w-80 bg-gray-950 border-r border-white/5 p-8 flex flex-col gap-8 animate-nav-entry">
             <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-blue-500 italic">VIDSTREAM</span>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 bg-white/5 rounded-full"><X className="w-5 h-5 text-gray-500" /></button>
             </div>
             <nav className="flex flex-col gap-6">
                <button onClick={() => { setView('home'); setIsSidebarOpen(false); }} className="flex items-center gap-4 text-lg font-black text-gray-400 hover:text-white group">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 transition-colors"><Home className="w-6 h-6" /></div>
                  HOME
                </button>
                <button onClick={() => { handleInstallApp(); setIsSidebarOpen(false); }} className="flex items-center gap-4 text-lg font-black text-blue-400 group">
                  <div className="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center border border-blue-500/20 group-hover:bg-blue-600 group-hover:text-white transition-all"><Download className="w-6 h-6" /></div>
                  INSTALL APP
                </button>
             </nav>
          </div>
        </div>
      )}
    </div>
  );
}

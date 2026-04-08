import React, { useState, useEffect, useRef } from 'react';
import { Rocket, AlertCircle, RefreshCw } from 'lucide-react';
import { M3U8_PROXIES } from '../api';

const VideoPlayer = ({ sourceUrl, subtitles = [], onNextProxy, proxyIndex, proxyKey }) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !sourceUrl) {
      setIsLoading(false);
      return;
    }

    if (hlsRef.current) hlsRef.current.destroy();

    setError(null);
    setIsLoading(true);

    const currentProxy = M3U8_PROXIES[proxyIndex];
    const proxyUrl = `${currentProxy}${encodeURIComponent(sourceUrl)}&cache_bust=${proxyKey}`;

    const initHls = (url) => {
      if (window.Hls && window.Hls.isSupported()) {
        const hls = new window.Hls({
          manifestLoadingMaxRetry: 10,
          manifestLoadingRetryDelay: 1000,
          manifestLoadingTimeOut: 20000,
          levelLoadingMaxRetry: 5,
          xhrSetup: (xhr) => { xhr.withCredentials = false; }
        });
        
        hls.loadSource(url);
        hls.attachMedia(video);
        hlsRef.current = hls;

        hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          video.play().catch(() => {});
        });

        hls.on(window.Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            if (data.details === 'manifestLoadError' || data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
              onNextProxy();
            } else {
              hls.recoverMediaError();
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.addEventListener('loadedmetadata', () => setIsLoading(false));
      }
    };

    if (!window.Hls) {
      const script = document.createElement('script');
      script.src = '[https://cdn.jsdelivr.net/npm/hls.js@latest](https://cdn.jsdelivr.net/npm/hls.js@latest)';
      script.async = true;
      script.onload = () => initHls(proxyUrl);
      document.head.appendChild(script);
    } else {
      initHls(proxyUrl);
    }

    return () => {
      if (hlsRef.current) hlsRef.current.destroy();
    };
  }, [sourceUrl, proxyIndex, proxyKey, onNextProxy]);

  return (
    <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-white/5 group animate-slide-up">
      {isLoading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950 z-10">
          <Rocket className="w-12 h-12 text-blue-500 animate-bounce mb-4" />
          <div className="text-center">
            <p className="text-sm font-bold text-gray-200 uppercase tracking-widest">Vidcloud Auto-Optimization</p>
            <p className="text-[10px] text-blue-400 mt-2 uppercase tracking-tighter font-black animate-pulse">Establishing Node {proxyIndex + 1}...</p>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/95 z-20 text-white p-6 text-center">
          <div className="max-w-md animate-in fade-in zoom-in-95 duration-300">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-sm text-gray-400 mb-8">{error}</p>
            <button onClick={() => onNextProxy()} className="px-8 py-3 bg-blue-600 rounded-xl text-xs font-black flex items-center gap-2 mx-auto transition-transform hover:scale-105 active:scale-95"><RefreshCw className="w-4 h-4" /> TRY NEXT NODE</button>
          </div>
        </div>
      )}

      <video ref={videoRef} controls className="w-full h-full" crossOrigin="anonymous" playsInline>
        {subtitles.map((sub, idx) => (
          <track key={idx} kind={sub.kind || 'captions'} label={sub.label} src={sub.file || sub.url} srcLang={sub.label?.toLowerCase().substring(0, 2)} default={sub.default} />
        ))}
      </video>
    </div>
  );
};

export default VideoPlayer;

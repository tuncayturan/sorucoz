"use client";

import { useState, useRef, useEffect } from "react";

interface VoiceMessageProps {
  audioUrl: string;
  isOwnMessage?: boolean;
  onDelete?: () => void;
}

export default function VoiceMessage({ audioUrl, isOwnMessage = false, onDelete }: VoiceMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Generate fixed waveform pattern once
  const waveformBarsRef = useRef(
    Array.from({ length: 40 }, (_, i) => {
      // Create a realistic wave pattern with varying heights
      const baseHeight = 30 + Math.sin(i * 0.3) * 25 + Math.cos(i * 0.7) * 18 + (i % 3) * 8;
      return {
        id: i,
        baseHeight: Math.max(25, Math.min(85, baseHeight)),
        delay: i * 0.03,
      };
    })
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const updateDuration = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, [audioUrl, isPlaying]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        console.error("Playback error:", err);
      });
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const waveformBars = waveformBarsRef.current;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="w-full max-w-full overflow-hidden">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      {/* Audio Player - No container, directly in message bubble */}
      <div className="flex items-center gap-2 md:gap-2.5 min-w-0 max-w-full">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlayPause}
          className={`flex-shrink-0 w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${
            isOwnMessage
              ? "bg-white/20 hover:bg-white/30 text-white"
              : "bg-gray-100 hover:bg-gray-200 text-gray-700"
          }`}
        >
          {isLoading ? (
            <div className={`w-3.5 h-3.5 md:w-4 md:h-4 border-2 ${isOwnMessage ? 'border-white' : 'border-gray-400'} border-t-transparent rounded-full animate-spin`}></div>
          ) : isPlaying ? (
            <svg className="w-4 h-4 md:w-4.5 md:h-4.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 md:w-4.5 md:h-4.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Waveform Visualization */}
        <div className="flex items-center gap-0.5 md:gap-0.5 flex-1 min-w-0 h-10 md:h-12 overflow-hidden max-w-full">
          {waveformBars.map((bar) => {
            const progressPoint = (bar.id / waveformBars.length) * duration;
            const isActive = currentTime >= progressPoint;
            
            // Animate height when playing - all active bars pulse during playback
            let barHeight = bar.baseHeight;
            if (isPlaying && isActive) {
              // Add pulsing animation to all active bars during playback
              const pulseSpeed = 15; // Animation speed
              const pulseFactor = 1.15 + Math.sin((currentTime * pulseSpeed) + (bar.id * 0.5)) * 0.25;
              barHeight = bar.baseHeight * pulseFactor;
            }
            // Ensure bar height stays within bounds
            barHeight = Math.max(bar.baseHeight * 0.8, Math.min(barHeight, bar.baseHeight * 1.5));
            
            return (
              <div
                key={bar.id}
                className={`w-1 md:w-1.5 flex-shrink-0 rounded-full transition-all duration-75 ${
                  isOwnMessage
                    ? isActive
                      ? "bg-white/90"
                      : "bg-white/35"
                    : isActive
                    ? "bg-blue-500"
                    : "bg-gray-300"
                }`}
                style={{
                  height: `${Math.min(barHeight, 100)}%`,
                  minHeight: "4px",
                  maxHeight: "100%",
                }}
              />
            );
          })}
        </div>

        {/* Time Display - Shows current time when playing, duration when stopped */}
        <span className={`text-[10px] md:text-xs font-semibold flex-shrink-0 whitespace-nowrap ${
          isOwnMessage ? "text-white/95" : "text-gray-700"
        }`}>
          {isPlaying ? formatTime(currentTime) : formatTime(duration)}
        </span>
      </div>
    </div>
  );
}

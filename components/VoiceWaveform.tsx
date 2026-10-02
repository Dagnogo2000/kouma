'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MicIcon } from '@/components/WhatsAppIcons';

interface VoiceWaveformProps {
  msgId: string;
  audioUrl: string;
  duration?: number;
  isMine: boolean;
  avatarLetter: string;
  avatarColor: string;
  onPlayStateChange?: (isPlaying: boolean) => void;
}

// Hauteurs prédéterminées pour un rendu visuel harmonieux d'onde vocale
const WAVEFORM_HEIGHTS = [
  6, 12, 18, 10, 22, 16, 28, 14, 20, 26,
  12, 24, 18, 10, 30, 22, 14, 18, 26, 16,
  24, 12, 20, 14, 28, 18, 10, 16, 12, 8
];

export function VoiceWaveform({
  audioUrl,
  duration = 0,
  isMine,
  avatarLetter,
  avatarColor,
  onPlayStateChange,
}: VoiceWaveformProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 1
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [currentSec, setCurrentSec] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const updateTime = () => {
      if (audio.duration) {
        setProgress(audio.currentTime / audio.duration);
        setCurrentSec(Math.floor(audio.currentTime));
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentSec(0);
      onPlayStateChange?.(false);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
    };
  }, [audioUrl, onPlayStateChange]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      onPlayStateChange?.(false);
    } else {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        onPlayStateChange?.(true);
      }).catch(console.error);
    }
  };

  const handleSeek = (index: number) => {
    if (!audioRef.current || !audioRef.current.duration) return;
    const targetRatio = index / WAVEFORM_HEIGHTS.length;
    audioRef.current.currentTime = targetRatio * audioRef.current.duration;
    setProgress(targetRatio);
    setCurrentSec(Math.floor(audioRef.current.currentTime));
  };

  const toggleSpeed = () => {
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const displayTime = isPlaying || progress > 0
    ? formatTime(currentSec)
    : formatTime(duration);

  return (
    <div className="flex items-center gap-3 py-1 select-none min-w-[240px] max-w-[320px]">
      {/* Avatar avec badge micro */}
      <div className="relative shrink-0">
        <div className={`w-11 h-11 rounded-full ${avatarColor} text-white font-bold flex items-center justify-center text-sm shadow-sm`}>
          {avatarLetter.toUpperCase()}
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#00a884] text-white flex items-center justify-center shadow">
          <MicIcon className="w-2.5 h-2.5" />
        </div>
      </div>

      {/* Bouton lecture/pause WhatsApp */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-sm ${
          isMine ? 'bg-[#00a884] text-white hover:bg-[#008f6f]' : 'bg-[#54656f] text-white hover:bg-[#41525d]'
        }`}
        title={isPlaying ? 'Pause' : 'Écouter la note vocale'}
      >
        {isPlaying ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 ml-0.5">
            <polygon points="6 4 20 12 6 20 6 4" />
          </svg>
        )}
      </button>

      {/* Onde sonore WhatsApp */}
      <div className="flex-1 flex flex-col justify-center">
        <div className="flex items-center gap-[2px] h-8 cursor-pointer py-1" title="Cliquer pour naviguer dans l'audio">
          {WAVEFORM_HEIGHTS.map((height, idx) => {
            const barProgress = idx / WAVEFORM_HEIGHTS.length;
            const isFilled = barProgress <= progress;

            return (
              <div
                key={idx}
                onClick={() => handleSeek(idx)}
                style={{ height: `${height}px` }}
                className={`w-[3px] rounded-full transition-colors hover:scale-y-125 ${
                  isFilled
                    ? (isMine ? 'bg-[#00a884]' : 'bg-[#00a884]')
                    : (isMine ? 'bg-[#98a39d]' : 'bg-[#b6c2c8]')
                }`}
              />
            );
          })}
        </div>

        {/* Temps et sélecteur de vitesse */}
        <div className="flex items-center justify-between text-[11px] text-[#667781] mt-0.5 font-medium">
          <span>{displayTime}</span>
          <button
            type="button"
            onClick={toggleSpeed}
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/5 hover:bg-black/10 transition-colors"
            title="Modifier la vitesse de lecture"
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
}

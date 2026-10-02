'use client';

import React, { useState, useEffect, useRef } from 'react';

export interface StoryStatus {
  id: string;
  name: string;
  avatarLetter: string;
  avatarColor: string;
  time: string;
  text?: string;
  imageUrl?: string;
  bgColor?: string;
  isMine?: boolean;
}

interface StatusViewerModalProps {
  statuses: StoryStatus[];
  initialIndex?: number;
  onClose: () => void;
  onReply?: (contactName: string, text: string) => void;
  onStatusViewed?: (statusId: string) => void;
}

const DEFAULT_GRADIENTS = [
  'from-emerald-600 to-teal-800',
  'from-indigo-600 to-purple-800',
  'from-amber-500 to-orange-700',
  'from-rose-600 to-pink-800',
  'from-blue-600 to-cyan-800',
];

export function StatusViewerModal({
  statuses,
  initialIndex = 0,
  onClose,
  onReply,
  onStatusViewed,
}: StatusViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [reactionSent, setReactionSent] = useState<string | null>(null);

  const durationMs = 5000;
  const currentStatus = statuses[currentIndex];
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-progression
  useEffect(() => {
    if (isPaused) return;

    const interval = 50;
    const step = (interval / durationMs) * 100;

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (currentIndex < statuses.length - 1) {
            setCurrentIndex((i) => i + 1);
            return 0;
          } else {
            onClose();
            return 100;
          }
        }
        return prev + step;
      });
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, isPaused, statuses.length, onClose]);

  // Réinitialiser la barre au changement de statut + marquer comme vu
  useEffect(() => {
    setProgress(0);
    setReactionSent(null);
    // Signaler le statut actuellement affiché comme vu
    const status = statuses[currentIndex];
    if (status && onStatusViewed) {
      onStatusViewed(status.id);
    }
  }, [currentIndex, statuses, onStatusViewed]);

  // Clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === ' ') setIsPaused((p) => !p);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleNext = () => {
    if (currentIndex < statuses.length - 1) {
      setCurrentIndex((i) => i + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setProgress(0);
    }
  };

  const handleSendReaction = (emoji: string) => {
    setReactionSent(emoji);
    if (onReply && currentStatus) {
      onReply(currentStatus.name, `A réagi ${emoji} au statut`);
    }
    setTimeout(() => setReactionSent(null), 2000);
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !currentStatus) return;
    if (onReply) {
      onReply(currentStatus.name, `Réponse au statut : "${replyText.trim()}"`);
    }
    setReplyText('');
    setReactionSent('Envoyé !');
    setTimeout(() => setReactionSent(null), 1500);
  };

  if (!currentStatus) return null;

  const bgGradient = currentStatus.bgColor || DEFAULT_GRADIENTS[currentIndex % DEFAULT_GRADIENTS.length];

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0b141a] flex flex-col justify-between items-center select-none"
      onMouseDown={() => setIsPaused(true)}
      onMouseUp={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      {/* BARRE DE PROGRESSION SUPÉRIEURE */}
      <div className="w-full max-w-lg px-4 pt-4 z-20">
        <div className="flex gap-1.5 h-1 w-full">
          {statuses.map((_, idx) => (
            <div key={idx} className="flex-1 bg-white/30 rounded-full h-full overflow-hidden">
              <div
                className="bg-white h-full transition-all duration-75"
                style={{
                  width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* EN-TÊTE AVATAR ET NOM */}
        <div className="flex items-center justify-between mt-3 text-white">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${currentStatus.avatarColor} flex items-center justify-center font-bold text-sm shadow ring-2 ring-white/60`}>
              {currentStatus.avatarLetter.toUpperCase()}
            </div>
            <div>
              <h4 className="text-sm font-bold leading-tight">{currentStatus.name}</h4>
              <p className="text-[11px] text-white/70">{currentStatus.time}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              title={isPaused ? 'Reprendre' : 'Pause'}
            >
              {isPaused ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 ml-0.5">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              )}
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              title="Fermer"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* CONTENU PRINCIPAL DU STATUT */}
      <div className="flex-1 w-full max-w-lg flex items-center justify-center px-6 relative my-auto">
        {/* Navigation gauche/droite invisible + boutons */}
        <button
          onClick={(e) => { e.stopPropagation(); handlePrev(); }}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white/80 hover:text-white flex items-center justify-center z-20 hover:scale-110 transition-transform"
          disabled={currentIndex === 0}
        >
          ‹
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleNext(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white/80 hover:text-white flex items-center justify-center z-20 hover:scale-110 transition-transform"
        >
          ›
        </button>

        {currentStatus.imageUrl ? (
          // Statut Image
          <div className="relative max-h-[70vh] rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={currentStatus.imageUrl} alt="Statut" className="max-h-[70vh] w-auto object-contain" />
            {currentStatus.text && (
              <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-sm p-4 text-white text-center text-base">
                {currentStatus.text}
              </div>
            )}
          </div>
        ) : (
          // Statut Texte avec fond dégradé WhatsApp
          <div className={`w-full aspect-[4/5] rounded-3xl bg-gradient-to-br ${bgGradient} p-8 flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden border border-white/10`}>
            <div className="absolute top-4 right-4 text-white/20 text-4xl">❝</div>
            <p className="text-2xl sm:text-3xl font-extrabold text-white leading-relaxed tracking-wide drop-shadow-md whitespace-pre-wrap max-w-md">
              {currentStatus.text || 'Statut WhatsApp Kouma'}
            </p>
            <div className="absolute bottom-4 left-4 text-xs text-white/60 font-medium">
              WhatsApp Kouma Status
            </div>
          </div>
        )}

        {/* Animation feedback réaction */}
        {reactionSent && (
          <div className="absolute z-30 animate-bounce bg-white/20 backdrop-blur-md px-6 py-3 rounded-full text-white text-2xl font-bold border border-white/30 shadow-2xl">
            {reactionSent}
          </div>
        )}
      </div>

      {/* PIED DE PAGE : RÉACTIONS ET RÉPONSE */}
      <div className="w-full max-w-lg p-4 z-20 space-y-3">
        {/* Émojis rapides */}
        <div className="flex justify-center gap-4 py-1">
          {['❤️', '😂', '😮', '👏', '🇨🇮', '🔥'].map((emoji) => (
            <button
              key={emoji}
              onClick={(e) => { e.stopPropagation(); handleSendReaction(emoji); }}
              className="text-2xl hover:scale-135 active:scale-95 transition-transform bg-white/10 hover:bg-white/20 rounded-full w-11 h-11 flex items-center justify-center shadow"
              title={`Réagir avec ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Input de réponse */}
        <form onSubmit={handleSendReply} className="flex items-center gap-2 bg-white/15 backdrop-blur-md rounded-full px-4 py-2 border border-white/20">
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onFocus={() => setIsPaused(true)}
            onBlur={() => setIsPaused(false)}
            placeholder={`Répondre à ${currentStatus.name}...`}
            className="flex-1 bg-transparent text-white placeholder-white/60 text-sm focus:outline-none"
          />
          <button
            type="submit"
            disabled={!replyText.trim()}
            className="w-8 h-8 rounded-full bg-[#00a884] text-white flex items-center justify-center hover:bg-[#008f6f] disabled:opacity-50 transition-all shrink-0"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

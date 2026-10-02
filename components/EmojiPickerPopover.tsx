'use client';

import React, { useState, useRef, useEffect } from 'react';

interface EmojiPickerPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
}

const EMOJI_CATEGORIES = [
  {
    name: 'Populaires & Afrique',
    icon: '🇨🇮',
    emojis: ['🇨🇮', '🇧🇫', '🇲🇱', '🇫🇷', '❤️', '🔥', '✨', '🙏', '👏', '💪', '🤝', '⭐'],
  },
  {
    name: 'Visages & Émotions',
    icon: '😊',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
      '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
      '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
      '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
      '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
      '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓',
    ],
  },
  {
    name: 'Mains & Gestes',
    icon: '👍',
    emojis: [
      '👍', '👎', '👌', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈',
      '👉', '👆', '🖕', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖',
      '🫱', '🫲', '🫸', '🫷', '🤝', '🙏', '✍️', '💅', '🤳', '💪',
    ],
  },
  {
    name: 'Symboles & Cœurs',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
      '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐',
      '💯', '💢', '💬', '👁️‍🗨️', '🗯️', '💭', '💤', '💥', '💫', '⚡',
    ],
  },
];

export function EmojiPickerPopover({
  isOpen,
  onClose,
  onSelectEmoji,
}: EmojiPickerPopoverProps) {
  const [activeCategory, setActiveCategory] = useState(0);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-14 left-2 z-40 bg-white rounded-2xl shadow-2xl border border-[#e9edef] w-72 sm:w-80 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150"
    >
      {/* ONGLETS DES CATÉGORIES */}
      <div className="flex items-center justify-around bg-[#f0f2f5] p-1.5 border-b border-[#e9edef]">
        {EMOJI_CATEGORIES.map((cat, idx) => (
          <button
            key={cat.name}
            type="button"
            onClick={() => setActiveCategory(idx)}
            className={`w-9 h-8 rounded-lg flex items-center justify-center text-lg transition-colors ${
              activeCategory === idx ? 'bg-white shadow-sm' : 'hover:bg-black/5 opacity-70'
            }`}
            title={cat.name}
          >
            {cat.icon}
          </button>
        ))}
      </div>

      {/* TITRE CATÉGORIE ACTIVE */}
      <div className="px-3 py-1.5 text-[11px] font-bold text-[#667781] bg-[#f8faf9] border-b border-[#f0f2f5]">
        {EMOJI_CATEGORIES[activeCategory].name}
      </div>

      {/* GRILLE D'EMOJIS */}
      <div className="p-2 grid grid-cols-7 sm:grid-cols-8 gap-1 max-h-48 overflow-y-auto">
        {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelectEmoji(emoji)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xl hover:bg-[#f0f2f5] hover:scale-125 transition-transform"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

// Barre de réactions rapides au survol d'un message
interface MessageReactionPillProps {
  onReact: (emoji: string) => void;
  isMine: boolean;
}

export function MessageReactionPill({ onReact, isMine }: MessageReactionPillProps) {
  const quickReactions = ['❤️', '👍', '😂', '😮', '😢', '🙏', '🇨🇮'];

  return (
    <div
      className={`absolute -top-7 ${isMine ? 'right-2' : 'left-2'} z-20 bg-white rounded-full shadow-lg border border-[#e9edef] px-2 py-0.5 flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100`}
    >
      {quickReactions.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onReact(emoji);
          }}
          className="text-sm hover:scale-135 transition-transform p-0.5"
          title={emoji}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

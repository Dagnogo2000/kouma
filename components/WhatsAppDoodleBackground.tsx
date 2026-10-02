'use client';

import React from 'react';

export function WhatsAppDoodleBackground() {
  return (
    <div
      className="absolute inset-0 pointer-events-none opacity-[0.06] select-none"
      style={{
        backgroundImage: `radial-gradient(#00a884 0.75px, transparent 0.75px), radial-gradient(#111b21 0.75px, #efeae2 0.75px)`,
        backgroundSize: '30px 30px',
        backgroundPosition: '0 0, 15px 15px',
      }}
    >
      {/* Motifs géométriques et symboles WhatsApp subtils */}
      <svg className="w-full h-full opacity-60" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="waDoodle" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
            {/* Bulle de discussion */}
            <path d="M20 20 h20 a5 5 0 0 1 5 5 v10 a5 5 0 0 1 -5 5 h-15 l-5 5 v-5 a5 5 0 0 1 -5 -5 v-10 a5 5 0 0 1 5 -5 z" fill="none" stroke="#000" strokeWidth="1.2" />
            {/* Note de musique */}
            <path d="M80 30 v15 a4 4 0 1 1 -4 -4 h4" fill="none" stroke="#000" strokeWidth="1.2" />
            {/* Caméra */}
            <rect x="75" y="75" width="22" height="16" rx="3" fill="none" stroke="#000" strokeWidth="1.2" />
            <circle cx="86" cy="83" r="4" fill="none" stroke="#000" strokeWidth="1" />
            {/* Cœur */}
            <path d="M25 80 a4 4 0 0 1 6 0 l2 2 l2 -2 a4 4 0 0 1 6 6 l-8 8 l-8 -8 a4 4 0 0 1 0 -6 z" fill="none" stroke="#000" strokeWidth="1.2" />
            {/* Téléphone */}
            <path d="M50 45 c2 4 5 7 9 9 l3 -3 c1 -1 2 -1 3 0 l4 2 c1 1 1 2 0 3 l-3 3 c-8 0 -15 -7 -15 -15 l3 -3 c1 -1 2 -1 3 0 l2 4 c1 1 0 2 -1 3 z" fill="none" stroke="#000" strokeWidth="1" />
            {/* Étoile */}
            <polygon points="50,95 52,100 58,100 53,103 55,108 50,105 45,108 47,103 42,100 48,100" fill="none" stroke="#000" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#waDoodle)" />
      </svg>
    </div>
  );
}

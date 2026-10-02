'use client';

import React from 'react';
import { LockIcon, CallsIcon, CameraIcon } from '@/components/WhatsAppIcons';

interface ContactInfoDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  contact: {
    id: string;
    username: string;
    email?: string;
    language?: 'fr' | 'dyu';
  };
  avatarColor: string;
  sharedMediaUrls: string[];
  isMuted: boolean;
  onToggleMute: () => void;
  autoTranslate: boolean;
  onToggleAutoTranslate: () => void;
  onStartCall: (isVideo: boolean) => void;
  onClearChat?: () => void;
}

export function ContactInfoDrawer({
  isOpen,
  onClose,
  contact,
  avatarColor,
  sharedMediaUrls,
  isMuted,
  onToggleMute,
  autoTranslate,
  onToggleAutoTranslate,
  onStartCall,
  onClearChat,
}: ContactInfoDrawerProps) {
  if (!isOpen) return null;

  return (
    <aside className="w-[340px] sm:w-[380px] bg-white border-l border-[#e9edef] flex flex-col shrink-0 h-full overflow-y-auto animate-in slide-in-from-right duration-200 z-30">
      {/* EN-TÊTE DU VOLET */}
      <div className="h-16 px-4 bg-[#f0f2f5] border-b border-[#e9edef] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-[#e9edef] flex items-center justify-center text-[#54656f]"
            title="Fermer"
          >
            ✕
          </button>
          <h3 className="text-base font-semibold text-[#111b21]">Infos du contact</h3>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* CARTE PROFIL */}
        <div className="bg-white p-5 rounded-2xl border border-[#e9edef] flex flex-col items-center text-center shadow-sm">
          <div className={`w-28 h-28 rounded-full ${avatarColor} text-white font-extrabold text-4xl flex items-center justify-center shadow-md mb-3`}>
            {(contact.username || 'U')[0].toUpperCase()}
          </div>
          <h2 className="text-lg font-bold text-[#111b21]">{contact.username}</h2>
          <p className="text-xs text-[#667781] mt-0.5">{contact.email || 'Utilisateur Kouma'}</p>

          {/* Boutons d'actions rapides : Audio / Vidéo */}
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[#f0f2f5] w-full justify-center">
            <button
              onClick={() => onStartCall(false)}
              className="flex flex-col items-center gap-1 text-[#00a884] hover:opacity-80"
            >
              <div className="w-10 h-10 rounded-full bg-[#00a884]/10 flex items-center justify-center">
                <CallsIcon className="w-5 h-5 text-[#00a884]" />
              </div>
              <span className="text-[11px] font-semibold">Audio</span>
            </button>
            <button
              onClick={() => onStartCall(true)}
              className="flex flex-col items-center gap-1 text-[#00a884] hover:opacity-80"
            >
              <div className="w-10 h-10 rounded-full bg-[#00a884]/10 flex items-center justify-center">
                <CameraIcon className="w-5 h-5 text-[#00a884]" />
              </div>
              <span className="text-[11px] font-semibold">Vidéo</span>
            </button>
          </div>
        </div>

        {/* ACTU / BIO */}
        <div className="bg-white p-4 rounded-2xl border border-[#e9edef] space-y-1 shadow-sm">
          <span className="text-xs font-semibold text-[#667781]">Actu</span>
          <p className="text-sm text-[#111b21] font-medium">Disponible sur WhatsApp Kouma 🇨🇮 🇫🇷</p>
        </div>

        {/* PARAMÈTRES DE TRADUCTION BILINGUE */}
        <div className="bg-[#f8faf9] p-4 rounded-2xl border border-[#e9edef] space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-[#111b21] flex items-center gap-1.5">
                <span>🌐</span> Traduction Dioula ⇋ Français
              </h4>
              <p className="text-[11px] text-[#667781] mt-0.5">
                Langue parlée : {contact.language === 'dyu' ? '🇨🇮 Dioula' : '🇫🇷 Français'}
              </p>
            </div>
            <button
              onClick={onToggleAutoTranslate}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                autoTranslate ? 'bg-[#00a884]' : 'bg-[#e9edef]'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                  autoTranslate ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <p className="text-[11px] text-[#667781] bg-white p-2 rounded-lg border border-[#e9edef]">
            {autoTranslate
              ? '✨ La traduction automatique est active : vos messages sont traduits instantanément dans sa langue.'
              : 'Traductions automatiques désactivées pour cette discussion.'}
          </p>
        </div>

        {/* MÉDIAS, LIENS ET DOCUMENTS PARTAGÉS */}
        <div className="bg-white p-4 rounded-2xl border border-[#e9edef] space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#111b21]">Médias partagés</span>
            <span className="text-xs text-[#667781] font-semibold">{sharedMediaUrls.length}</span>
          </div>

          {sharedMediaUrls.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {sharedMediaUrls.slice(0, 6).map((url, i) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden bg-slate-100 border border-[#e9edef]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="Média" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#8696a0] italic">Aucune photo ni média partagé.</p>
          )}
        </div>

        {/* NOTIFICATIONS & CONFIDENTIALITÉ */}
        <div className="bg-white p-4 rounded-2xl border border-[#e9edef] space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#111b21]">Notifications en sourdine</span>
            <button
              onClick={onToggleMute}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                isMuted ? 'bg-[#00a884]' : 'bg-[#e9edef]'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                  isMuted ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <div className="flex items-start gap-2.5 pt-2 border-t border-[#f0f2f5] text-xs text-[#667781]">
            <LockIcon className="w-4 h-4 shrink-0 text-[#00a884] mt-0.5" />
            <span>Chiffrement de bout en bout : vos messages et appels vocaux restent strictement privés.</span>
          </div>
        </div>

        {/* ACTIONS DESTRUCTIVES / SÉCURITÉ */}
        <div className="space-y-2 pt-2">
          {onClearChat && (
            <button
              type="button"
              onClick={onClearChat}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors flex items-center justify-center gap-2"
            >
              Effacer les messages de cette discussion
            </button>
          )}
          <button
            type="button"
            onClick={() => alert(`Contact ${contact.username} bloqué.`)}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-[#667781] hover:bg-[#f0f2f5] border border-[#e9edef] transition-colors"
          >
            Bloquer {contact.username}
          </button>
        </div>
      </div>
    </aside>
  );
}

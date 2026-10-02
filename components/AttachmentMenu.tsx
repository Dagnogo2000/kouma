'use client';

import React, { useRef, useEffect } from 'react';
import { CameraIcon, DocumentIcon, AddContactIcon } from '@/components/WhatsAppIcons';

interface AttachmentMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPhoto: () => void;
  onSelectCamera: () => void;
  onSelectDocument: () => void;
  onSelectContact: () => void;
  onSelectPoll: () => void;
  onSelectDioulaPhrases: () => void;
}

export function AttachmentMenu({
  isOpen,
  onClose,
  onSelectPhoto,
  onSelectCamera,
  onSelectDocument,
  onSelectContact,
  onSelectPoll,
  onSelectDioulaPhrases,
}: AttachmentMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
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

  const items = [
    {
      id: 'document',
      label: 'Document',
      bg: 'bg-[#7f66ff]',
      icon: <DocumentIcon className="w-5 h-5 text-white" />,
      onClick: () => { onClose(); onSelectDocument(); },
    },
    {
      id: 'photos',
      label: 'Photos et vidéos',
      bg: 'bg-[#007bfc]',
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5-7l-3 3.72L9 13l-3 4h12l-4-5z"/>
        </svg>
      ),
      onClick: () => { onClose(); onSelectPhoto(); },
    },
    {
      id: 'camera',
      label: 'Caméra',
      bg: 'bg-[#ff2e74]',
      icon: <CameraIcon className="w-5 h-5 text-white" />,
      onClick: () => { onClose(); onSelectCamera(); },
    },
    {
      id: 'contact',
      label: 'Contact',
      bg: 'bg-[#009de2]',
      icon: <AddContactIcon className="w-5 h-5 text-white" />,
      onClick: () => { onClose(); onSelectContact(); },
    },
    {
      id: 'poll',
      label: 'Sondage',
      bg: 'bg-[#ffbc38]',
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
        </svg>
      ),
      onClick: () => { onClose(); onSelectPoll(); },
    },
    {
      id: 'dioula',
      label: 'Expressions Dioula',
      bg: 'bg-[#00a884]',
      icon: <span className="text-lg">🇨🇮</span>,
      onClick: () => { onClose(); onSelectDioulaPhrases(); },
    },
  ];

  return (
    <div
      ref={menuRef}
      className="absolute bottom-14 left-4 z-40 bg-white rounded-2xl shadow-2xl border border-[#e9edef] p-2 flex flex-col gap-1 w-52 animate-in fade-in slide-in-from-bottom-3 duration-150"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={item.onClick}
          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#f0f2f5] transition-colors text-left group"
        >
          <div className={`w-9 h-9 rounded-full ${item.bg} flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform`}>
            {item.icon}
          </div>
          <span className="text-xs font-semibold text-[#111b21]">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

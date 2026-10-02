'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { parseMessageContent, encodeMessageContent, type ParsedMessage } from '@/lib/message-helper';
import { soundEffects } from '@/lib/sounds';
import {
  ChatIcon, CallsIcon, StatusIcon, CommunitiesIcon, ArchiveIcon,
  MetaAiIcon, DocumentIcon, AddContactIcon, LockIcon, MoreVertIcon,
  MicIcon, CameraIcon, AttachIcon, SendIcon, DoubleCheckIcon, SingleCheckIcon, EmojiIcon
} from '@/components/WhatsAppIcons';
import { VoiceWaveform } from '@/components/VoiceWaveform';
import { StatusViewerModal, type StoryStatus } from '@/components/StatusViewerModal';
import { AttachmentMenu } from '@/components/AttachmentMenu';
import { ContactInfoDrawer } from '@/components/ContactInfoDrawer';
import { EmojiPickerPopover, MessageReactionPill } from '@/components/EmojiPickerPopover';
import { WhatsAppDoodleBackground } from '@/components/WhatsAppDoodleBackground';
import type { User, RealtimeChannel } from '@supabase/supabase-js';

interface Message {
  id: string;
  sender_id: string;
  receiver_id?: string | null;
  content: string;
  created_at: string;
}

interface Profile {
  id: string;
  username: string;
  email?: string;
  language?: 'fr' | 'dyu';
  last_seen?: string;
}

interface CallLog {
  id: string;
  name: string;
  time: string;
  type: 'incoming' | 'outgoing' | 'missed';
  isVideo: boolean;
}

const QUICK_DIOULA_EXPRESSIONS = [
  { dyu: 'I ni sogoma', fr: 'Bonjour' },
  { dyu: 'I ka kene wa ?', fr: 'Comment vas-tu ?' },
  { dyu: 'Toro te', fr: 'Tout va bien' },
  { dyu: 'I ni ce', fr: 'Merci' },
  { dyu: 'K\'an ben', fr: 'À bientôt / Au revoir' },
  { dyu: 'I ni baara', fr: 'Bon travail' },
  { dyu: 'Haketo', fr: 'Pardon / Excuse-moi' },
  { dyu: 'Ayo', fr: 'Oui / D\'accord' },
  { dyu: 'Ayi', fr: 'Non' },
  { dyu: 'Ne be na', fr: 'J\'arrive' },
];

const COMMUNITY_CHAT: Profile = {
  id: '__community__',
  username: 'Kouma Communauté',
  language: 'fr',
};

function getLocalUsers(): Profile[] {
  try {
    return JSON.parse(localStorage.getItem('kouma_all_users') || '[]');
  } catch { return []; }
}

function saveLocalUser(user: Profile) {
  const users = getLocalUsers();
  const exists = users.some((u) => u.id === user.id);
  if (!exists) {
    users.push(user);
    localStorage.setItem('kouma_all_users', JSON.stringify(users));
  } else {
    const updated = users.map((u) => u.id === user.id ? { ...u, ...user } : u);
    localStorage.setItem('kouma_all_users', JSON.stringify(updated));
  }
}

function formatLastSeen(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 60000) return "à l'instant";
    const isToday = d.toDateString() === now.toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `aujourd'hui à ${timeStr}`;
    const yesterday = new Date(now.getTime() - 86400000);
    if (d.toDateString() === yesterday.toDateString()) return `hier à ${timeStr}`;
    return `le ${d.toLocaleDateString([], { day: '2-digit', month: '2-digit' })} à ${timeStr}`;
  } catch {
    return 'récemment';
  }
}

async function broadcastMyPresence(currentUser: User, username: string, lang: string) {
  try {
    await supabase.from('profiles').upsert({
      id: currentUser.id,
      username,
      email: currentUser.email,
      language: lang,
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('Erreur broadcast présence:', err);
  }
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [allContacts, setAllContacts] = useState<Profile[]>([]);
  // IDs des utilisateurs avec qui on a réellement échangé des messages
  const [conversationPartnerIds, setConversationPartnerIds] = useState<Set<string>>(new Set());
  // Dernier message par conversation pour la sidebar
  const [lastMessagesByContact, setLastMessagesByContact] = useState<Record<string, { text: string; time: string; isMine: boolean }>>({});
  // Compteur de messages non lus par contact
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  // Utilisateurs en ligne en temps réel
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  // Date de dernière déconnexion par utilisateur
  const [lastSeenByUser, setLastSeenByUser] = useState<Record<string, string>>({});
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  // Ref to track selectedUser without causing effect re-runs
  const selectedUserRef = useRef<Profile | null>(null);

  const [activeTab, setActiveTab] = useState<'chats' | 'calls' | 'status' | 'communities' | 'archived' | 'ai'>('chats');
  const [filterTab, setFilterTab] = useState<'all' | 'unread' | 'favorites' | 'groups'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [myLang, setMyLang] = useState<'fr' | 'dyu'>('fr');
  const [myUsername, setMyUsername] = useState('');
  const [autoTranslate, setAutoTranslate] = useState(true);

  // Modales et Volets
  const [showSettings, setShowSettings] = useState(false);
  const [showQuickPhrases, setShowQuickPhrases] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showNewStatusModal, setShowNewStatusModal] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [showChatsMenu, setShowChatsMenu] = useState(false);
  const chatsMenuRef = useRef<HTMLDivElement>(null);

  // IDs des statuts déjà vus (anneau vert retiré)
  const [viewedStatusIds, setViewedStatusIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('kouma_viewed_statuses') || '[]'); } catch { return []; }
  });

  const [activeCallModal, setActiveCallModal] = useState<{ name: string; isVideo: boolean; duration: number } | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [expandedOriginals, setExpandedOriginals] = useState<Record<string, boolean>>({});

  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [mutedContactIds, setMutedContactIds] = useState<string[]>([]);
  const [messageReactions, setMessageReactions] = useState<Record<string, Record<string, number>>>({});

  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Enregistrement vocal
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fichiers et images
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [imageCaption, setImageCaption] = useState('');
  const [isViewOnceSelected, setIsViewOnceSelected] = useState(false);
  const [openedViewOnceIds, setOpenedViewOnceIds] = useState<Record<string, boolean>>({});
  const [activeViewOnceModal, setActiveViewOnceModal] = useState<string | null>(null);

  // Visionneuse de statuts
  const [viewingStatuses, setViewingStatuses] = useState<StoryStatus[] | null>(null);
  const [statusInitialIndex, setStatusInitialIndex] = useState(0);
  const [statuses, setStatuses] = useState<StoryStatus[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem('kouma_user_statuses') || '[]');
    } catch {
      return [];
    }
  });
  const [newStatusText, setNewStatusText] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('from-emerald-600 to-teal-800');

  // Appels
  const [callLogs] = useState<CallLog[]>([
    { id: '1', name: 'Eloise Moov', time: 'Aujourd\'hui 00:45', type: 'incoming', isVideo: false },
    { id: '2', name: 'Mon Ami D\'enfance', time: 'Hier 19:20', type: 'missed', isVideo: true },
    { id: '3', name: 'Famille DAGNOGO', time: 'Hier 14:10', type: 'outgoing', isVideo: false },
  ]);

  // Kouma AI
  const [aiMessages, setAiMessages] = useState<Array<{ sender: 'ai' | 'user'; text: string }>>([
    { sender: 'ai', text: 'Bonjour ! Je suis Kouma AI, votre assistant bilingue Dioula ⇋ Français. Posez-moi vos questions ou demandez-moi de traduire n\'importe quelle phrase !' }
  ]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  // =================== CHARGEMENT DES PRÉFÉRENCES ===================
  useEffect(() => {
    const savedLang = localStorage.getItem('kouma_lang') as 'fr' | 'dyu' | null;
    if (savedLang) setMyLang(savedLang);
    const savedKey = localStorage.getItem('kouma_gemini_key');
    if (savedKey) setGeminiApiKey(savedKey);
    const savedViewOnce = localStorage.getItem('kouma_opened_view_once');
    if (savedViewOnce) { try { setOpenedViewOnceIds(JSON.parse(savedViewOnce)); } catch {} }
    const savedArchived = localStorage.getItem('kouma_archived');
    if (savedArchived) { try { setArchivedIds(JSON.parse(savedArchived)); } catch {} }
    const savedFav = localStorage.getItem('kouma_favorites');
    if (savedFav) { try { setFavoriteIds(JSON.parse(savedFav)); } catch {} }
    const savedMuted = localStorage.getItem('kouma_muted');
    if (savedMuted) { try { setMutedContactIds(JSON.parse(savedMuted)); } catch {} }
    const savedReactions = localStorage.getItem('kouma_reactions');
    if (savedReactions) { try { setMessageReactions(JSON.parse(savedReactions)); } catch {} }
  }, []);

  // Timer pour appel actif
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (activeCallModal) {
      soundEffects.startRinging();
      timer = setInterval(() => {
        setActiveCallModal((prev) => prev ? { ...prev, duration: prev.duration + 1 } : null);
      }, 1000);
    } else {
      soundEffects.stopRinging();
    }
    return () => {
      soundEffects.stopRinging();
      if (timer) clearInterval(timer);
    };
  }, [Boolean(activeCallModal)]);

  // =================== CHARGEMENT DES MESSAGES ===================
  const loadMessages = useCallback(async (currentUserId: string, targetUserId: string | null) => {
    try {
      let query = supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (targetUserId && targetUserId !== '__community__') {
        query = query.or(
          `and(sender_id.eq.${currentUserId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${currentUserId})`
        );
      } else {
        query = query.is('receiver_id', null);
      }

      const { data, error } = await query;
      if (!error && data) setMessages(data as Message[]);
      else if (error) console.error('Erreur chargement messages:', error);
    } catch (err) { console.error('Erreur messages:', err); }
  }, []);

  // =================== CHARGEMENT DES CONTACTS ===================
  const loadAllContacts = useCallback(async (currentUserId: string): Promise<Profile[]> => {
    try {
      const localUsers = getLocalUsers().filter((u) => u.id !== currentUserId);
      const { data: profilesData, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', currentUserId);

      if (pErr) console.warn('Erreur chargement profiles:', pErr.message);

      const merged = new Map<string, Profile>();
      for (const u of [...localUsers, ...(profilesData || [])]) {
        if (u.id && u.id !== currentUserId) {
          merged.set(u.id, {
            id: u.id,
            username: u.username || u.email?.split('@')[0] || 'Utilisateur',
            email: u.email,
            language: u.language,
            last_seen: u.last_seen,
          });
          if (u.last_seen) {
            setLastSeenByUser((prev) => ({ ...prev, [u.id]: u.last_seen }));
          }
        }
      }

      const list = Array.from(merged.values());
      setAllContacts(list);
      return list;
    } catch (err) {
      console.warn('Erreur loadAllContacts:', err);
      return [];
    }
  }, []);

  // =================== CHARGEMENT DES PARTENAIRES DE CONVERSATION ===================
  const loadConversationPartners = useCallback(async (currentUserId: string, contactsList?: Profile[]) => {
    try {
      // Find all messages where I am sender or receiver (excluding community & presence)
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
        .not('receiver_id', 'is', null)
        .order('created_at', { ascending: false });

      if (error) { console.warn('Erreur partners:', error.message); return; }

      const partnerIds = new Set<string>();
      const lastMsgMap: Record<string, { text: string; time: string; isMine: boolean }> = {};

      for (const msg of data || []) {
        if (msg.receiver_id?.startsWith('__presence__')) continue;
        const partnerId = msg.sender_id === currentUserId ? msg.receiver_id : msg.sender_id;
        if (!partnerId || partnerId.startsWith('__')) continue;

        partnerIds.add(partnerId);

        if (!lastMsgMap[partnerId]) {
          let previewText = msg.content;
          try {
            const parsed = JSON.parse(msg.content);
            if (parsed.type === 'audio') previewText = '🎤 Message vocal';
            else if (parsed.type === 'image') previewText = '📷 Photo';
            else if (parsed.type === 'file') previewText = '📄 Fichier';
            else if (parsed.text) previewText = parsed.text;
          } catch {}
          const timeStr = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          lastMsgMap[partnerId] = {
            text: previewText,
            time: timeStr,
            isMine: msg.sender_id === currentUserId,
          };
        }
      }

      setConversationPartnerIds(partnerIds);
      setLastMessagesByContact((prev) => ({ ...prev, ...lastMsgMap }));

      // Auto-ouvrir la discussion la plus récente sur desktop ou s'il y a un seul contact
      if (!selectedUserRef.current && partnerIds.size > 0) {
        const isDesktop = typeof window !== 'undefined' ? window.innerWidth >= 768 : true;
        if (isDesktop || partnerIds.size === 1) {
          const firstPartnerId = Array.from(partnerIds)[0];
          const list = contactsList || allContacts;
          const found = list.find((c) => c.id === firstPartnerId);
          if (found) {
            selectedUserRef.current = found;
            setSelectedUser(found);
            loadMessages(currentUserId, found.id);
          }
        }
      }
    } catch (err) {
      console.warn('Erreur loadConversationPartners:', err);
    }
  }, [allContacts, loadMessages]);

  // =================== INITIALISATION SESSION ===================
  useEffect(() => {
    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          const savedLang = localStorage.getItem('kouma_lang') as 'fr' | 'dyu' | null || 'fr';
          // Try to load username from profile first
          const { data: profileData } = await supabase
            .from('profiles')
            .select('username, language')
            .eq('id', currentUser.id)
            .single();

          const defaultName = profileData?.username || currentUser.email?.split('@')[0] || 'Utilisateur';
          const defaultLang = (profileData?.language as 'fr' | 'dyu') || savedLang || 'fr';
          setMyUsername(defaultName);
          setMyLang(defaultLang);

          saveLocalUser({
            id: currentUser.id,
            username: defaultName,
            email: currentUser.email,
            language: defaultLang,
          });

          broadcastMyPresence(currentUser, defaultName, defaultLang).catch(console.warn);

          supabase.from('profiles').upsert({
            id: currentUser.id,
            username: defaultName,
            email: currentUser.email,
            language: defaultLang,
          }, { onConflict: 'id' }).then(({ error }) => { if (error) console.warn('Profiles upsert:', error); });

          const contacts = await loadAllContacts(currentUser.id);
          await loadConversationPartners(currentUser.id, contacts);
        }
      } catch (err) {
        console.error('Erreur init:', err);
      } finally {
        setLoading(false);
      }
    }

    init();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        const contacts = await loadAllContacts(currentUser.id);
        await loadConversationPartners(currentUser.id, contacts);
        // Use ref to avoid stale closure
        const currentSelected = selectedUserRef.current;
        if (currentSelected) {
          await loadMessages(currentUser.id, currentSelected.id === '__community__' ? null : currentSelected.id);
        }
      } else {
        setMessages([]);
        setAllContacts([]);
        setConversationPartnerIds(new Set());
        selectedUserRef.current = null;
        setSelectedUser(null);
      }
    });

    return () => { authListener.subscription.unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMessages, loadAllContacts, loadConversationPartners]);

  // =================== TEMPS RÉEL & PRÉSENCE EN LIGNE ===================
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('kouma_main', {
      config: {
        broadcast: { self: false },
        presence: { key: user.id },
      },
    });
    channelRef.current = channel;

    // Suivi de la présence en direct (En ligne / Vu à)
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const activeIds = new Set<string>();
        for (const [key, presences] of Object.entries(state)) {
          if (presences && presences.length > 0) {
            activeIds.add(key);
          }
        }
        setOnlineUserIds(activeIds);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        setOnlineUserIds((prev) => new Set(prev).add(key));
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        const nowIso = new Date().toISOString();
        setLastSeenByUser((prev) => ({ ...prev, [key]: nowIso }));
      });

    const handleIncoming = (newMsg: Message) => {
      if (newMsg.receiver_id?.startsWith('__presence__')) return;

      // If it's a private message for me or from me, update partner list and preview
      if (newMsg.receiver_id === user.id || newMsg.sender_id === user.id) {
        const partnerId = newMsg.sender_id === user.id ? newMsg.receiver_id : newMsg.sender_id;
        if (partnerId && !partnerId.startsWith('__')) {
          setConversationPartnerIds((prev) => {
            if (prev.has(partnerId)) return prev;
            const next = new Set(prev);
            next.add(partnerId);
            return next;
          });

          let previewText = newMsg.content;
          try {
            const parsed = JSON.parse(newMsg.content);
            if (parsed.type === 'audio') previewText = '🎤 Message vocal';
            else if (parsed.type === 'image') previewText = '📷 Photo';
            else if (parsed.type === 'file') previewText = '📄 Fichier';
            else if (parsed.text) previewText = parsed.text;
          } catch {}
          const timeStr = new Date(newMsg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          setLastMessagesByContact((prev) => ({
            ...prev,
            [partnerId]: {
              text: previewText,
              time: timeStr,
              isMine: newMsg.sender_id === user.id,
            },
          }));

          // Si la discussion n'est pas ouverte, incrémenter le badge non-lu
          if (selectedUserRef.current?.id !== partnerId && newMsg.sender_id !== user.id) {
            setUnreadCounts((prev) => ({
              ...prev,
              [partnerId]: (prev[partnerId] || 0) + 1,
            }));
          }
        }
      }

      const isForCurrentChat = selectedUserRef.current
        ? (selectedUserRef.current.id === '__community__'
            ? !newMsg.receiver_id
            : (newMsg.sender_id === selectedUserRef.current.id && newMsg.receiver_id === user.id) ||
              (newMsg.sender_id === user.id && newMsg.receiver_id === selectedUserRef.current.id))
        : false;

      if (isForCurrentChat) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          if (newMsg.sender_id !== user.id) {
            soundEffects.playReceive();
          }
          return [...prev, newMsg];
        });
      } else if (newMsg.receiver_id === user.id) {
        soundEffects.playReceive();
      }
    };

    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        handleIncoming(payload.new as Message);
      })
      .on('broadcast', { event: 'new_message' }, ({ payload }) => handleIncoming(payload as Message))
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.sender_id === selectedUserRef.current?.id) {
          setIsOtherTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setIsOtherTyping(false), 3000);
        }
      })
      .on('broadcast', { event: 'user_joined' }, ({ payload }) => {
        const newUser = payload as Profile;
        if (newUser.id && newUser.id !== user.id) {
          saveLocalUser(newUser);
          setAllContacts((prev) => {
            if (prev.some((u) => u.id === newUser.id)) return prev;
            return [...prev, newUser];
          });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: user.id,
            username: myUsername || user.email?.split('@')[0],
            online_at: new Date().toISOString(),
          });
          channel.send({
            type: 'broadcast',
            event: 'user_joined',
            payload: {
              id: user.id,
              username: myUsername || user.email?.split('@')[0],
              email: user.email,
              language: myLang,
            },
          });
        }
      });

    // Heartbeat présence toutes les 15s pour maintenir le statut en ligne actif
    const presenceHeartbeat = setInterval(async () => {
      if (channelRef.current && user) {
        try {
          await channelRef.current.track({
            userId: user.id,
            username: myUsername || user.email?.split('@')[0],
            online_at: new Date().toISOString(),
          });
        } catch {}
      }
    }, 15000);

    const handleBeforeUnload = () => {
      try {
        channel.untrack();
        supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id).then(() => {});
      } catch {}
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    const pollInterval = setInterval(async () => {
      if (user) {
        const curSelected = selectedUserRef.current;
        if (curSelected) {
          await loadMessages(user.id, curSelected.id === '__community__' ? null : curSelected.id);
        }
        await loadAllContacts(user.id);
        await loadConversationPartners(user.id);
      }
    }, 5000);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(presenceHeartbeat);
      try { channel.untrack(); } catch {}
      channelRef.current = null;
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loadMessages, loadAllContacts, loadConversationPartners, myLang, myUsername]);

  useEffect(() => {
    if (showNewChatModal && user) {
      loadAllContacts(user.id);
    }
  }, [showNewChatModal, user, loadAllContacts]);

  useEffect(() => { scrollToBottom(); }, [messages, isOtherTyping]);

  const handleTyping = (text: string) => {
    setInputText(text);
    if (!user || !selectedUser) return;
    channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { sender_id: user.id, receiver_id: selectedUser.id },
    });
  };

  const handleSelectUser = (profile: Profile | null) => {
    selectedUserRef.current = profile;
    setSelectedUser(profile);
    setIsOtherTyping(false);
    setShowContactInfo(false);
    if (profile?.id) {
      // Effacer les messages non lus pour ce contact
      setUnreadCounts((prev) => ({ ...prev, [profile.id]: 0 }));
      if (profile.id !== '__community__') {
        setConversationPartnerIds((prev) => new Set(prev).add(profile.id));
      }
    }
    if (user && profile) {
      loadMessages(user.id, profile.id === '__community__' ? null : profile.id);
    } else {
      setMessages([]);
    }
  };

  // =================== ENVOI MESSAGE TEXTE ===================
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !user || sending) return;
    const rawText = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      let translatedText: string | undefined;
      const targetLang: 'fr' | 'dyu' = myLang === 'dyu' ? 'fr' : 'dyu';
      if (autoTranslate) {
        try {
          const res = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: rawText, sourceLang: myLang, targetLang, apiKey: geminiApiKey || undefined }),
          });
          if (res.ok) { const tr = await res.json(); translatedText = tr.translatedText; }
        } catch {}
      }

      const encoded = encodeMessageContent({ originalText: rawText, translatedText, sourceLang: myLang, targetLang, type: 'text' });
      soundEffects.playSend();

      const targetReceiverId = (selectedUser && selectedUser.id !== '__community__') ? selectedUser.id : null;
      const { data, error } = await supabase.from('messages').insert({
        sender_id: user.id,
        receiver_id: targetReceiverId,
        content: encoded,
      }).select().single();

      if (!error && data) {
        setMessages((prev) => prev.some((m) => m.id === data.id) ? prev : [...prev, data]);
        channelRef.current?.send({ type: 'broadcast', event: 'new_message', payload: data });

        if (targetReceiverId) {
          setConversationPartnerIds((prev) => new Set(prev).add(targetReceiverId));
          const timeStr = new Date(data.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setLastMessagesByContact((prev) => ({
            ...prev,
            [targetReceiverId]: {
              text: rawText,
              time: timeStr,
              isMine: true,
            },
          }));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  // =================== VOCAUX ===================
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((p) => p + 1), 1000);
    } catch {
      alert('Veuillez autoriser l\'accès au microphone.');
    }
  };

  const cancelRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
    audioChunksRef.current = [];
  };

  const stopAndSendRecording = async () => {
    if (!mediaRecorderRef.current || !user) return;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    const duration = recordingSeconds;

    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const b64 = reader.result as string;
        const encoded = encodeMessageContent({ originalText: `🎤 Note vocale (${duration}s)`, type: 'audio', mediaUrl: b64, duration });
        soundEffects.playSend();

        const targetReceiverId = (selectedUser && selectedUser.id !== '__community__') ? selectedUser.id : null;
        const { data, error } = await supabase.from('messages').insert({
          sender_id: user.id, receiver_id: targetReceiverId, content: encoded,
        }).select().single();

        if (!error && data) {
          setMessages((prev) => prev.some((m) => m.id === data.id) ? prev : [...prev, data]);
          channelRef.current?.send({ type: 'broadcast', event: 'new_message', payload: data });
        }
      };
      setIsRecording(false);
      setRecordingSeconds(0);
      audioChunksRef.current = [];
    };
    mediaRecorderRef.current.stop();
  };

  // =================== PHOTOS & VUE UNIQUE ===================
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setPendingImage(ev.target?.result as string); setIsViewOnceSelected(false); setImageCaption(''); };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const fileName = file.name;
    const fileSize = `${(file.size / 1024).toFixed(1)} Ko`;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const b64 = ev.target?.result as string;
      const encoded = encodeMessageContent({
        originalText: `📄 ${fileName}`,
        type: 'document',
        mediaUrl: b64,
        fileName,
        fileSize,
      });
      soundEffects.playSend();
      const targetReceiverId = (selectedUser && selectedUser.id !== '__community__') ? selectedUser.id : null;
      const { data, error } = await supabase.from('messages').insert({
        sender_id: user.id, receiver_id: targetReceiverId, content: encoded,
      }).select().single();
      if (!error && data) {
        setMessages((prev) => prev.some((m) => m.id === data.id) ? prev : [...prev, data]);
        channelRef.current?.send({ type: 'broadcast', event: 'new_message', payload: data });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSendImage = async () => {
    if (!pendingImage || !user) return;
    setSending(true);
    try {
      let translatedCaption: string | undefined;
      if (imageCaption.trim() && autoTranslate) {
        try {
          const res = await fetch('/api/translate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: imageCaption.trim(), sourceLang: myLang, targetLang: myLang === 'dyu' ? 'fr' : 'dyu', apiKey: geminiApiKey || undefined }),
          });
          if (res.ok) { const tr = await res.json(); translatedCaption = tr.translatedText; }
        } catch {}
      }

      const encoded = encodeMessageContent({
        originalText: imageCaption.trim() || '📷 Photo', translatedText: translatedCaption,
        caption: imageCaption.trim(), type: 'image', mediaUrl: pendingImage,
        isViewOnce: isViewOnceSelected, sourceLang: myLang, targetLang: myLang === 'dyu' ? 'fr' : 'dyu',
      });
      soundEffects.playSend();

      const targetReceiverId = (selectedUser && selectedUser.id !== '__community__') ? selectedUser.id : null;
      const { data, error } = await supabase.from('messages').insert({
        sender_id: user.id, receiver_id: targetReceiverId, content: encoded,
      }).select().single();

      if (!error && data) {
        setMessages((prev) => prev.some((m) => m.id === data.id) ? prev : [...prev, data]);
        channelRef.current?.send({ type: 'broadcast', event: 'new_message', payload: data });
      }
      setPendingImage(null);
      setImageCaption('');
      setIsViewOnceSelected(false);
    } catch (err) { console.error(err); }
    finally { setSending(false); }
  };

  const handleOpenViewOnce = (msgId: string, mediaUrl?: string) => {
    if (!mediaUrl) return;
    if (openedViewOnceIds[msgId]) { alert('Cette photo a déjà été ouverte.'); return; }
    setActiveViewOnceModal(mediaUrl);
    const updated = { ...openedViewOnceIds, [msgId]: true };
    setOpenedViewOnceIds(updated);
    localStorage.setItem('kouma_opened_view_once', JSON.stringify(updated));
  };

  const toggleShowOriginal = (msgId: string) => {
    setExpandedOriginals((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const handleReactToMessage = (msgId: string, emoji: string) => {
    setMessageReactions((prev) => {
      const current = prev[msgId] || {};
      const updatedCount = (current[emoji] || 0) + 1;
      const updated = { ...prev, [msgId]: { ...current, [emoji]: updatedCount } };
      localStorage.setItem('kouma_reactions', JSON.stringify(updated));
      return updated;
    });
    setHoveredMsgId(null);
  };

  const toggleArchive = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = archivedIds.includes(chatId) ? archivedIds.filter((id) => id !== chatId) : [...archivedIds, chatId];
    setArchivedIds(updated);
    localStorage.setItem('kouma_archived', JSON.stringify(updated));
  };

  const toggleFavorite = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = favoriteIds.includes(chatId) ? favoriteIds.filter((id) => id !== chatId) : [...favoriteIds, chatId];
    setFavoriteIds(updated);
    localStorage.setItem('kouma_favorites', JSON.stringify(updated));
  };

  const toggleMute = () => {
    if (!selectedUser) return;
    const id = selectedUser.id;
    const updated = mutedContactIds.includes(id) ? mutedContactIds.filter((m) => m !== id) : [...mutedContactIds, id];
    setMutedContactIds(updated);
    localStorage.setItem('kouma_muted', JSON.stringify(updated));
  };

  const handleClearCurrentChat = async () => {
    if (!user || !selectedUser) return;
    if (confirm(`Effacer les messages avec ${selectedUser.username} ?`)) {
      setMessages([]);
    }
  };

  const handleSendAiMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim() || aiLoading) return;
    const userText = aiInput.trim();
    setAiInput('');
    setAiMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setAiLoading(true);
    soundEffects.playSend();

    try {
      const res = await fetch('/api/translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: userText, sourceLang: myLang, targetLang: myLang === 'dyu' ? 'fr' : 'dyu', apiKey: geminiApiKey || undefined }),
      });
      let reply = 'Je suis là pour vous aider !';
      if (res.ok) {
        const data = await res.json();
        reply = `Traduction : « ${data.translatedText} »\n(${data.sourceLang === 'dyu' ? 'Dioula' : 'Français'} ➔ ${data.targetLang === 'dyu' ? 'Dioula' : 'Français'})`;
      }
      setAiMessages((prev) => [...prev, { sender: 'ai', text: reply }]);
      soundEffects.playReceive();
    } catch {
      setAiMessages((prev) => [...prev, { sender: 'ai', text: 'Désolé, une erreur est survenue.' }]);
    } finally { setAiLoading(false); }
  };

  const handleAddStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatusText.trim()) return;
    const newEntry: StoryStatus = {
      id: Date.now().toString(),
      name: myUsername || 'Moi',
      avatarLetter: (myUsername || 'M')[0],
      avatarColor: 'bg-[#00a884]',
      time: 'À l\'instant',
      text: newStatusText.trim(),
      bgColor: newStatusColor,
      isMine: true
    };
    const updated = [newEntry, ...statuses];
    setStatuses(updated);
    try {
      localStorage.setItem('kouma_user_statuses', JSON.stringify(updated));
    } catch {}
    setNewStatusText('');
    setShowNewStatusModal(false);
  };

  const handleSaveSettings = async () => {
    localStorage.setItem('kouma_lang', myLang);
    localStorage.setItem('kouma_gemini_key', geminiApiKey);
    if (user && myUsername) {
      saveLocalUser({ id: user.id, username: myUsername, email: user.email, language: myLang });
      supabase.from('profiles').upsert({ id: user.id, username: myUsername, language: myLang }, { onConflict: 'id' }).then(({ error }) => { if (error) console.warn(error); });
    }
    setShowSettings(false);
  };

  const handleLogout = async () => {
    try {
      await channelRef.current?.untrack();
      await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user?.id);
    } catch {}
    await supabase.auth.signOut();
    setUser(null);
  };

  // Contacts de la sidebar = uniquement ceux avec qui on a eu une vraie conversation
  const sidebarContacts = allContacts.filter((p) => {
    const hasConversation = conversationPartnerIds.has(p.id);
    const matchesSearch = (p.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    const isArchived = archivedIds.includes(p.id);
    if (activeTab === 'archived') return isArchived && matchesSearch;
    if (isArchived) return false;
    if (filterTab === 'favorites') return favoriteIds.includes(p.id) && hasConversation && matchesSearch;
    return hasConversation && matchesSearch;
  });
  // Alias pour compatibilité (utilisé dans la liste sidebar)
  const filteredContacts = sidebarContacts;

  const avatarColors = [
    'bg-rose-400', 'bg-sky-400', 'bg-violet-400', 'bg-amber-400',
    'bg-emerald-400', 'bg-orange-400', 'bg-pink-400', 'bg-teal-400',
  ];
  const getAvatarColor = (id: string) => avatarColors[(id || 'a').charCodeAt(0) % avatarColors.length];

  // Médias partagés pour le tiroir de contact
  const sharedMediaUrls = messages
    .map((m) => parseMessageContent(m.content))
    .filter((p) => p.type === 'image' && p.mediaUrl && !p.isViewOnce)
    .map((p) => p.mediaUrl as string);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f0f2f5]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#00a884]"></div>
          <p className="text-sm font-semibold text-[#111b21]">Ouverture de Kouma WhatsApp...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#f0f2f5] text-[#111b21] flex flex-col">
        <div className="h-56 bg-[#00a884] w-full absolute top-0 left-0 z-0"></div>
        <header className="relative z-10 max-w-6xl w-full mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white text-[#00a884] font-black text-xl flex items-center justify-center shadow-md">K</div>
            <div>
              <span className="text-xl font-bold text-white">WhatsApp Kouma</span>
              <span className="text-xs text-white/90 block">Dioula ⇋ Français • Vocaux • Statuts • Appels</span>
            </div>
          </div>
          <div className="flex gap-3">
            <Link href="/login" className="px-5 py-2 text-sm font-semibold text-white hover:text-white/80">Connexion</Link>
            <Link href="/signup" className="px-5 py-2 text-sm font-semibold rounded-lg bg-white text-[#00a884] shadow-md hover:bg-slate-100">Créer un compte</Link>
          </div>
        </header>
        <section className="relative z-10 flex-1 flex items-center justify-center px-6 py-8">
          <div className="bg-white p-10 rounded-2xl border border-slate-200 shadow-2xl space-y-6 max-w-2xl w-full text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#d9fdd3] text-[#008069] text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#00a884] animate-pulse"></span>
              WhatsApp Kouma • Bilingue Dioula ⇋ Français
            </div>
            <h1 className="text-4xl font-extrabold text-[#111b21]">Discutez sans barrière de langue</h1>
            <p className="text-[#667781]">Parlez en Dioula, votre contact lit en Français. Envoyez des notes vocales, des statuts en plein écran, des photos en vue unique et appelez.</p>
            <div className="flex gap-4 justify-center pt-2">
              <Link href="/signup" className="px-8 py-3 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white font-bold shadow-lg">Commencer</Link>
              <Link href="/login" className="px-8 py-3 rounded-xl bg-[#f0f2f5] hover:bg-slate-200 text-[#111b21] font-semibold border border-slate-300">Se connecter</Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const unreadStatusesCount = statuses.filter((s) => !viewedStatusIds.includes(s.id)).length;

  const navItems = [
    { id: 'chats', icon: <ChatIcon className="w-6 h-6" />, label: 'Discussions' },
    { id: 'calls', icon: <CallsIcon className="w-6 h-6" />, label: 'Appels' },
    { id: 'status', icon: <StatusIcon className="w-6 h-6" />, label: 'Statut', dot: unreadStatusesCount > 0 },
    { id: 'communities', icon: <CommunitiesIcon className="w-6 h-6" />, label: 'Communautés' },
    { id: 'archived', icon: <ArchiveIcon className="w-6 h-6" />, label: 'Archivées', badge: archivedIds.length || undefined },
    { id: 'ai', icon: <MetaAiIcon className="w-6 h-6" />, label: 'Kouma AI' },
  ] as const;

  return (
    <div className="h-screen w-screen bg-[#f0f2f5] flex items-center justify-center overflow-hidden font-sans">
      <div className="w-full h-full flex bg-white shadow-2xl overflow-hidden relative">

        {/* ===== RAIL DE NAVIGATION GAUCHE (DESKTOP) ===== */}
        <nav className="hidden md:flex w-14 sm:w-16 bg-[#f0f2f5] border-r border-[#e9edef] flex-col justify-between items-center py-3 shrink-0 z-20">
          <div className="flex flex-col items-center gap-1 w-full">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as typeof activeTab)}
                title={item.label}
                className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                  activeTab === item.id ? 'bg-[#e9edef] text-[#111b21]' : 'text-[#54656f] hover:bg-[#e9edef]/60'
                } ${item.id === 'ai' ? 'mt-2' : ''}`}
              >
                {item.icon}
                {('badge' in item) && item.badge ? (
                  <span className="absolute -top-0.5 -right-0.5 bg-[#25d366] text-white text-[9px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center">
                    {item.badge}
                  </span>
                ) : null}
                {('dot' in item) && item.dot && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#25d366]"></span>
                )}
              </button>
            ))}
          </div>

          <div className="flex flex-col items-center gap-2 pb-1">
            <button
              onClick={() => setShowSettings(true)}
              className="w-11 h-11 rounded-full flex items-center justify-center text-[#54656f] hover:bg-[#e9edef]/60 transition-colors"
              title="Paramètres"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>

            <div
              onClick={() => setShowSettings(true)}
              className={`w-9 h-9 rounded-full ${getAvatarColor(user.id)} text-white font-bold text-sm flex items-center justify-center cursor-pointer shadow hover:scale-105 transition-transform`}
            >
              {(myUsername || 'U')[0].toUpperCase()}
            </div>
          </div>
        </nav>

        {/* ===== BARRE DE NAVIGATION INFÉRIEURE MOBILE (Quand aucun chat ouvert) ===== */}
        {!selectedUser && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-[#e9edef] flex items-center justify-around px-2 z-30 shadow-lg">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as typeof activeTab)}
                className={`relative flex flex-col items-center justify-center p-1 transition-colors ${
                  activeTab === item.id ? 'text-[#00a884]' : 'text-[#54656f]'
                }`}
              >
                <div className="relative">
                  {item.icon}
                  {('badge' in item) && item.badge ? (
                    <span className="absolute -top-1 -right-1 bg-[#25d366] text-white text-[9px] font-bold min-w-[14px] h-3.5 px-0.5 rounded-full flex items-center justify-center">
                      {item.badge}
                    </span>
                  ) : null}
                  {('dot' in item) && item.dot && (
                    <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-[#25d366]"></span>
                  )}
                </div>
                <span className="text-[10px] font-medium mt-0.5">{item.label}</span>
              </button>
            ))}
            <button
              onClick={() => setShowSettings(true)}
              className="flex flex-col items-center justify-center p-1 text-[#54656f]"
            >
              <div className={`w-6 h-6 rounded-full ${getAvatarColor(user.id)} text-white font-bold text-xs flex items-center justify-center shadow`}>
                {(myUsername || 'U')[0].toUpperCase()}
              </div>
              <span className="text-[10px] font-medium mt-0.5">Moi</span>
            </button>
          </nav>
        )}

        {/* ===== VOLET GAUCHE (SIDEBAR) ===== */}
        <aside className={`${selectedUser ? 'hidden md:flex' : 'flex'} w-full md:w-[360px] lg:w-[400px] bg-white border-r border-[#e9edef] flex-col shrink-0 z-10 h-full pb-16 md:pb-0`}>

          {/* DISCUSSIONS & ARCHIVÉES */}
          {(activeTab === 'chats' || activeTab === 'archived') && (
            <>
              <div className="h-16 px-4 flex items-center justify-between shrink-0">
                <h1 className="text-xl font-bold text-[#111b21]">
                  {activeTab === 'archived' ? 'Archivées' : 'Discussions'}
                </h1>
                <div className="flex items-center gap-1 relative" ref={chatsMenuRef}>

                  {/* ===== MENU CONTEXTUEL ⋮ ===== */}
                  <div className="relative">
                    <button
                      onClick={() => setShowChatsMenu(!showChatsMenu)}
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-[#54656f] hover:bg-[#f0f2f5] transition-colors ${
                        showChatsMenu ? 'bg-[#f0f2f5]' : ''
                      }`}
                      title="Plus d'options"
                    >
                      <MoreVertIcon className="w-5 h-5" />
                    </button>

                    {showChatsMenu && (
                      <>
                        {/* Overlay transparent pour fermer au clic extérieur */}
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowChatsMenu(false)}
                        />
                        <div className="absolute top-10 right-0 z-50 bg-white rounded-2xl shadow-2xl border border-[#e9edef] w-60 py-2 animate-in fade-in slide-in-from-top-2 duration-150">
                          {/* Bouton + vert en haut */}
                          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#f0f2f5] mb-1">
                            <div className="w-9 h-9 rounded-full bg-[#00a884] text-white flex items-center justify-center shadow">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                              </svg>
                            </div>
                            <span className="text-sm font-bold text-[#111b21]">Nouvelle discussion</span>
                          </div>

                          {[
                            {
                              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
                              label: 'Nouveau groupe',
                              onClick: () => { setShowChatsMenu(false); alert('Groupes disponibles prochainement !'); }
                            },
                            {
                              icon: <ArchiveIcon className="w-5 h-5" />,
                              label: 'Archivées',
                              onClick: () => { setShowChatsMenu(false); setActiveTab('archived'); }
                            },
                            {
                              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
                              label: 'Messages importants',
                              onClick: () => { setShowChatsMenu(false); setFilterTab('favorites'); }
                            },
                            {
                              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
                              label: 'Sélectionner les discussions',
                              onClick: () => { setShowChatsMenu(false); }
                            },
                            {
                              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
                              label: 'Tout marquer comme lu',
                              onClick: () => { setShowChatsMenu(false); }
                            },
                          ].map((item) => (
                            <button
                              key={item.label}
                              onClick={item.onClick}
                              className="w-full flex items-center gap-3.5 px-5 py-3 text-sm text-[#111b21] hover:bg-[#f5f6f6] transition-colors text-left"
                            >
                              <span className="text-[#54656f]">{item.icon}</span>
                              <span className="font-medium">{item.label}</span>
                            </button>
                          ))}

                          <div className="border-t border-[#f0f2f5] mt-1 pt-1">
                            <button
                              onClick={() => { setShowChatsMenu(false); setShowSettings(true); }}
                              className="w-full flex items-center gap-3.5 px-5 py-3 text-sm text-[#111b21] hover:bg-[#f5f6f6] transition-colors text-left"
                            >
                              <span className="text-[#54656f]"><LockIcon className="w-5 h-5" /></span>
                              <span className="font-medium">Verrouillage de l'application</span>
                            </button>
                            <button
                              onClick={() => { setShowChatsMenu(false); handleLogout(); }}
                              className="w-full flex items-center gap-3.5 px-5 py-3 text-sm text-rose-500 hover:bg-rose-50 transition-colors text-left"
                            >
                              <span className="text-rose-400">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                                  <polyline points="16 17 21 12 16 7"/>
                                  <line x1="21" y1="12" x2="9" y2="12"/>
                                </svg>
                              </span>
                              <span className="font-semibold">Déconnexion</span>
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => setShowNewChatModal(true)}
                    className="w-9 h-9 rounded-full bg-[#00a884] hover:bg-[#008f6f] text-white flex items-center justify-center shadow-md hover:scale-105 transition-all"
                    title="Nouvelle discussion"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Barre de recherche */}
              <div className="px-3 pb-2">
                <div className="bg-[#f0f2f5] rounded-lg px-3 py-2 flex items-center gap-3">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Rechercher ou démarrer une discussion"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent text-sm text-[#111b21] placeholder-[#8696a0] focus:outline-none w-full"
                  />
                </div>
              </div>

              {/* Filtres */}
              <div className="px-3 pb-2 flex items-center gap-2 overflow-x-auto border-b border-[#e9edef]">
                {[
                  { key: 'all', label: 'Toutes' },
                  { key: 'unread', label: 'Non lues' },
                  { key: 'favorites', label: 'Favoris' },
                  { key: 'groups', label: 'Groupes' },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilterTab(f.key as typeof filterTab)}
                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                      filterTab === f.key
                        ? 'bg-[#d9fdd3] text-[#008069]'
                        : 'bg-[#f0f2f5] text-[#667781] hover:bg-[#e9edef]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
                <button
                  onClick={() => setShowNewChatModal(true)}
                  className="w-6 h-6 rounded-full bg-[#f0f2f5] text-[#667781] hover:bg-[#e9edef] text-xs flex items-center justify-center font-bold"
                >+</button>
              </div>

              {/* Liste des conversations */}
              <div className="flex-1 overflow-y-auto">
                <div
                  onClick={() => handleSelectUser(COMMUNITY_CHAT)}
                  className={`px-3 py-2.5 flex items-center gap-3 cursor-pointer transition-colors border-b border-[#f0f2f5] ${
                    selectedUser?.id === '__community__' ? 'bg-[#f0f2f5]' : 'hover:bg-[#f5f6f6]'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-[#00a884]/20 text-[#00a884] flex items-center justify-center text-lg font-bold shrink-0">
                    <CommunitiesIcon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-[#111b21] truncate">Kouma Communauté</h3>
                      <span className="text-[11px] text-[#667781]">En direct</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-[#667781] truncate">Canal général bilingue Dioula ⇋ Français</p>
                    </div>
                  </div>
                </div>

                {filteredContacts.map((p) => {
                  const isFav = favoriteIds.includes(p.id);
                  const isArch = archivedIds.includes(p.id);
                  const isMuted = mutedContactIds.includes(p.id);

                  const lastMsg = lastMessagesByContact[p.id];
                  const unread = unreadCounts[p.id] || 0;

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectUser(p)}
                      className={`px-3 py-2.5 flex items-center gap-3 cursor-pointer transition-colors border-b border-[#f0f2f5] group ${
                        selectedUser?.id === p.id ? 'bg-[#f0f2f5]' : 'hover:bg-[#f5f6f6]'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div className={`w-12 h-12 rounded-full ${getAvatarColor(p.id)} text-white flex items-center justify-center text-base font-bold shadow-sm`}>
                          {(p.username || 'U')[0].toUpperCase()}
                        </div>
                        {onlineUserIds.has(p.id) && (
                          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#00a884] border-2 border-white rounded-full" title="En ligne"></span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-[#111b21] truncate flex items-center gap-1.5">
                            <span>{p.username}</span>
                            {isMuted && <span className="text-[10px] text-[#8696a0]" title="En sourdine">🔕</span>}
                          </h3>
                          <span className={`text-[11px] ${unread > 0 ? 'text-[#00a884] font-bold' : 'text-[#667781]'}`}>
                            {lastMsg ? lastMsg.time : ''}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className={`text-xs truncate flex items-center gap-1 ${unread > 0 ? 'text-[#111b21] font-semibold' : 'text-[#667781]'}`}>
                            {lastMsg ? (
                              <>
                                {lastMsg.isMine && (
                                  onlineUserIds.has(p.id) ? (
                                    <DoubleCheckIcon className="w-3.5 h-3.5 text-[#53bdeb] shrink-0" />
                                  ) : (
                                    <SingleCheckIcon className="w-3.5 h-3.5 text-[#8696a0] shrink-0" />
                                  )
                                )}
                                <span className="truncate">{lastMsg.text}</span>
                              </>
                            ) : (
                              <span>{p.language === 'dyu' ? 'Dioula 🇨🇮' : 'Français 🇫🇷'}</span>
                            )}
                          </p>
                          <div className="flex items-center gap-1.5">
                            {unread > 0 && (
                              <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#00a884] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                {unread}
                              </span>
                            )}
                            <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                              <button onClick={(e) => toggleFavorite(p.id, e)} title={isFav ? 'Retirer favoris' : 'Ajouter favoris'}
                                className="w-5 h-5 flex items-center justify-center text-[#667781] hover:text-amber-500 text-xs">
                                {isFav ? '★' : '☆'}
                              </button>
                              <button onClick={(e) => toggleArchive(p.id, e)} title={isArch ? 'Désarchiver' : 'Archiver'}
                                className="w-5 h-5 flex items-center justify-center text-[#667781] hover:text-[#111b21]">
                                <ArchiveIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredContacts.length === 0 && (
                  <div className="p-8 text-center space-y-3">
                    <p className="text-xs text-[#667781]">Aucune discussion trouvée.</p>
                    <button
                      onClick={() => setShowNewChatModal(true)}
                      className="px-4 py-2 rounded-lg bg-[#00a884] text-white text-xs font-semibold shadow hover:bg-[#008f6f]"
                    >
                      + Nouvelle discussion
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* STATUT (STORIES EN PLEIN ÉCRAN) */}
          {activeTab === 'status' && (
            <div className="flex-1 flex flex-col">
              <div className="h-16 px-4 flex items-center justify-between">
                <h1 className="text-xl font-bold text-[#111b21]">Statut</h1>
                <button
                  onClick={() => setShowNewStatusModal(true)}
                  className="w-9 h-9 rounded-full bg-[#00a884] text-white flex items-center justify-center shadow hover:scale-105 transition-transform"
                  title="Ajouter un statut"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                <div onClick={() => setShowNewStatusModal(true)}
                  className="p-3 rounded-xl bg-[#f0f2f5] flex items-center gap-3 cursor-pointer hover:bg-[#e9edef] transition-colors">
                  <div className="w-12 h-12 rounded-full border-2 border-dashed border-[#00a884] flex items-center justify-center text-[#00a884] font-bold">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#111b21]">Mon statut</h3>
                    <p className="text-xs text-[#667781]">Ajouter une mise à jour en Dioula ou Français</p>
                  </div>
                </div>

                <div className="px-1 text-xs font-bold text-[#667781] uppercase tracking-wider">
                  Mises à jour récentes ({statuses.length})
                </div>

                {statuses.length === 0 ? (
                  <div className="py-10 px-4 text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-[#f0f2f5] text-[#8696a0] flex items-center justify-center mx-auto mb-2">
                      <StatusIcon className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-[#111b21]">Aucun statut récent</p>
                    <p className="text-xs text-[#667781] max-w-xs mx-auto">
                      Appuyez sur &quot;Mon statut&quot; pour partager une pensée ou une image avec vos contacts.
                    </p>
                  </div>
                ) : (
                  statuses.map((st, idx) => {
                    const isSeen = viewedStatusIds.includes(st.id);
                    return (
                      <div
                        key={st.id}
                        onClick={() => {
                          setStatusInitialIndex(idx);
                          setViewingStatuses(statuses);
                          const newSeen = [...new Set([...viewedStatusIds, st.id])];
                          setViewedStatusIds(newSeen);
                          localStorage.setItem('kouma_viewed_statuses', JSON.stringify(newSeen));
                        }}
                        className="p-2.5 flex items-center gap-3 cursor-pointer hover:bg-[#f0f2f5] rounded-xl transition-all group"
                      >
                        <div className={`w-12 h-12 rounded-full ${
                          isSeen
                            ? 'ring-2 ring-[#d9d9d9] ring-offset-2'
                            : 'ring-2 ring-[#00a884] ring-offset-2'
                        } ${st.avatarColor} text-white flex items-center justify-center font-bold text-base shrink-0 group-hover:scale-105 transition-transform`}>
                          {st.avatarLetter.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className={`text-sm font-semibold truncate ${ isSeen ? 'text-[#667781]' : 'text-[#111b21]' }`}>{st.name}</h5>
                          <p className="text-xs text-[#667781] truncate">{st.time} {isSeen && <span className="text-[10px] text-[#8696a0] ml-1">• Vu</span>}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* APPELS */}
          {activeTab === 'calls' && (
            <div className="flex-1 flex flex-col">
              <div className="h-16 px-4 flex items-center justify-between">
                <h1 className="text-xl font-bold text-[#111b21]">Appels</h1>
                <button
                  onClick={() => setActiveCallModal({ name: selectedUser?.username || 'Contact', isVideo: false, duration: 0 })}
                  className="w-9 h-9 rounded-full bg-[#00a884] text-white flex items-center justify-center shadow hover:scale-105 transition-transform"
                >
                  <CallsIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {callLogs.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setActiveCallModal({ name: c.name, isVideo: c.isVideo, duration: 0 })}
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#f0f2f5] rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-full ${getAvatarColor(c.id)} text-white flex items-center justify-center font-bold`}>{c.name[0]}</div>
                      <div>
                        <h4 className="text-sm font-semibold text-[#111b21]">{c.name}</h4>
                        <p className={`text-xs flex items-center gap-1 ${c.type === 'missed' ? 'text-rose-500' : 'text-[#667781]'}`}>
                          <span>{c.type === 'outgoing' ? '↗' : c.type === 'missed' ? '↙' : '↙'}</span>
                          <span>{c.time}</span>
                        </p>
                      </div>
                    </div>
                    <button className="p-2 rounded-full hover:bg-[#e9edef] text-[#00a884]">
                      {c.isVideo ? <CameraIcon className="w-5 h-5" /> : <CallsIcon className="w-5 h-5" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* COMMUNAUTÉS */}
          {activeTab === 'communities' && (
            <div className="flex-1 flex flex-col">
              <div className="h-16 px-4 flex items-center">
                <h1 className="text-xl font-bold text-[#111b21]">Communautés</h1>
              </div>
              <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-[#00a884]/15 flex items-center justify-center text-[#00a884]">
                  <CommunitiesIcon className="w-10 h-10" />
                </div>
                <h3 className="text-base font-bold text-[#111b21]">Communauté WhatsApp Kouma</h3>
                <p className="text-xs text-[#667781] max-w-xs leading-relaxed">
                  Rassemblez vos groupes d'apprentissage du Dioula, vos commerces et vos familles dans un même espace bilingue.
                </p>
                <button
                  onClick={() => { handleSelectUser(COMMUNITY_CHAT); setActiveTab('chats'); }}
                  className="px-5 py-2.5 rounded-full bg-[#00a884] text-white text-xs font-bold shadow hover:bg-[#008f6f]"
                >
                  Accéder au Canal Communauté
                </button>
              </div>
            </div>
          )}

          {/* KOUMA AI */}
          {activeTab === 'ai' && (
            <div className="flex-1 flex flex-col">
              <div className="h-16 px-4 flex items-center gap-3 border-b border-[#e9edef]">
                <MetaAiIcon className="w-8 h-8" />
                <div>
                  <h1 className="text-base font-bold text-[#111b21]">Kouma AI</h1>
                  <p className="text-[10px] text-[#667781]">Assistant bilingue Dioula ⇋ Français</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {aiMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed shadow ${
                      m.sender === 'user' ? 'bg-[#d9fdd3] text-[#111b21] rounded-br-none' : 'bg-[#f0f2f5] text-[#111b21] rounded-bl-none'
                    }`}>
                      <p className="whitespace-pre-wrap">{m.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSendAiMessage} className="p-2 border-t border-[#e9edef] flex gap-2">
                <input type="text" value={aiInput} onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Traduction, question, proverbe..." className="flex-1 px-3 py-2 rounded-lg text-xs bg-[#f0f2f5] text-[#111b21] focus:outline-none" />
                <button type="submit" disabled={aiLoading || !aiInput.trim()} className="px-3 py-2 rounded-lg bg-[#00a884] text-white text-xs font-bold flex items-center">
                  <SendIcon className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </aside>

        {/* ===== ZONE DE CONVERSATION CENTRALE ===== */}
        {selectedUser !== null ? (
          <main className="w-full md:flex-1 flex flex-col bg-[#efeae2] relative overflow-hidden h-full">
            {/* MOTIF DE FOND DOODLE AUTHENTIQUE WHATSAPP */}
            <WhatsAppDoodleBackground />

            {/* EN-TÊTE DE LA DISCUSSION */}
            <header className="h-16 px-3 sm:px-4 bg-[#f0f2f5] border-b border-[#e9edef] flex items-center justify-between shrink-0 z-10 shadow-sm">
              <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                {/* Bouton Retour Mobile */}
                <button
                  onClick={() => { setSelectedUser(null); setMessages([]); }}
                  className="md:hidden p-2 -ml-1 mr-1 rounded-full text-[#54656f] hover:bg-[#e9edef] transition-colors shrink-0"
                  title="Retour aux discussions"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                </button>

                <div
                  onClick={() => setShowContactInfo(!showContactInfo)}
                  className="flex items-center gap-2.5 sm:gap-3 cursor-pointer hover:opacity-90 select-none min-w-0"
                >
                  <div className="relative shrink-0">
                    <div className={`w-10 h-10 rounded-full ${selectedUser.id !== '__community__' ? getAvatarColor(selectedUser.id) : 'bg-[#00a884]/20'} text-white flex items-center justify-center font-bold shadow-sm`}>
                      {selectedUser.id !== '__community__' ? (selectedUser.username || 'U')[0].toUpperCase() : <CommunitiesIcon className="w-5 h-5 text-[#00a884]" />}
                    </div>
                    {selectedUser.id !== '__community__' && onlineUserIds.has(selectedUser.id) && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#00a884] border-2 border-white rounded-full"></span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-[#111b21] flex items-center gap-1.5 truncate">
                      <span className="truncate">{selectedUser.username}</span>
                      {selectedUser.id !== '__community__' && mutedContactIds.includes(selectedUser.id) && (
                        <span className="text-xs text-[#8696a0]" title="En sourdine">🔕</span>
                      )}
                    </h2>
                    <p className="text-xs text-[#667781] truncate">
                      {isOtherTyping ? (
                        <span className="text-[#00a884] animate-pulse font-medium">✍️ en train d'écrire...</span>
                      ) : selectedUser.id === '__community__' ? (
                        <span>Canal général bilingue</span>
                      ) : onlineUserIds.has(selectedUser.id) ? (
                        <span className="text-[#00a884] font-medium flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#00a884] animate-pulse inline-block"></span>
                          en ligne
                        </span>
                      ) : lastSeenByUser[selectedUser.id] ? (
                        <span>vu {formatLastSeen(lastSeenByUser[selectedUser.id])}</span>
                      ) : lastMessagesByContact[selectedUser.id]?.time ? (
                        <span>vu aujourd'hui à {lastMessagesByContact[selectedUser.id].time}</span>
                      ) : (
                        <span>hors ligne</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                <button
                  onClick={() => setActiveCallModal({ name: selectedUser.username, isVideo: false, duration: 0 })}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full hover:bg-[#e9edef] flex items-center justify-center text-[#54656f] transition-colors"
                  title="Appel audio"
                >
                  <CallsIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setActiveCallModal({ name: selectedUser.username, isVideo: true, duration: 0 })}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full hover:bg-[#e9edef] flex items-center justify-center text-[#54656f] transition-colors"
                  title="Appel vidéo"
                >
                  <CameraIcon className="w-5 h-5" />
                </button>
                <div className="w-px h-5 bg-[#e9edef] mx-0.5 sm:mx-1"></div>

                {/* Badge de traduction automatique Dioula / Français */}
                <button
                  onClick={() => setAutoTranslate(!autoTranslate)}
                  className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition-all shadow-sm ${
                    autoTranslate ? 'bg-[#d9fdd3] text-[#008069] border border-[#00a884]/30' : 'bg-[#f0f2f5] text-[#667781]'
                  }`}
                  title="Activer/Désactiver la traduction automatique"
                >
                  <span className="text-sm">{myLang === 'dyu' ? '🇨🇮' : '🇫🇷'}</span>
                  <span className="hidden sm:inline">{autoTranslate ? 'Traduit' : 'Original'}</span>
                </button>

                <button
                  onClick={() => setShowContactInfo(!showContactInfo)}
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-[#54656f] hover:bg-[#e9edef] transition-colors ${
                    showContactInfo ? 'bg-[#e9edef]' : ''
                  }`}
                  title="Informations du contact"
                >
                  <MoreVertIcon className="w-5 h-5" />
                </button>
              </div>
            </header>

            {/* FLUX DES MESSAGES */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 z-10">
              <div className="flex justify-center my-1">
                <div className="bg-[#ffffffcc] backdrop-blur px-3 py-1 rounded-lg text-[11px] text-[#667781] shadow-sm flex items-center gap-1.5 border border-[#e9edef]/80">
                  <LockIcon className="w-3 h-3 text-[#00a884]" />
                  <span>Messages chiffrés • Traduction bilingue Dioula ⇋ Français active</span>
                </div>
              </div>

              {messages.map((msg) => {
                const isMine = msg.sender_id === user.id;
                const parsed: ParsedMessage = parseMessageContent(msg.content);
                const isExpanded = Boolean(expandedOriginals[msg.id]);
                const isViewOnceOpened = Boolean(openedViewOnceIds[msg.id]);
                const reactions = messageReactions[msg.id] || {};

                let displayText = parsed.originalText;
                let originalText = parsed.originalText;
                let hasTranslation = false;

                if (parsed.isTranslated && parsed.translatedText) {
                  hasTranslation = true;
                  if (!isMine) {
                    displayText = parsed.translatedText;
                    originalText = parsed.originalText;
                  } else {
                    displayText = parsed.originalText;
                    originalText = parsed.translatedText;
                  }
                }

                return (
                  <div
                    key={msg.id}
                    onMouseEnter={() => setHoveredMsgId(msg.id)}
                    onMouseLeave={() => setHoveredMsgId(null)}
                    className={`flex flex-col relative group ${isMine ? 'items-end' : 'items-start'}`}
                  >
                    {/* BARRE DE RÉACTIONS RAPIDES AU SURVOL */}
                    {hoveredMsgId === msg.id && (
                      <MessageReactionPill
                        isMine={isMine}
                        onReact={(emoji) => handleReactToMessage(msg.id, emoji)}
                      />
                    )}

                    <div
                      className={`max-w-[78%] px-3 py-2 rounded-lg text-sm shadow-sm relative transition-all ${
                        isMine ? 'bg-[#d9fdd3] text-[#111b21] rounded-tr-none' : 'bg-white text-[#111b21] rounded-tl-none'
                      }`}
                    >
                      {/* VUE UNIQUE */}
                      {parsed.isViewOnce ? (
                        <button
                          type="button"
                          onClick={() => handleOpenViewOnce(msg.id, parsed.mediaUrl)}
                          disabled={isViewOnceOpened}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs ${
                            isViewOnceOpened
                              ? 'opacity-50 cursor-not-allowed border-[#e9edef]'
                              : 'border-[#00a884]/40 bg-[#00a884]/5 cursor-pointer hover:bg-[#00a884]/10'
                          }`}
                        >
                          <span className="w-6 h-6 rounded-full border border-dashed border-[#00a884] flex items-center justify-center text-[10px] font-bold text-[#00a884]">1</span>
                          <div>
                            <p className="font-semibold">{isViewOnceOpened ? 'Photo (Vue unique ouverte)' : 'Photo vue unique'}</p>
                            <p className="text-[10px] text-[#667781]">{isViewOnceOpened ? '✓ Déjà consultée' : 'Cliquer pour ouvrir'}</p>
                          </div>
                        </button>
                      ) : parsed.type === 'image' && parsed.mediaUrl ? (
                        // IMAGE STANDARD
                        <div className="space-y-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={parsed.mediaUrl}
                            alt="Photo"
                            onClick={() => setActiveViewOnceModal(parsed.mediaUrl!)}
                            className="rounded-lg max-h-64 w-auto object-cover cursor-pointer hover:opacity-95 transition-opacity"
                          />
                          {displayText && displayText !== '📷 Photo' && (
                            <p className="break-words whitespace-pre-wrap text-sm pt-1">{isExpanded ? originalText : displayText}</p>
                          )}
                        </div>
                      ) : parsed.type === 'document' && parsed.mediaUrl ? (
                        // DOCUMENT FICHIER
                        <div className="flex items-center gap-3 p-2 bg-black/5 rounded-lg min-w-[200px]">
                          <div className="w-10 h-10 rounded-lg bg-[#7f66ff] text-white flex items-center justify-center shrink-0">
                            <DocumentIcon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate">{parsed.fileName || 'Document'}</p>
                            <p className="text-[10px] text-[#667781]">{parsed.fileSize || 'Fichier'}</p>
                          </div>
                          <a
                            href={parsed.mediaUrl}
                            download={parsed.fileName || 'document'}
                            className="p-1.5 rounded-full hover:bg-black/10 text-[#00a884]"
                            title="Télécharger"
                          >
                            ⬇️
                          </a>
                        </div>
                      ) : parsed.type === 'audio' && parsed.mediaUrl ? (
                        // VOCAL AVEC ONDE SONORE AUTHENTIQUE WHATSAPP
                        <VoiceWaveform
                          msgId={msg.id}
                          audioUrl={parsed.mediaUrl}
                          duration={parsed.duration}
                          isMine={isMine}
                          avatarLetter={isMine ? (myUsername || 'M')[0] : (selectedUser?.username || 'U')[0]}
                          avatarColor={isMine ? 'bg-[#00a884]' : getAvatarColor(selectedUser?.id || 'contact')}
                        />
                      ) : (
                        // TEXTE CLASSIQUE
                        <div className="space-y-1">
                          <p className="break-words whitespace-pre-wrap leading-relaxed text-[14.5px]">
                            {isExpanded ? originalText : displayText}
                          </p>
                        </div>
                      )}

                      {/* BANDEAU TRADUCTION BILINGUE */}
                      {hasTranslation && (
                        <div className="mt-1 pt-1 border-t border-black/10 flex items-center justify-between text-[10px]">
                          <div className="flex items-center gap-1.5 text-[#667781]">
                            <span>🌐</span>
                            <span>Traduit {parsed.sourceLang === 'dyu' ? 'Dioula ➔ FR' : 'FR ➔ Dioula'}</span>
                            <button
                              type="button"
                              onClick={() => soundEffects.speak(displayText, parsed.targetLang)}
                              className="hover:scale-125 transition-transform ml-1 text-sm"
                              title="Écouter la prononciation"
                            >
                              🔊
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleShowOriginal(msg.id)}
                            className="text-[#008069] hover:underline font-semibold"
                          >
                            {isExpanded ? 'Voir traduction' : 'Original'}
                          </button>
                        </div>
                      )}

                      {/* HEURE ET COCHES (2 traits si destinataire en ligne, 1 trait sinon) */}
                      <div className="flex items-center justify-end gap-1 text-[10px] text-[#667781] mt-0.5">
                        <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {isMine && (
                          (msg.receiver_id && onlineUserIds.has(msg.receiver_id)) || selectedUser?.id === '__community__' ? (
                            <DoubleCheckIcon className="w-3.5 h-3.5 text-[#53bdeb]" title="Distribué (en ligne)" />
                          ) : (
                            <SingleCheckIcon className="w-3.5 h-3.5 text-[#8696a0]" title="Envoyé (hors ligne)" />
                          )
                        )}
                      </div>

                      {/* BADGE DES RÉACTIONS WHATSAPP */}
                      {Object.keys(reactions).length > 0 && (
                        <div className="absolute -bottom-2.5 right-2 bg-white rounded-full shadow border border-[#e9edef] px-1.5 py-0.5 flex items-center gap-1 text-[11px] font-bold">
                          {Object.entries(reactions).map(([emoji, count]) => (
                            <span key={emoji} className="flex items-center">
                              <span>{emoji}</span>
                              {count > 1 && <span className="text-[10px] text-[#667781] ml-0.5">{count}</span>}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* TIROIR EXPRESSIONS DIOULA RAPIDES */}
            {showQuickPhrases && (
              <div className="bg-white border-t border-[#e9edef] p-3 max-h-48 overflow-y-auto shrink-0 shadow-lg z-20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#111b21] flex items-center gap-1.5">
                    <span>🇨🇮</span> Expressions Dioula conversationnelles :
                  </span>
                  <button onClick={() => setShowQuickPhrases(false)} className="text-xs text-[#667781] hover:text-[#111b21]">✕ Fermer</button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {QUICK_DIOULA_EXPRESSIONS.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => { setInputText(item.dyu); setShowQuickPhrases(false); }}
                      className="p-2 rounded-lg bg-[#f0f2f5] hover:bg-[#d9fdd3] text-left transition-colors border border-[#e9edef]"
                    >
                      <p className="font-bold text-[#008069] text-xs">{item.dyu}</p>
                      <p className="text-[10px] text-[#667781] truncate">{item.fr}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* BARRE DE SAISIE WHATSAPP */}
            <footer className="p-2 bg-[#f0f2f5] border-t border-[#e9edef] shrink-0 relative z-20">
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageFileChange} className="hidden" />
              <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleImageFileChange} className="hidden" />
              <input type="file" ref={documentInputRef} onChange={handleDocumentChange} className="hidden" />

              {/* SÉLECTEUR D'EMOJIS */}
              <EmojiPickerPopover
                isOpen={showEmojiPicker}
                onClose={() => setShowEmojiPicker(false)}
                onSelectEmoji={(emoji) => setInputText((prev) => prev + emoji)}
              />

              {/* MENU PIÈCES JOINTES WHATSAPP */}
              <AttachmentMenu
                isOpen={showAttachmentMenu}
                onClose={() => setShowAttachmentMenu(false)}
                onSelectPhoto={() => fileInputRef.current?.click()}
                onSelectCamera={() => cameraInputRef.current?.click()}
                onSelectDocument={() => documentInputRef.current?.click()}
                onSelectContact={() => setShowNewChatModal(true)}
                onSelectPoll={() => {
                  setInputText('📊 Sondage : Est-ce qu\'on mange ensemble à midi ? (1: Oui / 2: Non)');
                }}
                onSelectDioulaPhrases={() => setShowQuickPhrases(true)}
              />

              {isRecording ? (
                // ÉTAT ENREGISTREMENT VOCAL WHATSAPP
                <div className="flex items-center justify-between bg-rose-50 rounded-xl px-4 py-2 border border-rose-200 shadow-sm animate-pulse">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping"></span>
                    <span className="text-sm font-bold text-rose-600">0:{recordingSeconds.toString().padStart(2, '0')}</span>
                    <span className="text-xs text-rose-400">Enregistrement audio en cours...</span>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={cancelRecording} className="text-rose-600 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-rose-100">
                      Annuler
                    </button>
                    <button type="button" onClick={stopAndSendRecording} className="px-4 py-1.5 rounded-full bg-[#00a884] text-white font-bold text-xs flex items-center gap-1 shadow">
                      Envoyer <SendIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                // ÉTAT SAISIE HABITUELLE
                <div className="flex items-center gap-1.5">
                  {/* Bouton Émoji */}
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    title="Émojis & Autocollants"
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                      showEmojiPicker ? 'bg-[#00a884] text-white' : 'hover:bg-[#e9edef] text-[#54656f]'
                    }`}
                  >
                    <EmojiIcon className="w-5 h-5" />
                  </button>

                  {/* Bouton Pièce jointe (Trombone) */}
                  <button
                    type="button"
                    onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                    title="Joindre un fichier"
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                      showAttachmentMenu ? 'bg-[#00a884] text-white' : 'hover:bg-[#e9edef] text-[#54656f]'
                    }`}
                  >
                    <AttachIcon className="w-5 h-5" />
                  </button>

                  {/* Bouton Raccourci Dioula */}
                  <button
                    type="button"
                    onClick={() => setShowQuickPhrases(!showQuickPhrases)}
                    title="Expressions Dioula courantes"
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                      showQuickPhrases ? 'bg-[#00a884] text-white' : 'hover:bg-[#e9edef] text-[#54656f]'
                    }`}
                  >
                    <span className="text-base">🇨🇮</span>
                  </button>

                  {/* Formulaire de message */}
                  <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => handleTyping(e.target.value)}
                      placeholder={myLang === 'dyu' ? 'Écrivez en Dioula (ex: I ni sogoma)...' : 'Tapez un message en Français...'}
                      className="flex-1 px-4 py-2.5 rounded-lg bg-white text-[#111b21] placeholder-[#8696a0] text-sm focus:outline-none shadow-sm border border-[#e9edef]"
                    />
                    {inputText.trim() ? (
                      <button
                        type="submit"
                        disabled={sending}
                        title="Envoyer"
                        className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#008f6f] text-white flex items-center justify-center shadow hover:scale-105 transition-all disabled:opacity-50"
                      >
                        <SendIcon className="w-5 h-5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={startRecording}
                        title="Enregistrer une note vocale"
                        className="w-10 h-10 rounded-full bg-white hover:bg-[#00a884] hover:text-white text-[#54656f] flex items-center justify-center shadow border border-[#e9edef] transition-all hover:scale-105"
                      >
                        <MicIcon className="w-5 h-5" />
                      </button>
                    )}
                  </form>
                </div>
              )}
            </footer>
          </main>
        ) : (
          /* ===== ÉTAT VIDE (Affiché sur desktop uniquement si aucun chat n'est ouvert) ===== */
          <main className="hidden md:flex flex-1 flex-col items-center justify-between bg-[#f0f2f5] p-8 relative">
            <div />
            <div className="max-w-sm text-center space-y-8">
              <div className="flex items-center justify-center gap-10">
                <div onClick={() => setShowNewChatModal(true)} className="flex flex-col items-center gap-2 cursor-pointer group">
                  <div className="w-14 h-14 rounded-full bg-white shadow-md flex items-center justify-center text-[#54656f] group-hover:scale-110 transition-transform group-hover:bg-[#e9edef]">
                    <DocumentIcon className="w-7 h-7" />
                  </div>
                  <span className="text-xs text-[#667781]">Envoyer le document</span>
                </div>
                <div onClick={() => setShowNewChatModal(true)} className="flex flex-col items-center gap-2 cursor-pointer group">
                  <div className="w-14 h-14 rounded-full bg-white shadow-md flex items-center justify-center text-[#54656f] group-hover:scale-110 transition-transform group-hover:bg-[#e9edef]">
                    <AddContactIcon className="w-7 h-7" />
                  </div>
                  <span className="text-xs text-[#667781]">Ajouter le contact</span>
                </div>
                <div onClick={() => setActiveTab('ai')} className="flex flex-col items-center gap-2 cursor-pointer group">
                  <div className="w-14 h-14 rounded-full bg-white shadow-md flex items-center justify-center group-hover:scale-110 transition-transform group-hover:bg-[#e9edef]">
                    <MetaAiIcon className="w-8 h-8" />
                  </div>
                  <span className="text-xs text-[#667781]">Demander à Kouma AI</span>
                </div>
              </div>

              <div className="space-y-2 pt-4">
                <h2 className="text-xl font-bold text-[#111b21]">WhatsApp Kouma Bilingue</h2>
                <p className="text-xs text-[#667781] max-w-xs mx-auto">
                  Discutez en temps réel en Dioula ou en Français avec traduction instantanée.
                </p>
                <button
                  onClick={() => setShowNewChatModal(true)}
                  className="mt-2 px-6 py-2.5 rounded-full bg-[#00a884] text-white font-bold text-xs shadow-md hover:bg-[#008f6f] hover:scale-105 transition-all"
                >
                  + Nouvelle discussion
                </button>
              </div>
            </div>
            <div className="text-xs text-[#667781] flex items-center gap-1.5">
              <LockIcon className="w-3.5 h-3.5 text-[#00a884]" />
              <span>Vos messages personnels sont chiffrés de bout en bout.</span>
            </div>
          </main>
        )}

        {/* ===== TIROIR INFOS CONTACT (DROITE) ===== */}
        {selectedUser && (
          <ContactInfoDrawer
            isOpen={showContactInfo}
            onClose={() => setShowContactInfo(false)}
            contact={selectedUser}
            avatarColor={getAvatarColor(selectedUser.id)}
            sharedMediaUrls={sharedMediaUrls}
            isMuted={mutedContactIds.includes(selectedUser.id)}
            onToggleMute={toggleMute}
            autoTranslate={autoTranslate}
            onToggleAutoTranslate={() => setAutoTranslate(!autoTranslate)}
            onStartCall={(isVideo) => setActiveCallModal({ name: selectedUser.username, isVideo, duration: 0 })}
            onClearChat={handleClearCurrentChat}
          />
        )}
      </div>

      {/* ===== VISIONNEUSE DE STATUTS (STORIES PLEIN ÉCRAN) ===== */}
      {viewingStatuses && (
        <StatusViewerModal
          statuses={viewingStatuses}
          initialIndex={statusInitialIndex}
          onClose={() => setViewingStatuses(null)}
          onStatusViewed={(statusId) => {
            setViewedStatusIds((prev) => {
              if (prev.includes(statusId)) return prev;
              const updated = [...prev, statusId];
              localStorage.setItem('kouma_viewed_statuses', JSON.stringify(updated));
              return updated;
            });
          }}
          onReply={(contactName, reply) => {
            alert(`Réponse envoyée à ${contactName} : "${reply}"`);
          }}
        />
      )}

      {/* ===== MODALE NOUVELLE DISCUSSION ===== */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-0 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#008069] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => setShowNewChatModal(false)} className="text-white/80 hover:text-white">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
                  </svg>
                </button>
                <h3 className="text-base font-semibold">Nouvelle discussion</h3>
              </div>
              <button onClick={() => setShowNewChatModal(false)} className="text-white/80 hover:text-white">
                ✕
              </button>
            </div>

            <div className="p-3 border-b border-[#e9edef]">
              <div className="bg-[#f0f2f5] rounded-lg px-3 py-2 flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="2" className="w-4 h-4">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  placeholder="Rechercher un contact..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-sm text-[#111b21] placeholder-[#8696a0] focus:outline-none w-full"
                />
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              <div
                onClick={() => { handleSelectUser(COMMUNITY_CHAT); setShowNewChatModal(false); setActiveTab('chats'); }}
                className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-[#f5f6f6] border-b border-[#f0f2f5]"
              >
                <div className="w-11 h-11 rounded-full bg-[#00a884]/20 text-[#00a884] flex items-center justify-center font-bold">
                  <CommunitiesIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[#111b21]">Canal général Kouma</h4>
                  <p className="text-xs text-[#667781]">Discussions publiques bilingues</p>
                </div>
              </div>

              {allContacts.filter((p) =>
                (p.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.email || '').toLowerCase().includes(searchQuery.toLowerCase())
              ).map((p) => (
                <div
                  key={p.id}
                  onClick={() => { handleSelectUser(p); setShowNewChatModal(false); setActiveTab('chats'); }}
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-[#f5f6f6] border-b border-[#f0f2f5]"
                >
                  <div className={`w-11 h-11 rounded-full ${getAvatarColor(p.id)} text-white flex items-center justify-center font-bold shrink-0 shadow-sm`}>
                    {(p.username || 'U')[0].toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#111b21]">{p.username}</h4>
                    <p className="text-xs text-[#667781]">{p.email || (p.language === 'dyu' ? '🇨🇮 Dioula' : '🇫🇷 Français')}</p>
                  </div>
                </div>
              ))}

              {allContacts.length === 0 && (
                <div className="p-8 text-center space-y-2">
                  <p className="text-sm text-[#667781] font-medium">Aucun autre contact pour l'instant.</p>
                  <p className="text-xs text-[#8696a0]">
                    Connectez-vous avec un autre compte dans un onglet privé pour dialoguer instantanément.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== MODALE APPEL WHATSAPP ===== */}
      {activeCallModal && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center animate-in fade-in duration-150">
          <div className="bg-[#1a2232] rounded-3xl max-w-xs w-full p-8 text-center text-white space-y-6 shadow-2xl border border-white/10">
            <div className={`w-24 h-24 rounded-full ${getAvatarColor(activeCallModal.name[0])} text-white text-3xl font-bold flex items-center justify-center mx-auto animate-pulse shadow-xl ring-4 ring-[#00a884]/40`}>
              {activeCallModal.name[0].toUpperCase()}
            </div>
            <div>
              <h3 className="text-xl font-bold">{activeCallModal.name}</h3>
              <p className="text-sm text-[#00a884] font-medium">
                {activeCallModal.isVideo ? 'Appel vidéo WhatsApp' : 'Appel vocal WhatsApp'}
              </p>
              <p className="text-xs text-white/60 mt-1">
                {Math.floor(activeCallModal.duration / 60)}:{(activeCallModal.duration % 60).toString().padStart(2, '0')}
              </p>
            </div>
            <div className="flex justify-center gap-6 pt-2">
              {activeCallModal.isVideo && (
                <button className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
                  <CameraIcon className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => setActiveCallModal(null)}
                className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-xl hover:scale-110 transition-transform flex items-center justify-center"
                title="Raccrocher"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                  <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07C8.44 16.29 5.71 13.56 4.07 10.46A19.79 19.79 0 0 1 1 1.82 2 2 0 0 1 3 .18h3a2 2 0 0 1 2 1.72c.128 1.003.37 1.987.72 2.94a2 2 0 0 1-.45 2.11L7 8.18" />
                  <line x1="23" y1="1" x2="1" y2="23" />
                </svg>
              </button>
              <button className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
                <MicIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODALE APERÇU PHOTO ET VUE UNIQUE ===== */}
      {pendingImage && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#e9edef]">
              <h3 className="text-sm font-bold text-[#111b21] flex items-center gap-2">
                <CameraIcon className="w-4 h-4 text-[#00a884]" /> Envoyer une photo
              </h3>
              <button onClick={() => setPendingImage(null)} className="text-[#667781] hover:text-[#111b21]">
                ✕
              </button>
            </div>
            <div className="relative rounded-xl overflow-hidden max-h-72 bg-black flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingImage} alt="Aperçu" className="max-h-72 w-auto object-contain" />
              {isViewOnceSelected && (
                <div className="absolute top-2 right-2 bg-[#00a884] text-white px-2.5 py-1 rounded-full text-xs font-bold shadow">
                  Vue unique ①
                </div>
              )}
            </div>
            <input
              type="text"
              value={imageCaption}
              onChange={(e) => setImageCaption(e.target.value)}
              placeholder="Ajouter une légende (traduite automatiquement)..."
              className="w-full px-4 py-2 rounded-lg bg-[#f0f2f5] text-[#111b21] text-sm focus:outline-none border border-[#e9edef]"
            />
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsViewOnceSelected(!isViewOnceSelected)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                  isViewOnceSelected ? 'bg-[#00a884] text-white border-[#00a884]' : 'bg-[#f0f2f5] text-[#667781] border-[#e9edef]'
                }`}
              >
                <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] font-bold">①</span>
                Vue unique
              </button>
              <div className="flex gap-2">
                <button onClick={() => setPendingImage(null)} className="px-4 py-2 rounded-lg bg-[#f0f2f5] text-sm text-[#667781] hover:bg-[#e9edef]">
                  Annuler
                </button>
                <button
                  onClick={handleSendImage}
                  disabled={sending}
                  className="px-5 py-2 rounded-lg bg-[#00a884] hover:bg-[#008f6f] text-white font-bold text-sm flex items-center gap-1.5 shadow"
                >
                  {sending ? 'Envoi...' : <><span>Envoyer</span><SendIcon className="w-4 h-4" /></>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== VISIONNEUSE PLEIN ÉCRAN ===== */}
      {activeViewOnceModal && (
        <div onClick={() => setActiveViewOnceModal(null)} className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center cursor-pointer p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={activeViewOnceModal} alt="Plein écran" className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl" />
        </div>
      )}

      {/* ===== MODALE CRÉATION DE STATUT ===== */}
      {showNewStatusModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#e9edef]">
              <h3 className="text-base font-bold text-[#111b21]">Ajouter un statut WhatsApp</h3>
              <button onClick={() => setShowNewStatusModal(false)} className="text-[#667781] hover:text-[#111b21]">
                ✕
              </button>
            </div>
            <form onSubmit={handleAddStatus} className="space-y-4">
              <div className={`p-6 rounded-2xl bg-gradient-to-br ${newStatusColor} flex items-center justify-center min-h-[160px]`}>
                <textarea
                  value={newStatusText}
                  onChange={(e) => setNewStatusText(e.target.value)}
                  placeholder="Tapez votre statut en Dioula ou Français..."
                  rows={3}
                  className="w-full bg-transparent text-white placeholder-white/70 text-center font-bold text-lg focus:outline-none resize-none drop-shadow"
                />
              </div>

              {/* Sélecteur de couleur de fond */}
              <div>
                <label className="block text-xs font-semibold text-[#667781] mb-2">Choisir une couleur :</label>
                <div className="flex gap-2">
                  {[
                    { key: 'from-emerald-600 to-teal-800', bg: 'bg-emerald-600' },
                    { key: 'from-indigo-600 to-purple-800', bg: 'bg-indigo-600' },
                    { key: 'from-amber-500 to-orange-700', bg: 'bg-amber-500' },
                    { key: 'from-rose-600 to-pink-800', bg: 'bg-rose-600' },
                    { key: 'from-blue-600 to-cyan-800', bg: 'bg-blue-600' },
                  ].map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setNewStatusColor(c.key)}
                      className={`w-7 h-7 rounded-full ${c.bg} transition-transform ${
                        newStatusColor === c.key ? 'scale-125 ring-2 ring-[#00a884] ring-offset-2' : 'hover:scale-110'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowNewStatusModal(false)} className="px-4 py-2 rounded-lg bg-[#f0f2f5] text-xs font-semibold text-[#667781]">
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!newStatusText.trim()}
                  className="px-5 py-2 rounded-lg bg-[#00a884] text-white font-bold text-xs shadow hover:bg-[#008f6f] disabled:opacity-50"
                >
                  Publier le statut
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODALE PARAMÈTRES ===== */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="bg-[#008069] text-white px-5 py-4 flex items-center justify-between">
              <h3 className="text-base font-semibold">Paramètres</h3>
              <button onClick={() => setShowSettings(false)}>✕</button>
            </div>
            <div className="p-5 space-y-5">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-full ${getAvatarColor(user.id)} text-white text-2xl font-bold flex items-center justify-center shadow-md`}>
                  {(myUsername || 'U')[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-[#667781] mb-1">Nom d'affichage</label>
                  <input
                    type="text"
                    value={myUsername}
                    onChange={(e) => setMyUsername(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#f0f2f5] text-sm text-[#111b21] focus:outline-none border border-[#e9edef]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#667781] mb-2">Votre langue principale</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMyLang('fr')}
                    className={`py-2.5 px-3 rounded-lg border text-sm font-semibold flex items-center justify-center gap-2 ${
                      myLang === 'fr' ? 'bg-[#d9fdd3] text-[#008069] border-[#00a884]' : 'bg-[#f0f2f5] text-[#667781] border-[#e9edef]'
                    }`}
                  >
                    🇫🇷 Français
                  </button>
                  <button
                    type="button"
                    onClick={() => setMyLang('dyu')}
                    className={`py-2.5 px-3 rounded-lg border text-sm font-semibold flex items-center justify-center gap-2 ${
                      myLang === 'dyu' ? 'bg-[#d9fdd3] text-[#008069] border-[#00a884]' : 'bg-[#f0f2f5] text-[#667781] border-[#e9edef]'
                    }`}
                  >
                    🇨🇮 Dioula (Julakan)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#667781] mb-1">Clé API Gemini (Optionnel)</label>
                <input
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="AIzaSy... (pour IA générative avancée)"
                  className="w-full px-3 py-2 rounded-lg bg-[#f0f2f5] text-xs text-[#111b21] focus:outline-none border border-[#e9edef]"
                />
              </div>

              <div className="pt-3 border-t border-[#e9edef] flex justify-between items-center">
                <button type="button" onClick={handleLogout} className="text-xs text-rose-500 font-bold hover:underline">Se déconnecter</button>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="px-5 py-2 rounded-lg bg-[#00a884] text-white font-bold text-sm shadow hover:bg-[#008f6f]"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
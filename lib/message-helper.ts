export interface ParsedMessage {
  originalText: string;
  translatedText?: string;
  sourceLang?: 'fr' | 'dyu';
  targetLang?: 'fr' | 'dyu';
  isTranslated: boolean;
  type?: 'text' | 'image' | 'audio' | 'document' | 'contact' | 'poll';
  mediaUrl?: string;
  isViewOnce?: boolean;
  viewOnceOpened?: boolean;
  duration?: number;
  caption?: string;
  fileName?: string;
  fileSize?: string;
  reactions?: Record<string, number>;
}

/**
 * Analyse le contenu d'un message Supabase (soit JSON enrichi multimédia, soit texte brut)
 */
export function parseMessageContent(rawContent: string): ParsedMessage {
  if (!rawContent) {
    return { originalText: '', isTranslated: false, type: 'text' };
  }

  // Tenter de parser comme JSON
  if (rawContent.startsWith('{') && rawContent.endsWith('}')) {
    try {
      const data = JSON.parse(rawContent);
      if (data && typeof data === 'object') {
        const type = data.type || (data.mediaUrl ? (data.mediaUrl.startsWith('data:audio') ? 'audio' : 'image') : 'text');

        return {
          originalText: data.caption || data.original || data.text || '',
          translatedText: data.translatedText || undefined,
          sourceLang: data.sourceLang || undefined,
          targetLang: data.targetLang || undefined,
          isTranslated: Boolean(data.translatedText && data.translatedText !== (data.caption || data.original || data.text)),
          type,
          mediaUrl: data.mediaUrl || undefined,
          isViewOnce: Boolean(data.isViewOnce),
          viewOnceOpened: Boolean(data.viewOnceOpened),
          duration: data.duration || undefined,
          caption: data.caption || undefined,
          fileName: data.fileName || undefined,
          fileSize: data.fileSize || undefined,
          reactions: data.reactions || undefined,
        };
      }
    } catch {
      // Échec de parsing, retomber sur le texte brut
    }
  }

  // Texte brut classique
  return {
    originalText: rawContent,
    isTranslated: false,
    type: 'text'
  };
}

/**
 * Encode un message texte ou multimédia pour Supabase
 */
export function encodeMessageContent(params: {
  originalText: string;
  translatedText?: string;
  sourceLang?: 'fr' | 'dyu';
  targetLang?: 'fr' | 'dyu';
  type?: 'text' | 'image' | 'audio' | 'document' | 'contact' | 'poll';
  mediaUrl?: string;
  isViewOnce?: boolean;
  duration?: number;
  caption?: string;
  fileName?: string;
  fileSize?: string;
  reactions?: Record<string, number>;
}): string {
  return JSON.stringify({
    text: params.originalText,
    original: params.originalText,
    translatedText: params.translatedText,
    sourceLang: params.sourceLang,
    targetLang: params.targetLang,
    type: params.type || 'text',
    mediaUrl: params.mediaUrl,
    isViewOnce: params.isViewOnce,
    duration: params.duration,
    caption: params.caption,
    fileName: params.fileName,
    fileSize: params.fileSize,
    reactions: params.reactions,
  });
}

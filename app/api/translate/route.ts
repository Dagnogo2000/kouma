import { NextRequest, NextResponse } from 'next/server';
import { translateLocal, detectLanguage } from '@/lib/translator';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, sourceLang: requestedSource, targetLang: requestedTarget, apiKey } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Texte requis' }, { status: 400 });
    }

    // Détection automatique si non précisé
    const detected = detectLanguage(text);
    const sourceLang: 'fr' | 'dyu' = requestedSource || detected;
    const targetLang: 'fr' | 'dyu' = requestedTarget || (sourceLang === 'fr' ? 'dyu' : 'fr');

    // 1. Tenter une traduction IA avec Gemini ou OpenAI si une clé est disponible
    const geminiKey = apiKey || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    const openAiKey = process.env.OPENAI_API_KEY;

    if (geminiKey) {
      try {
        const sourceLabel = sourceLang === 'dyu' ? 'Dioula (Julakan de Côte d\'Ivoire)' : 'Français';
        const targetLabel = targetLang === 'dyu' ? 'Dioula (Julakan de Côte d\'Ivoire)' : 'Français';
        
        const prompt = `Tu es un traducteur expert bilingue spécialisé dans la langue Dioula (Julakan / Mandingue parlé en Côte d'Ivoire, Burkina Faso et Mali) et le Français.
Traduis fidèlement, naturellement et de manière conversationnelle le texte suivant de ${sourceLabel} vers ${targetLabel}.
Ne renvoie QUE la traduction exacte, sans aucune explication, sans guillemets, ni texte additionnel.

Texte à traduire :
${text}`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 200 }
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const translated = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (translated) {
            return NextResponse.json({
              originalText: text,
              translatedText: translated,
              sourceLang,
              targetLang,
              engine: 'gemini-ai'
            });
          }
        }
      } catch (aiErr) {
        console.warn('Erreur API Gemini, bascule sur le moteur local:', aiErr);
      }
    } else if (openAiKey) {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openAiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'Tu es un traducteur expert entre le Français et le Dioula (Julakan). Renvoie uniquement la traduction directe sans blabla.'
              },
              {
                role: 'user',
                content: `Traduis de ${sourceLang === 'dyu' ? 'Dioula' : 'Français'} vers ${targetLang === 'dyu' ? 'Dioula' : 'Français'} :\n${text}`
              }
            ],
            temperature: 0.2
          })
        });

        if (res.ok) {
          const data = await res.json();
          const translated = data?.choices?.[0]?.message?.content?.trim();
          if (translated) {
            return NextResponse.json({
              originalText: text,
              translatedText: translated,
              sourceLang,
              targetLang,
              engine: 'openai'
            });
          }
        }
      } catch (openAiErr) {
        console.warn('Erreur API OpenAI, bascule sur le moteur local:', openAiErr);
      }
    }

    // 2. Moteur local intégré
    const localResult = translateLocal(text, sourceLang, targetLang);
    return NextResponse.json({
      ...localResult,
      engine: 'kouma-local'
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erreur interne de traduction';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

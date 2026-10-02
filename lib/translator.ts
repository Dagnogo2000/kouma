/**
 * Dictionnaire et moteur de traduction bilingue Dioula (Julakan) <-> Français
 * Comprend :
 * 1. Salutations et politesses du quotidien
 * 2. Questions et réponses fréquentes
 * 3. Expressions de la vie courante, famille, travail, commerce
 * 4. Dictionnaire de vocabulaire (mots clés, pronoms, verbes)
 * 5. Moteur de traduction par correspondance de phrases, lemmatisation et règles contextuelles
 */

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLang: 'fr' | 'dyu';
  targetLang: 'fr' | 'dyu';
  detectedLang?: 'fr' | 'dyu';
  confidence?: number;
}

// 1. Dictionnaire d'expressions complètes (sens exact / contextuel)
export const PHRASE_DICTIONARY: Array<{ dyu: string[]; fr: string[] }> = [
  // Salutations du matin
  {
    dyu: ['i ni sogoma', 'i ni sogoma wa', 'an ni sogoma', 'i nisogoma'],
    fr: ['bonjour', 'bonjour ce matin', 'bonjour à toi ce matin', 'bon réveil']
  },
  // Salutations du milieu de journée
  {
    dyu: ['i ni tle', 'an ni tle', 'i nitle'],
    fr: ['bon après-midi', 'bonne journée']
  },
  // Salutations du soir
  {
    dyu: ['i ni wula', 'an ni wula', 'i niwula'],
    fr: ['bonsoir', 'bonne fin de journée']
  },
  // Bonne nuit
  {
    dyu: ['i ni su', 'i ni sou', 'ka su here caya', 'ka sou here caya'],
    fr: ['bonne nuit', 'passe une bonne nuit']
  },
  // Comment vas-tu ?
  {
    dyu: ['i ka kene wa', 'i ka kene', 'i kene wa', 'i somogo be di', 'kori tana te', 'ko be di'],
    fr: ['comment vas-tu ?', 'comment vas-tu', 'comment tu vas ?', 'comment va la famille ?', 'tu vas bien ?', 'comment ça va ?', 'ça va ?']
  },
  // Ça va bien / Pas de problème
  {
    dyu: ['toro te', 'torote', 'kene don', 'tana si te', 'tana t\'a la', 'alhamdoulilah'],
    fr: ['ça va bien', 'tout va bien', 'pas de problème', 'je vais bien', 'la santé va bien', 'dieu merci']
  },
  // Remerciements
  {
    dyu: ['i ni ce', 'i ni tche', 'aw ni ce', 'aw ni tche', 'i nice'],
    fr: ['merci', 'merci beaucoup', 'merci à toi', 'merci à vous']
  },
  // De rien / Il n'y a pas de quoi
  {
    dyu: ['nba', 'nsee', 'foyi te', 'foyi t\'a la'],
    fr: ['de rien', 'je vous en prie', 'il n\'y a pas de quoi', 'ce n\'est rien']
  },
  // Salutation au travail
  {
    dyu: ['i ni baara', 'an ni baara', 'i ni baara wa'],
    fr: ['bon travail', 'courage pour le travail', 'bonne besogne']
  },
  // Au revoir / À bientôt
  {
    dyu: ['k\'an ben', 'kan ben', 'k\'an ben sini', 'k\'an ben don do'],
    fr: ['au revoir', 'à bientôt', 'à demain', 'à la prochaine']
  },
  // Pardon / Excuse-moi
  {
    dyu: ['haketo', 'haketto', 'sabali'],
    fr: ['pardon', 'excuse-moi', 's\'il te plaît', 'pardonnez-moi']
  },
  // Oui / Non / D'accord
  {
    dyu: ['ayo', 'awolo', 'o te foyi ye'],
    fr: ['oui', 'd\'accord', 'c\'est bien']
  },
  {
    dyu: ['ayi', 'ayi foyi'],
    fr: ['non', 'pas du tout']
  },
  // Amour / Affection
  {
    dyu: ['n\'b\'i fe', 'm\'bi fe', 'ne b\'i fe', 'ne bi fe'],
    fr: ['je t\'aime', 'je te veux', 'je tiens à toi']
  },
  // Qu'est-ce qu'il y a ?
  {
    dyu: ['mun be yen', 'mun lo', 'mun kera'],
    fr: ['qu\'est-ce qu\'il y a ?', 'qu\'est-ce qui s\'est passé ?', 'quoi de neuf ?']
  },
  // Rien du tout
  {
    dyu: ['foyi te yen', 'foyi te', 'fosi te'],
    fr: ['rien du tout', 'rien de neuf', 'il n\'y a rien']
  },
  // Où es-tu ?
  {
    dyu: ['i be min', 'i b\'i so wa'],
    fr: ['où es-tu ?', 'tu es où ?', 'es-tu à la maison ?']
  },
  // Je suis à la maison
  {
    dyu: ['ne be so', 'ne b\'i so', 'n\'be so'],
    fr: ['je suis à la maison', 'je suis chez moi']
  },
  // Tu fais quoi ?
  {
    dyu: ['i be mun ke', 'i be mun kera'],
    fr: ['tu fais quoi ?', 'que fais-tu ?', 'qu\'est-ce que tu fais ?']
  },
  // Je viens / J'arrive
  {
    dyu: ['n\'be na', 'ne be na', 'n\'sera'],
    fr: ['j\'arrive', 'je viens', 'je suis arrivé']
  },
  // Attends-moi
  {
    dyu: ['n\'kono', 'ne kono', 'makono'],
    fr: ['attends-moi', 'patiente un peu']
  },
  // C'est combien ?
  {
    dyu: ['joli lo', 'joli don', 'wari joli'],
    fr: ['c\'est combien ?', 'combien ça coûte ?', 'combien d\'argent ?']
  },
  // C'est trop cher
  {
    dyu: ['a gbele don', 'a ka gbele'],
    fr: ['c\'est trop cher', 'c\'est cher']
  },
  // Diminue un peu
  {
    dyu: ['dogo b\'a la', 'dogo n\'a la', 'a dogoya'],
    fr: ['diminue un peu', 'baisse un peu le prix']
  },
  // J'ai faim / J'ai soif
  {
    dyu: ['kongo b\'a n\'na', 'kongo be n\'na'],
    fr: ['j\'ai faim']
  },
  {
    dyu: ['minnoko be n\'na', 'minogo be n\'na'],
    fr: ['j\'ai soif']
  },
  // Allons manger
  {
    dyu: ['an ka taga dumuni ke', 'an ka dumuni ke'],
    fr: ['allons manger', 'mangeons ensemble']
  },
  // Bonne arrivée / Bienvenue
  {
    dyu: ['i bisimila', 'aw bisimila', 'i dansé', 'aw dansé'],
    fr: ['bienvenue', 'bonne arrivée', 'sois le bienvenu', 'soyez les bienvenus']
  }
];

// 2. Vocabulaire mot à mot pour les correspondances partielles
export const WORD_MAP_DYU_TO_FR: Record<string, string> = {
  // Pronoms
  'ne': 'moi',
  'n\'': 'je',
  'i': 'toi/tu',
  'a': 'il/elle',
  'an': 'nous',
  'aw': 'vous',
  'olu': 'eux/ils',
  'u': 'ils/elles',

  // Noms courants
  'wari': 'argent',
  'ji': 'eau',
  'so': 'maison',
  'baara': 'travail',
  'dumuni': 'nourriture',
  'terike': 'ami',
  'terimuso': 'amie',
  'den': 'enfant',
  'denke': 'fils',
  'denmuso': 'fille',
  'ba': 'mère',
  'fa': 'père',
  'koro': 'grand frère / aîné',
  'mogo': 'personne / gens',
  'sira': 'chemin / route',
  'tle': 'soleil / jour',
  'sogoma': 'matin',
  'wula': 'soir',
  'su': 'nuit',
  'sini': 'demain',
  'bi': 'aujourd\'hui',
  'kuno': 'hier',
  'dogo': 'marché',
  'sugu': 'marché',
  'kulusi': 'pantalon',
  'dereke': 'chemise',
  'mobili': 'voiture',
  'nege': 'vélo / fer',
  'tasuma': 'feu',
  'sankolo': 'ciel',
  'dugukolo': 'terre',

  // Verbes usuels
  'na': 'venir',
  'taga': 'partir / aller',
  'ke': 'faire',
  'fo': 'dire / saluer',
  'men': 'entendre / comprendre',
  'ye': 'voir',
  'san': 'acheter',
  'feere': 'vendre',
  'dun': 'manger',
  'min': 'boire',
  'sunogo': 'dormir',
  'wuli': 'se lever',
  'siggi': 's\'asseoir',
  'doni': 'donner',
  'ta': 'prendre',
  'kono': 'attendre',

  // Adjectifs & Adverbes
  'nyi': 'bon / beau / bien',
  'kanyi': 'bon',
  'juguyara': 'mauvais',
  'gbele': 'dur / difficile / cher',
  'nono': 'facile / doux',
  'fitini': 'petit',
  'dogonin': 'petit',
  'belebele': 'grand / gros',
  'kosobe': 'beaucoup / très',
  'donidoni': 'petit à petit / un peu',
  'ten': 'ainsi / comme ça',
  'yan': 'ici',
  'yen': 'là-bas',
  'fanmin': 'où / de quel côté',
  'joli': 'combien',
  'mun': 'quoi / quel'
};

// Inverse (Français vers Dioula)
export const WORD_MAP_FR_TO_DYU: Record<string, string> = {
  'bonjour': 'I ni sogoma',
  'bonsoir': 'I ni wula',
  'bonne nuit': 'Ka su here caya',
  'merci': 'I ni ce',
  'merci beaucoup': 'I ni ce kosobe',
  'oui': 'Ayo',
  'non': 'Ayi',
  'pardon': 'Haketo',
  'dieu': 'Ala',
  'argent': 'Wari',
  'eau': 'Ji',
  'maison': 'So',
  'travail': 'Baara',
  'nourriture': 'Dumuni',
  'ami': 'Terike',
  'manger': 'Dumuni ke',
  'boire': 'Ji min',
  'dormir': 'Sunogo',
  'venir': 'Na',
  'aller': 'Taga',
  'partir': 'Taga',
  'combien': 'Joli',
  'cher': 'Gbele',
  'ici': 'Yan',
  'là-bas': 'Yen',
  'aujourd\'hui': 'Bi',
  'demain': 'Sini',
  'hier': 'Kuno',
  'bien': 'Kanyi',
  'beaucoup': 'Kosobe',
  'un peu': 'Doni doni'
};

/**
 * Nettoyage et normalisation du texte pour la recherche
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Détection automatique de la langue (Français vs Dioula)
 */
export function detectLanguage(text: string): 'fr' | 'dyu' {
  const norm = normalize(text);
  const words = norm.split(' ');

  let dyuScore = 0;
  let frScore = 0;

  // Marqueurs dioula fréquents
  const dyuMarkers = ['ni', 'ka', 'be', 'b\'i', 't\'a', 'wa', 'sogoma', 'tle', 'wula', 'toro', 'kene', 'ce', 'aw', 'ne', 'k\'an', 'foyi', 'wari', 'dumuni', 'baara'];
  // Marqueurs français fréquents
  const frMarkers = ['le', 'la', 'les', 'un', 'une', 'des', 'bonjour', 'merci', 'comment', 'ça', 'va', 'oui', 'non', 'suis', 'est', 'pour', 'avec', 'tu', 'vous', 'je'];

  for (const w of words) {
    if (dyuMarkers.includes(w) || WORD_MAP_DYU_TO_FR[w]) dyuScore += 2;
    if (frMarkers.includes(w) || WORD_MAP_FR_TO_DYU[w]) frScore += 2;
  }

  // Vérifier également les expressions complètes
  for (const entry of PHRASE_DICTIONARY) {
    if (entry.dyu.some(d => norm.includes(normalize(d)))) dyuScore += 5;
    if (entry.fr.some(f => norm.includes(normalize(f)))) frScore += 5;
  }

  return dyuScore >= frScore && dyuScore > 0 ? 'dyu' : 'fr';
}

/**
 * Traduction Dioula <-> Français en mode local (instantané et hors-ligne)
 */
export function translateLocal(
  text: string,
  sourceLang: 'fr' | 'dyu',
  targetLang: 'fr' | 'dyu'
): TranslationResult {
  const norm = normalize(text);

  if (sourceLang === targetLang || !text.trim()) {
    return {
      originalText: text,
      translatedText: text,
      sourceLang,
      targetLang,
      confidence: 1.0
    };
  }

  // 1. Recherche par expression complète exacte ou approchée
  for (const item of PHRASE_DICTIONARY) {
    if (sourceLang === 'dyu' && targetLang === 'fr') {
      const match = item.dyu.find(p => norm === normalize(p) || norm.includes(normalize(p)));
      if (match) {
        return {
          originalText: text,
          translatedText: capitalize(item.fr[0]),
          sourceLang,
          targetLang,
          confidence: 0.95
        };
      }
    } else if (sourceLang === 'fr' && targetLang === 'dyu') {
      const match = item.fr.find(p => norm === normalize(p) || norm.includes(normalize(p)));
      if (match) {
        return {
          originalText: text,
          translatedText: capitalize(item.dyu[0]),
          sourceLang,
          targetLang,
          confidence: 0.95
        };
      }
    }
  }

  // 2. Traduction mot par mot / contextuelle si pas d'expression complète
  const words = text.split(/\s+/);
  const translatedWords = words.map(rawWord => {
    const cleanWord = rawWord.toLowerCase().replace(/[^a-zA-Z'éèàêëîïôöùûüç]/g, '');
    let translated = '';

    if (sourceLang === 'dyu' && targetLang === 'fr') {
      translated = WORD_MAP_DYU_TO_FR[cleanWord] || '';
    } else if (sourceLang === 'fr' && targetLang === 'dyu') {
      translated = WORD_MAP_FR_TO_DYU[cleanWord] || '';
    }

    if (translated) {
      // Préserver la ponctuation originale
      const punc = rawWord.replace(/[a-zA-Z'éèàêëîïôöùûüç]/g, '');
      return translated + punc;
    }
    return rawWord;
  });

  const translatedText = translatedWords.join(' ');

  return {
    originalText: text,
    translatedText: capitalize(translatedText),
    sourceLang,
    targetLang,
    confidence: 0.7
  };
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

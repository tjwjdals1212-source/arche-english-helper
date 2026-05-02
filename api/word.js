const PART_OF_SPEECH_KO = {
  noun: '명사',
  verb: '동사',
  adjective: '형용사',
  adverb: '부사',
  pronoun: '대명사',
  preposition: '전치사',
  conjunction: '접속사',
  interjection: '감탄사',
  determiner: '한정사',
  article: '관사',
  numeral: '수사',
  exclamation: '감탄사',
  unknown: '품사',
};

const BASIC_KOREAN_HINTS = {
  escape: [
    { pos: '동사', text: '도망치다, 탈출하다, 벗어나다' },
    { pos: '동사', text: '피하다' },
    { pos: '명사', text: '탈출, 도망' },
  ],
};

function isAuthorized(reqPassword) {
  const pw = process.env.SITE_PASSWORD || '';
  return pw && reqPassword && pw === reqPassword;
}

function normalizeWord(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z\-'\s]/g, '')
    .replace(/\s+/g, ' ');
}

function getWordCache() {
  if (!globalThis.__ARKE_WORD_CACHE__) {
    globalThis.__ARKE_WORD_CACHE__ = new Map();
  }
  return globalThis.__ARKE_WORD_CACHE__;
}

function getTranslationCache() {
  if (!globalThis.__ARKE_TRANSLATION_CACHE__) {
    globalThis.__ARKE_TRANSLATION_CACHE__ = new Map();
  }
  return globalThis.__ARKE_TRANSLATION_CACHE__;
}

function getPartOfSpeechKo(partOfSpeech) {
  return PART_OF_SPEECH_KO[String(partOfSpeech || '').toLowerCase()] || '품사';
}

function simplifyKoreanText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replaceAll(' ; ', '; ')
    .trim();
}

async function translateToKorean(text) {
  const source = String(text || '').trim();
  if (!source) return '';

  const cache = getTranslationCache();
  const cached = cache.get(source);
  if (cached) return cached;

  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=' +
    encodeURIComponent(source);

  const response = await fetch(url);
  if (!response.ok) {
    return '';
  }

  const data = await response.json();
  const translated = Array.isArray(data?.[0])
    ? data[0].map((part) => part?.[0] || '').join('')
    : '';
  const result = simplifyKoreanText(translated);

  if (result) {
    cache.set(source, result);
  }

  return result;
}

function collectDefinitions(meanings) {
  const collected = [];
  const seen = new Set();

  for (const meaning of meanings.slice(0, 4)) {
    const partOfSpeech = getPartOfSpeechKo(meaning.partOfSpeech);
    const definitions = Array.isArray(meaning.definitions) ? meaning.definitions : [];

    for (const def of definitions.slice(0, 2)) {
      const definition = String(def.definition || '').trim();
      if (!definition || seen.has(`${partOfSpeech}:${definition}`)) continue;

      collected.push({
        partOfSpeech,
        definition,
        example: String(def.example || '').trim(),
      });
      seen.add(`${partOfSpeech}:${definition}`);

      if (collected.length >= 5) return collected;
    }
  }

  return collected;
}

async function formatDefinitionLine(item) {
  const translated = await translateToKorean(item.definition);
  if (!translated) {
    return `- ${item.partOfSpeech}: 한국어 뜻을 가져오지 못했습니다.`;
  }

  return `- ${item.partOfSpeech}: ${translated}`;
}

async function formatExampleLine(item, index) {
  if (!item.example) return '';

  const translated = await translateToKorean(item.example);
  if (!translated) {
    return `- 예문 ${index + 1}: ${item.example}`;
  }

  return `- 예문 ${index + 1}: ${item.example}\n  뜻: ${translated}`;
}

async function formatWordEntry(word, entry) {
  const meanings = Array.isArray(entry.meanings) ? entry.meanings : [];
  const definitions = collectDefinitions(meanings);
  const hintLines = BASIC_KOREAN_HINTS[word] || [];

  const lines = [];
  lines.push(`1) 단어: ${word}`);
  lines.push('2) 뜻/품사');

  if (hintLines.length > 0) {
    hintLines.forEach((hint) => {
      lines.push(`- ${hint.pos}: ${hint.text}`);
    });
  } else if (definitions.length > 0) {
    const translatedLines = await Promise.all(definitions.map(formatDefinitionLine));
    lines.push(...translatedLines);
  } else {
    lines.push('- 한국어 뜻을 찾지 못했습니다.');
  }

  const examples = definitions.filter((item) => item.example).slice(0, 2);
  lines.push('3) 예문');

  if (examples.length === 0) {
    lines.push('- 예문 없음');
  } else {
    const exampleLines = await Promise.all(examples.map(formatExampleLine));
    lines.push(...exampleLines.filter(Boolean));
  }

  lines.push('');
  lines.push('참고: 발음은 위의 "발음 듣기" 버튼을 눌러 확인하세요.');

  return lines.join('\n');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST만 가능합니다.' });
  }

  try {
    const { text, password } = req.body || {};

    if (!isAuthorized(password)) {
      return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
    }

    const word = normalizeWord(text);
    if (!word) {
      return res.status(400).json({ error: '영단어를 입력하세요.' });
    }

    const cache = getWordCache();
    const cached = cache.get(word);
    if (cached) {
      return res.status(200).json({ result: cached, cached: true });
    }

    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    const data = await response.json();

    if (!response.ok || !Array.isArray(data) || data.length === 0) {
      return res.status(404).json({ error: '사전에서 이 단어를 찾지 못했습니다.' });
    }

    const result = await formatWordEntry(word, data[0]);
    cache.set(word, result);

    return res.status(200).json({ result, cached: false });
  } catch (error) {
    return res.status(500).json({ error: error.message || '단어 조회 중 서버 오류가 발생했습니다.' });
  }
}

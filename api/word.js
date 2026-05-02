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

function formatWordEntry(word, entry) {
  const phonetic = entry.phonetic || (Array.isArray(entry.phonetics) ? entry.phonetics.find(p => p && p.text)?.text : '') || '';
  const meanings = Array.isArray(entry.meanings) ? entry.meanings : [];

  const lines = [];
  lines.push(`1) 단어: ${word}`);
  lines.push(`2) 발음: ${phonetic || '표시 없음'}`);
  lines.push('3) 뜻/품사');

  const meaningLines = [];
  const exampleLines = [];

  meanings.slice(0, 3).forEach((meaning, meaningIndex) => {
    const partOfSpeech = meaning.partOfSpeech || 'unknown';
    const definitions = Array.isArray(meaning.definitions) ? meaning.definitions : [];

    definitions.slice(0, 2).forEach((def, defIndex) => {
      const label = `${meaningIndex + 1}-${defIndex + 1}`;
      const definition = String(def.definition || '').trim();
      if (definition) {
        meaningLines.push(`- ${partOfSpeech}: ${definition}`);
      }

      const example = String(def.example || '').trim();
      if (example) {
        exampleLines.push(`- ${label}) ${example}`);
      }
    });
  });

  if (meaningLines.length === 0) {
    meaningLines.push('- 뜻을 찾지 못했습니다.');
  }

  lines.push(...meaningLines);
  lines.push('4) 예문');

  if (exampleLines.length === 0) {
    lines.push('- 예문 없음');
  } else {
    lines.push(...exampleLines.slice(0, 2));
  }

  lines.push('');
  lines.push('참고: 단어 뜻은 빠른 사전 모드로 보여줍니다.');

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

    const result = formatWordEntry(word, data[0]);
    cache.set(word, result);

    return res.status(200).json({ result, cached: false });
  } catch (error) {
    return res.status(500).json({ error: error.message || '단어 조회 중 서버 오류가 발생했습니다.' });
  }
}

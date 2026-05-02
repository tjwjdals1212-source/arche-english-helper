function isAuthorized(reqPassword) {
  const pw = process.env.SITE_PASSWORD || '';
  return pw && reqPassword && pw === reqPassword;
}

function normalizeSentence(text) {
  return String(text || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function getSentenceCache() {
  if (!globalThis.__ARKE_SENTENCE_CACHE__) {
    globalThis.__ARKE_SENTENCE_CACHE__ = new Map();
  }
  return globalThis.__ARKE_SENTENCE_CACHE__;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 가능합니다.' });
  }

  try {
    const { mode, text, password } = req.body || {};

    if (!isAuthorized(password)) {
      return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
    }

    if (mode !== 'sentence') {
      return res.status(400).json({
        error: '이 경로는 문장 검사 전용입니다. 단어 뜻찾기는 /api/word를 사용하세요.',
      });
    }

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: '문장을 입력해주세요.' });
    }

    const sentenceKey = normalizeSentence(text);
    const cache = getSentenceCache();
    const cached = cache.get(sentenceKey);
    if (cached) {
      return res.status(200).json({ result: cached, cached: true });
    }

    const systemPrompt =
      '너는 초등학생을 위한 영어 문장 검사 선생님이다. 문법 용어를 쓰되 어렵게 말하지 않고, 문장 성분과 품사 기준으로 정확하고 친절하게 설명한다.';

    const userPrompt = `다음 영어 문장을 검사해줘.
${text}

중요:
- 가능한 올바른 문장이 2개 이상이면 여러 가능성을 제시해라.
- 실제로는 매우 자연스러운 차이만 있는 경우도 쉽게 설명해라.
- 답이 하나만 있다고 단정하지 마라.
- 초등학생도 이해할 수 있게 풀어서 설명해라.
- 왜 틀렸는지 반드시 문법 구조로 설명해라. 예: be동사 + 일반동사 원형, 동사 2개 충돌, to부정사 누락, 시제 문제, 주어-동사 수일치 문제 등.
- 틀린 문장을 한국어로 직역하면 왜 어색해지는지도 짧게 보여줘라.
- 올바른 문장이 여러 개 가능하면 의미 차이까지 설명해라.
- 학생이 다음에 같은 실수를 피할 수 있도록 한 줄 규칙을 적어라.
- 예를 들어 "I am swim."은 "am"과 "swim"이 동사처럼 충돌하므로 틀리고, 직역하면 "나는 수영하다이다"처럼 어색하다. 진행 중인 동작이면 "I am swimming.", 평소 습관이면 "I swim."이 맞다고 설명해라.

형식:
1) 맞는 문장인지 먼저 말하기
2) 틀린 부분
3) 왜 틀렸는지
4) 한국어로 직역하면 왜 어색한지
5) 가능한 올바른 문장
6) 문장들 사이의 차이
7) 다음에 기억할 규칙`;

    const openaiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: systemPrompt }],
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: userPrompt }],
          },
        ],
        max_output_tokens: 650,
      }),
    });

    const data = await openaiRes.json();

    if (!openaiRes.ok) {
      const message =
        data?.error?.code === 'insufficient_quota'
          ? '크레딧이 부족합니다. OpenAI Billing에서 결제 수단이나 크레딧 상태를 확인해주세요.'
          : data?.error?.message || 'OpenAI API 오류가 발생했습니다.';
      return res.status(openaiRes.status).json({ error: message });
    }

    let result = data.output_text || '';

    if (!result && Array.isArray(data.output)) {
      const texts = [];
      for (const item of data.output) {
        if (!Array.isArray(item.content)) continue;
        for (const contentItem of item.content) {
          if (contentItem.type === 'output_text' && contentItem.text) {
            texts.push(contentItem.text);
          }
        }
      }
      result = texts.join('\n');
    }

    const finalResult = result || '응답이 비어 있습니다.';
    cache.set(sentenceKey, finalResult);

    return res.status(200).json({ result: finalResult, cached: false });
  } catch (error) {
    return res.status(500).json({ error: error.message || '서버 오류가 발생했습니다.' });
  }
}

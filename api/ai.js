export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST만 가능합니다.' });
  }

  try {
    const { mode, text } = req.body || {};

    let userPrompt = '';
    let systemPrompt = '너는 한국 학생을 위한 영어 도우미다. 정확하고 짧고 이해하기 쉽게 설명한다.';

    if (mode === 'test') {
      systemPrompt = '너는 아주 짧게 대답하는 도우미다.';
      userPrompt = '연결 테스트입니다. 정확히 "연결 성공"이라고만 답해줘.';
    } else if (mode === 'word') {
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: '단어를 입력하세요.' });
      }
      userPrompt = `다음 영단어를 설명해줘.
단어: ${text}

형식:
1) 뜻
2) 품사
3) 쉬운 예문 2개`;
    } else if (mode === 'sentence') {
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: '문장을 입력하세요.' });
      }
      userPrompt = `다음 영문장을 검사해줘:
${text}

형식:
1) 맞는 문장인지 먼저 말하기
2) 틀린 부분
3) 이유
4) 올바른 문장`;
    } else {
      return res.status(400).json({ error: '알 수 없는 요청입니다.' });
    }

    const openaiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: systemPrompt }]
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: userPrompt }]
          }
        ]
      })
    });

    const data = await openaiRes.json();

    if (!openaiRes.ok) {
      const message = data?.error?.code === 'insufficient_quota'
        ? '크레딧이 없습니다. OpenAI Billing에서 결제 또는 크레딧 충전이 필요합니다.'
        : (data?.error?.message || 'OpenAI API 오류가 발생했습니다.');
      return res.status(openaiRes.status).json({ error: message });
    }

    let result = data.output_text || '';

    if (!result && Array.isArray(data.output)) {
      const texts = [];
      for (const item of data.output) {
        if (Array.isArray(item.content)) {
          for (const c of item.content) {
            if (c.type === 'output_text' && c.text) texts.push(c.text);
          }
        }
      }
      result = texts.join('\n');
    }

    return res.status(200).json({ result: result || '응답이 없습니다.' });
  } catch (error) {
    return res.status(500).json({ error: error.message || '서버 오류가 발생했습니다.' });
  }
}

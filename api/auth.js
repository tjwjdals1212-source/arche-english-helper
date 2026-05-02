export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST만 가능합니다.' });
  }

  const { password } = req.body || {};
  const sitePassword = process.env.SITE_PASSWORD || '';

  if (!sitePassword) {
    return res.status(500).json({ error: '사이트 비밀번호가 설정되지 않았습니다.' });
  }

  if (password === sitePassword) {
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ ok: false, error: '비밀번호가 틀렸습니다.' });
}

아르케 영어 도우미 - 학생용 초간단 Vercel 배포용

이 버전은 학생용으로 가장 단순하게 만든 링크 배포용 버전입니다.
잠금 비밀번호가 없고, API 키는 Vercel 환경변수에 숨깁니다.

[들어있는 것]
- index.html
- api/ai.js
- vercel.json
- package.json

[꼭 할 것]
1. 이 zip을 압축 푼다
2. GitHub 저장소를 만든다
3. 압축 푼 파일들을 GitHub에 올린다
4. Vercel에서 그 저장소를 Import 한다
5. Environment Variables에 OPENAI_API_KEY 를 넣는다
6. Deploy 한다

[환경변수 이름]
OPENAI_API_KEY

[주의]
- zip 파일 자체를 GitHub에 올리지 말고, 압축 푼 안의 파일들을 올리세요.
- 학생 화면에는 API 키가 보이지 않습니다.

import { expect, mock, test } from 'claude-code/testing'

type Reply = { status?: number; content?: string }

/** Stands for the engine and a translator endpoint answering `replies` in turn. */
function world(on: any, replies: Reply[], env: Record<string, string> = { CC_TRANSLATE_API_KEY: 'k', HOME: '/nonexistent' }) {
  const sent: { url: string; body: any; headers: Record<string, string> }[] = []
  const entered: string[] = []
  mock.env(on, env)
  mock.store(on)
  mock.clock(on)
  on('http.fetch', (_: any, e: any) => {
    sent.push({ url: e.url, body: JSON.parse(e.init.body), headers: e.init.headers })
    const r = replies.shift() ?? { status: 500 }
    const status = r.status ?? 200
    const text = JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: r.content } }] })
    return { value: { status, ok: status < 300, headers: {}, text } }
  })
  on('fs.read', () => {
    throw new Error('ENOENT')
  })
  on('prompt.submit', (_: any, e: any) => {
    entered.push(e.text)
    return { text: e.text }
  })
  return { sent, entered }
}

const ask = (text: string) => ({ text, asUser: true }) as any

test('a Chinese prompt enters in English; the whole prompt goes to the model', async ($, on) => {
  const w = world(on, [{ content: 'Fix the bug in `login()` in src/auth.ts' }])
  const r = await $.prompt.submit(ask('修一下 src/auth.ts 里 `login()` 的 bug'))
  expect(r.drop).toBeUndefined()
  expect(w.entered).toEqual(['Fix the bug in `login()` in src/auth.ts'])
  const body = w.sent[0]!.body
  expect(w.sent[0]!.url).toBe('https://api.deepseek.com/chat/completions')
  expect(body.model).toBe('deepseek-flash')
  expect(body.thinking).toEqual({ type: 'disabled' })
  expect(body.messages[1].content).toBe('修一下 src/auth.ts 里 `login()` 的 bug')
  expect(w.sent[0]!.headers.authorization).toBe('Bearer k')
})

test('English prompts pass untouched, with no request', async ($, on) => {
  const w = world(on, [])
  await $.prompt.submit(ask('fix the login bug'))
  expect(w.entered).toEqual(['fix the login bug'])
  expect(w.sent.length).toBe(0)
})

test('translator error: dropped with the reason, Chinese never enters', async ($, on) => {
  const w = world(on, [{ status: 401 }])
  const r = await $.prompt.submit(ask('帮我写测试'))
  expect(r.drop).toContain('HTTP 401')
  expect(w.entered).toEqual([])
})

test('no API key: dropped without a request', async ($, on) => {
  const w = world(on, [], { HOME: '/nonexistent' })
  const r = await $.prompt.submit(ask('帮我写测试'))
  expect(r.drop).toContain('CC_TRANSLATE_API_KEY')
  expect(w.sent.length).toBe(0)
  expect(w.entered).toEqual([])
})

test('Chinese left in the answer: one strict retry, then dropped', async ($, on) => {
  const w = world(on, [{ content: 'Change the label to「登录」' }, { content: 'Change it to 登录' }])
  const r = await $.prompt.submit(ask('把按钮文字改成「登录」'))
  expect(w.sent.length).toBe(2)
  expect(w.sent[1]!.body.messages[0].content).toContain('previous answer still contained')
  expect(r.drop).toBeDefined()
  expect(w.entered).toEqual([])
})

test('Chinese left once, clean on the retry: sent', async ($, on) => {
  const w = world(on, [{ content: 'Change the label to「登录」' }, { content: 'Change the button label to "Log in"' }])
  await $.prompt.submit(ask('把按钮文字改成「登录」'))
  expect(w.entered).toEqual(['Change the button label to "Log in"'])
})

test('a code block with Chinese comments is translated too, never sent as is', async ($, on) => {
  const w = world(on, [{ content: 'Explain:\n```js\nf() // retry\n```' }])
  await $.prompt.submit(ask('解释：\n```js\nf() // 重试\n```'))
  expect(w.entered).toEqual(['Explain:\n```js\nf() // retry\n```'])
})

test('a thinking block before the answer is stripped', async ($, on) => {
  const w = world(on, [{ content: '<think>hmm</think>\nWrite tests' }])
  await $.prompt.submit(ask('写测试'))
  expect(w.entered).toEqual(['Write tests'])
})

test('a mention whose path is Chinese is not sent, with no request', async ($, on) => {
  const w = world(on, [{ content: 'Read @docs/design.md' }])
  const r = await $.prompt.submit(ask('读一下 @docs/设计.md'))
  expect(r.drop).toContain('@docs/设计.md')
  expect(w.sent.length).toBe(0)
  expect(w.entered).toEqual([])
})

test('an English mention in a Chinese prompt is fine', async ($, on) => {
  const w = world(on, [{ content: 'Read @docs/design.md' }])
  await $.prompt.submit(ask('读一下 @docs/design.md'))
  expect(w.entered).toEqual(['Read @docs/design.md'])
})

test('provider settings come from options: url, model, key, extra fields', { options: { base_url: 'https://api.openai.com/v1/', model: 'small-model', api_key: 'opt-key', extra_body: '{}' } }, async ($, on) => {
  const w = world(on, [{ content: 'Hello' }])
  await $.prompt.submit(ask('你好'))
  expect(w.sent[0]!.url).toBe('https://api.openai.com/v1/chat/completions')
  expect(w.sent[0]!.body.model).toBe('small-model')
  expect(w.sent[0]!.body.thinking).toBeUndefined()
  expect(w.sent[0]!.headers.authorization).toBe('Bearer opt-key') // the option wins over the env
})

test('a custom extra_body is merged into the request', { options: { extra_body: '{"reasoning_effort":"none","top_p":0.5}' } }, async ($, on) => {
  const w = world(on, [{ content: 'Hello' }])
  await $.prompt.submit(ask('你好'))
  expect(w.sent[0]!.body.reasoning_effort).toBe('none')
  expect(w.sent[0]!.body.top_p).toBe(0.5)
})

test('HTTP 400 with extra fields hints at extra_body', async ($, on) => {
  world(on, [{ status: 400 }])
  const r = await $.prompt.submit(ask('你好'))
  expect(r.drop).toContain('extra_body')
})

test('no base_url: dropped, saying to configure it', { options: { base_url: '' } }, async ($, on) => {
  const w = world(on, [])
  const r = await $.prompt.submit(ask('你好'))
  expect(r.drop).toContain('base_url')
  expect(w.sent.length).toBe(0)
})

test('Japanese: a Japanese prompt is translated, and messages are in Japanese', { options: { lang: 'Japanese' } }, async ($, on) => {
  const w = world(on, [{ content: 'Fix the login bug' }, { status: 500 }])
  await $.prompt.submit(ask('ログインのバグを直して'))
  expect(w.entered).toEqual(['Fix the login bug'])
  const r = await $.prompt.submit(ask('テストを書いて'))
  expect(r.drop).toContain('翻訳に失敗')
})

test('Korean: a Korean prompt is translated', { options: { lang: 'Korean' } }, async ($, on) => {
  const w = world(on, [{ content: 'Write tests' }])
  await $.prompt.submit(ask('테스트를 작성해 줘'))
  expect(w.entered).toEqual(['Write tests'])
})

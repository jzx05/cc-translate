import { expect, mock, test } from 'claude-code/testing'

const MSG = (text: string) =>
  ({ plugin: 'cc-translate', surface: 'terminal', component: 'AssistantMessage', requestId: 'm1', props: { text, isFirstOfReply: true } }) as const

type Answer = { status: number; content?: string }

function world(on: any, answer: (user: string, n: number) => Answer, store: Record<string, unknown> = {}) {
  const drawn: string[] = []
  const sent: string[] = []
  const toasts: string[] = []
  const systems: string[] = []
  mock.env(on, { CC_TRANSLATE_API_KEY: 'k', HOME: '/x' })
  mock.store(on, store)
  const clock = mock.clock(on)
  on('fs.read', () => {
    throw new Error('ENOENT')
  })
  on('ui.toast', (_: any, e: any) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('command.register', (_: any, e: any) => ({ value: { command: e.name } }))
  on('ui.status', () => ({ value: undefined }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('http.fetch', (_: any, e: any) => {
    const messages = JSON.parse(e.init.body).messages
    const user: string = messages[1].content
    systems.push(messages[0].content)
    sent.push(user)
    const a = answer(user, sent.length)
    return { value: { status: a.status, ok: a.status < 300, headers: {}, text: JSON.stringify({ choices: [{ message: { content: a.content } }] }) } }
  })
  // Stands for the engine's own drawing: records the text it is handed.
  on('ui.render', { component: 'AssistantMessage' }, ($: any, e: any) => {
    drawn.push(e.props.text)
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.text}</Text>
  })
  return { drawn, sent, toasts, systems, clock }
}

test('a reply is drawn in English, then in Chinese once it settles', async ($, on) => {
  const w = world(on, () => ({ status: 200, content: '我修好了 `auth.ts` 里的问题。' }))
  const ui = await $.ui.mount(MSG('I fixed the issue in `auth.ts`.'))
  expect(w.drawn.at(-1)).toBe('I fixed the issue in `auth.ts`.')
  expect(w.sent.length).toBe(0)
  await w.clock.advance(1300)
  expect(w.sent.length).toBe(1)
  expect(w.drawn.at(-1)).toBe('我修好了 `auth.ts` 里的问题。')
  await ui.unmount()
})

test('code blocks are never sent and come back byte for byte', async ($, on) => {
  const md = 'Run this:\n\n```bash\nnpm test -- --watch\n```\n\nThen commit.'
  const w = world(on, user => ({ status: 200, content: user.replace('Run this:', '运行：').replace('Then commit.', '然后提交。') }))
  const ui = await $.ui.mount(MSG(md))
  await w.clock.advance(1300)
  expect(w.sent.length).toBe(1) // one request for the whole block
  expect(w.sent[0]).not.toContain('npm test')
  expect(w.drawn.at(-1)).toBe('运行：\n\n```bash\nnpm test -- --watch\n```\n\n然后提交。')
  await ui.unmount()
})

test('a long reply: the chunk that fails stays English, the rest is translated, and it says so', async ($, on) => {
  const a = 'First part. ' + 'alpha '.repeat(700)
  const b = 'Second part. ' + 'beta '.repeat(700)
  const w = world(on, user => (user.startsWith('First') ? { status: 200, content: '第一部分。' } : { status: 503 }))
  const ui = await $.ui.mount(MSG(`${a}\n\n${b}`))
  await w.clock.advance(1300)
  expect(w.sent.length).toBe(2)
  expect(w.drawn.at(-1)).toBe(`第一部分。\n\n${b}`)
  expect(w.toasts.some(t => t.includes('1 段') && t.includes('HTTP 503'))).toBe(true)
  await ui.unmount()
})

test('a failed reply stays English, says why, and /translate retry translates it again', async ($, on) => {
  let up = false
  const w = world(on, () => (up ? { status: 200, content: '完成。' } : { status: 503 }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true } as any)
  const ui = await $.ui.mount(MSG('Done.'))
  await w.clock.advance(1300)
  expect(w.drawn.at(-1)).toBe('Done.')
  expect(w.toasts.some(t => t.includes('HTTP 503'))).toBe(true)
  await w.clock.advance(5000)
  expect(w.sent.length).toBe(1) // not retried on its own
  up = true
  await $.command.run({ command: 'translate', args: 'retry' } as any)
  await w.clock.advance(1300)
  expect(w.sent.length).toBe(2)
  expect(w.drawn.at(-1)).toBe('完成。')
  await ui.unmount()
})

test('a code block lost by the model: that chunk stays English', async ($, on) => {
  const w = world(on, () => ({ status: 200, content: '运行：' }))
  const ui = await $.ui.mount(MSG('Run:\n```\nls\n```'))
  await w.clock.advance(1300)
  expect(w.drawn.at(-1)).toBe('Run:\n```\nls\n```')
  expect(w.toasts.some(t => t.includes('code blocks'))).toBe(true)
  await ui.unmount()
})

test('a Chinese reply is left alone', async ($, on) => {
  const w = world(on, () => ({ status: 200, content: 'x' }))
  const ui = await $.ui.mount(MSG('已经完成了。'))
  await w.clock.advance(1300)
  expect(w.sent.length).toBe(0)
  await ui.unmount()
})

test('/translate config shows the settings in force, never the key', async ($, on) => {
  world(on, () => ({ status: 200 }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true } as any)
  const r: any = await $.command.run({ command: 'translate', args: 'config' } as any)
  expect(r.text).toContain('https://api.deepseek.com')
  expect(r.text).toContain('deepseek-flash')
  expect(r.text).toContain('环境变量')
  expect(r.text).not.toContain('Bearer')
  expect(r.text).not.toMatch(/\bk\b/)
})

test('replies are translated into the chosen language', { options: { lang: 'Korean' } }, async ($, on) => {
  const w = world(on, () => ({ status: 200, content: '완료했습니다.' }))
  const ui = await $.ui.mount(MSG('Done.'))
  await w.clock.advance(1300)
  expect(w.systems[0]).toContain('into Korean')
  expect(w.drawn.at(-1)).toBe('완료했습니다.')
  await ui.unmount()
})

test('two blocks are translated side by side, not one after another', async ($, on) => {
  const w = world(on, user => ({ status: 200, content: user === 'First block.' ? '第一块。' : '第二块。' }))
  const a = await $.ui.mount(MSG('First block.'))
  const b = await $.ui.mount({ ...MSG('Second block.'), requestId: 'm2' })
  await w.clock.advance(1300)
  expect([...w.sent].sort()).toEqual(['First block.', 'Second block.'])
  expect(w.drawn).toContain('第一块。')
  expect(w.drawn).toContain('第二块。')
  await a.unmount()
  await b.unmount()
})

test('a block that keeps streaming is translated once, when it settles', async ($, on) => {
  const w = world(on, () => ({ status: 200, content: '完成了全部工作。' }))
  for (const text of ['Done', 'Done with all']) {
    const ui = await $.ui.mount(MSG(text))
    await w.clock.advance(800)
    await ui.unmount()
  }
  const ui = await $.ui.mount(MSG('Done with all the work.'))
  await w.clock.advance(1300)
  expect(w.sent).toEqual(['Done with all the work.'])
  await ui.unmount()
})

test('/translate off survives a reload: the saved state is read on first use', async ($, on) => {
  // A fresh copy of the module (as after a reload): no session.start, the store says off.
  const w = world(on, () => ({ status: 200, content: 'x' }), { enabled: false })
  const ui = await $.ui.mount(MSG('Done.'))
  await w.clock.advance(1300)
  expect(w.sent.length).toBe(0)
  await ui.unmount()
})

test('on Windows the glossary is read from USERPROFILE', async ($, on) => {
  const read: string[] = []
  mock.env(on, { CC_TRANSLATE_API_KEY: 'k', USERPROFILE: 'C:\\Users\\me' })
  mock.store(on)
  on('fs.read', (_: any, e: any) => {
    read.push(e.path)
    return { value: '{"算子":"operator"}' }
  })
  on('command.register', (_: any, e: any) => ({ value: { command: e.name } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true } as any)
  // Read as an absolute path on Windows; the Linux test host resolves C:\ relative.
  expect(read.length).toBe(1)
  expect(read[0]!.endsWith('C:\\Users\\me/.config/cc-translate/glossary.json')).toBe(true)
  const r: any = await $.command.run({ command: 'translate', args: '' } as any)
  expect(r.text).toContain('1')
})

import { describe, expect, test } from 'claude-code/testing'

import {
  chunk,
  glossaryHints,
  hollow,
  parseGlossary,
  promptNeedsTranslation,
  refill,
  replyNeedsTranslation,
  splitFences,
} from '../hooks/text'

describe('promptNeedsTranslation', () => {
  test('Chinese prompt is translated', () => {
    expect(promptNeedsTranslation('帮我修一下登录的 bug')).toBe(true)
  })
  test('English, slash commands and shell lines pass through', () => {
    expect(promptNeedsTranslation('fix the login bug')).toBe(false)
    expect(promptNeedsTranslation('/compact 总结一下')).toBe(false)
    expect(promptNeedsTranslation('!ls 目录')).toBe(false)
    expect(promptNeedsTranslation('café résumé')).toBe(false)
  })
})

describe('replyNeedsTranslation', () => {
  test('English prose yes; Chinese, or code only, no', () => {
    expect(replyNeedsTranslation('I fixed the bug in auth.ts.')).toBe(true)
    expect(replyNeedsTranslation('我修好了 auth.ts 里的 bug。')).toBe(false)
    expect(replyNeedsTranslation('```ts\nconst a = "hello"\n```')).toBe(false)
  })
})

const MD = ['Here is the fix:', '', '```ts', 'const a = 1 // retry', '```', '', 'Then run:', '~~~~bash', 'npm test', '~~~~', 'Done.'].join('\n')

describe('fences', () => {
  test('splitFences joins back exactly, one part per fence', () => {
    const parts = splitFences(MD)
    expect(parts.map(p => p.text).join('\n')).toBe(MD)
    expect(parts.filter(p => p.kind === 'fence').length).toBe(2)
  })
  test('hollow sends no code, refill puts it back byte for byte', () => {
    const h = hollow(MD)
    expect(h.text).not.toContain('const a')
    expect(h.text).not.toContain('npm test')
    expect(h.text).toContain('```ts\n```')
    const zh = h.text.replace('Here is the fix:', '修复如下：').replace('Then run:', '然后运行：').replace('Done.', '完成。')
    expect(refill(zh, h.fences)).toBe(MD.replace('Here is the fix:', '修复如下：').replace('Then run:', '然后运行：').replace('Done.', '完成。'))
  })
  test('a lost code block is an error', () => {
    const h = hollow(MD)
    expect(() => refill('修复如下：', h.fences)).toThrow()
  })
  test('an unclosed fence runs to the end', () => {
    const parts = splitFences('Intro\n```\ncode\nmore')
    expect(parts.map(p => p.kind)).toEqual(['prose', 'fence'])
  })
})

describe('chunk', () => {
  const para = (n: number) => `Paragraph ${n} ` + 'word '.repeat(40)
  const long = [para(1), '', para(2), '', '```', 'x\n\ny', '```', '', para(3)].join('\n')
  test('short text is one chunk', () => {
    expect(chunk('short', 100)).toEqual(['short'])
  })
  test('long text splits at blank lines and joins back exactly', () => {
    const parts = chunk(long, 250)
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.join('\n')).toBe(long)
  })
  test('never cuts inside a fence', () => {
    for (const p of chunk(long, 10)) {
      expect((p.match(/^```/gm)?.length ?? 0) % 2).toBe(0)
    }
  })
})

describe('glossary', () => {
  test('parses an object of strings and refuses anything else', () => {
    expect(parseGlossary('{"算子": "operator"}')).toEqual({ 算子: 'operator' })
    expect(() => parseGlossary('[1]')).toThrow()
    expect(() => parseGlossary('{"a": 1}')).toThrow()
  })
  test('hints both ways, only for terms present', () => {
    const g = { 算子: 'operator', 张量: 'tensor' }
    expect(glossaryHints(g, '这个算子很慢')).toEqual(['算子 => operator'])
    expect(glossaryHints(g, 'The Operator is slow', true)).toEqual(['operator => 算子'])
  })
})

describe('Windows line endings', () => {
  const md = 'Run this:\r\n\r\n```bash\r\nnpm test\r\n```\r\n\r\nDone.'
  test('fences in CRLF text are found and joined back exactly', () => {
    const parts = splitFences(md)
    expect(parts.map(p => p.text).join('\n')).toBe(md)
    expect(parts.filter(p => p.kind === 'fence').length).toBe(1)
  })
  test('hollow and refill keep CRLF code byte for byte', () => {
    const h = hollow(md)
    expect(h.text).not.toContain('npm test')
    expect(refill(h.text.replace('Run this:', '运行：'), h.fences)).toBe(md.replace('Run this:', '运行：'))
  })
  test('chunks of CRLF text join back exactly', () => {
    const long = Array.from({ length: 6 }, (_, i) => `Paragraph ${i} ` + 'w '.repeat(60)).join('\r\n\r\n')
    expect(chunk(long, 200).join('\n')).toBe(long)
  })
})

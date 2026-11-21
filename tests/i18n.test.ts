import { describe, expect, test } from 'claude-code/testing'

import { LANGUAGES, messages } from '../hooks/i18n'
import { replyNeedsTranslation } from '../hooks/text'

describe('i18n', () => {
  test('every language has every message, none empty', () => {
    const keys = Object.keys(messages('Simplified Chinese')).sort()
    for (const lang of LANGUAGES) {
      const m = messages(lang) as Record<string, unknown>
      expect(Object.keys(m).sort()).toEqual(keys)
      for (const v of Object.values(m)) {
        const text = typeof v === 'function' ? (v as (...a: unknown[]) => string)('X', 'Y', 'Z', 1, 2) : v
        expect(String(text).length).toBeGreaterThan(0)
      }
    }
  })
  test('an unknown language falls back to Simplified Chinese', () => {
    expect(messages('Klingon')).toBe(messages('Simplified Chinese'))
  })
  test('a reply already in any supported language is left alone', () => {
    for (const text of ['已经完成了。', '已經完成了。', '完了しました。', '완료했습니다.', 'Готово, всё исправлено.']) {
      expect(replyNeedsTranslation(text)).toBe(false)
    }
  })
})

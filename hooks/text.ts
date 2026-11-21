// Pure text logic: language detection, fenced-code handling, chunking and
// glossary matching. No `$`, so it is easy to test. The only structure this
// file recognises is markdown's own fence syntax: what is code and what is
// prose inside a line is left to the translating model.

/** A letter from a script other than Latin (Han, Kana, Hangul, Cyrillic, ...). */
const NON_LATIN_LETTER = /(?![\p{Script=Latin}])\p{L}/u
const NON_LATIN_LETTER_G = /(?![\p{Script=Latin}])\p{L}/gu
const LETTER_G = /\p{L}/gu

/** True when the text holds any letter outside the Latin script. */
export function hasForeignLetters(text: string): boolean {
  return NON_LATIN_LETTER.test(text)
}

/** Share of letters that are non-Latin, 0..1 (0 for text with no letters). */
export function foreignRatio(text: string): number {
  const letters = text.match(LETTER_G)?.length ?? 0
  if (letters === 0) return 0
  return (text.match(NON_LATIN_LETTER_G)?.length ?? 0) / letters
}

/**
 * Whether a prompt the person typed should be translated to English before it
 * is sent: it holds a non-Latin letter and is not a shell-mode or slash line.
 */
export function promptNeedsTranslation(text: string): boolean {
  const head = text.trimStart()
  if (head.startsWith('!') || head.startsWith('/')) return false
  return hasForeignLetters(text)
}

/**
 * The @file mentions in a prompt whose path holds a non-Latin letter. Their
 * path cannot be translated without breaking the reference, nor sent as is
 * without sending non-English text.
 */
export function foreignMentions(text: string): string[] {
  const mentions = text.match(/(?<![\w@])@(?:"[^"\n]+"|[^\s"'`，。；！？、（）]+)/g) ?? []
  return mentions.filter(hasForeignLetters)
}

/**
 * Whether a reply block should be translated for display: it has prose letters
 * outside code fences and is mostly not in the reader's script already.
 */
export function replyNeedsTranslation(text: string): boolean {
  const prose = splitFences(text)
    .filter(p => p.kind === 'prose')
    .map(p => p.text)
    .join('\n')
  if (!/\p{L}/u.test(prose)) return false
  return foreignRatio(prose) < 0.3
}

// ---------------------------------------------------------------------------
// Fenced code

export type Part = { kind: 'prose' | 'fence'; text: string }

const FENCE_MARK = /^\s{0,3}(`{3,}|~{3,})/

/**
 * Splits markdown into prose and fenced code blocks (opening line through
 * closing line), one part per fence. Joining every part's text with "\n" gives
 * back the input exactly. An unclosed fence runs to the end.
 */
export function splitFences(markdown: string): Part[] {
  const out: Part[] = []
  let fence: { char: string; length: number } | null = null
  const push = (kind: Part['kind'], line: string, fresh = false) => {
    const last = out[out.length - 1]
    if (last && last.kind === kind && !fresh) last.text += '\n' + line
    else out.push({ kind, text: line })
  }
  for (const line of markdown.split('\n')) {
    if (fence) {
      push('fence', line)
      const marker = line.match(FENCE_MARK)?.[1]
      if (marker && marker.charAt(0) === fence.char && marker.length >= fence.length && line.trim() === marker) {
        fence = null
      }
      continue
    }
    const opener = line.match(FENCE_MARK)?.[1]
    if (opener) {
      fence = { char: opener.charAt(0), length: opener.length }
      push('fence', line, true)
      continue
    }
    push('prose', line)
  }
  return out
}

/** A fence with its body removed: its opening line, then a closing marker. */
function skeleton(fence: string): string {
  const open = fence.split('\n')[0] ?? ''
  const marker = open.match(FENCE_MARK)?.[1] ?? '```'
  return `${open}\n${marker}`
}

const SKELETON_G = /^[ ]{0,3}(`{3,}|~{3,})[^\n]*\n[ ]{0,3}\1[ \t]*$/gm

export type Hollowed = { text: string; fences: string[] }

/**
 * Empties each fenced block, keeping an empty fence where it stood, so code
 * never goes to the translator while the model still sees its place.
 */
export function hollow(markdown: string): Hollowed {
  const fences: string[] = []
  const text = splitFences(markdown)
    .map(p => {
      if (p.kind === 'prose') return p.text
      fences.push(p.text)
      return skeleton(p.text)
    })
    .join('\n')
  return { text, fences }
}

export class FenceError extends Error {}

/**
 * Puts the code back into the empty fences of a translation, in order. Throws
 * when the translation does not hold exactly as many empty fences.
 */
export function refill(translated: string, fences: readonly string[]): string {
  const found = translated.match(SKELETON_G)?.length ?? 0
  if (found !== fences.length) {
    throw new FenceError(`expected ${fences.length} code blocks back, got ${found}`)
  }
  let i = 0
  return translated.replace(SKELETON_G, () => fences[i++] ?? '')
}

// ---------------------------------------------------------------------------
// Chunking long replies

/**
 * Splits markdown into chunks of about `max` characters at most, cutting only
 * after a blank line outside code fences. A single paragraph or fence longer
 * than `max` stays whole. Joining the chunks with "\n" gives back the input.
 */
export function chunk(markdown: string, max: number): string[] {
  if (markdown.length <= max) return [markdown]
  const units: string[] = [] // runs of lines that stay together
  for (const part of splitFences(markdown)) {
    if (part.kind === 'fence') {
      units.push(part.text)
      continue
    }
    let current: string[] = []
    for (const line of part.text.split('\n')) {
      current.push(line)
      if (line.trim() === '') {
        units.push(current.join('\n'))
        current = []
      }
    }
    if (current.length > 0) units.push(current.join('\n'))
  }
  const chunks: string[] = []
  let current: string | null = null
  for (const unit of units) {
    if (current !== null && current.length + 1 + unit.length > max) {
      chunks.push(current)
      current = unit
    } else {
      current = current === null ? unit : current + '\n' + unit
    }
  }
  if (current !== null) chunks.push(current)
  return chunks
}

// ---------------------------------------------------------------------------
// Glossary

/** source term -> target term, as written in glossary.json. */
export type Glossary = Readonly<Record<string, string>>

/** Parses glossary.json text; anything but an object of strings is refused. */
export function parseGlossary(json: string): Glossary {
  const value: unknown = JSON.parse(json)
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('glossary.json must be an object of "term": "translation"')
  }
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(value)) {
    if (typeof v !== 'string') throw new Error(`glossary entry "${k}" is not a string`)
    out[k] = v
  }
  return out
}

/**
 * The glossary lines that matter for this text, as "a => b". `reverse` reads
 * the glossary the other way (for replies: English term -> the person's).
 */
export function glossaryHints(glossary: Glossary, text: string, reverse = false): string[] {
  const hints: string[] = []
  const lower = text.toLowerCase()
  for (const [from, to] of Object.entries(glossary)) {
    const [src, dst] = reverse ? [to, from] : [from, to]
    if (src && lower.includes(src.toLowerCase())) hints.push(`${src} => ${dst}`)
  }
  return hints
}

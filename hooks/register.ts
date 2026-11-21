// cc-translate: your prompt goes to Claude in English; Claude's replies are
// shown in your language. Display only: the transcript keeps English.

import type { EngineInterface, PromptOrigin, Register } from 'claude-code'

import { foreignMentions, parseGlossary, promptNeedsTranslation, replyNeedsTranslation, type Glossary } from './text'
import { messages } from './i18n'
import { translatePrompt, translateReply, type Deps, type TranslatorConfig } from './translator'

type $ = EngineInterface

const PROMPT_TIMEOUT_MS = 20_000
const REPLY_TIMEOUT_MS = 60_000
/** How long a reply block must stay unchanged before it is translated. */
const SETTLE_MS = 1200
const CACHE_LIMIT = 300

// Module state: reset on a reload, which only costs re-translation.
// Defaults live in plugin.json's userConfig; these hold what it handed over.
let baseUrl = ''
let model = ''
let lang = 'Simplified Chinese'
let optionKey = ''
let extraBody: Record<string, unknown> = {}
let extraBodyError = ''
let enabled = true
let glossary: Glossary = {}

// Reply translations, keyed by the block's English text (cleared when the language changes).
const done = new Map<string, string>()
/** Blocks that stayed in English, and why; cleared by /translate on|retry|reload. */
const failed = new Map<string, string>()
const inFlight = new Set<string>()
// The latest text of each still-changing block, and its settle timer.
const settling = new Map<string, { text: string; timer: { cancel: () => void } }>()

/** The person's own words: typed at the prompt, or a plugin's prompt sent as theirs. */
function isPersons(origin: PromptOrigin | undefined): boolean {
  if (!origin) return true // unstamped: err toward translating
  return origin.kind === 'composer' || (origin.kind === 'plugin' && 'asUser' in origin && origin.asUser === true)
}

function remember(en: string, zh: string) {
  done.set(en, zh)
  if (done.size > CACHE_LIMIT) done.delete(done.keys().next().value!)
}

function deps($: $): Deps {
  return {
    post: (url, init) => $.http.fetch(url, init),
    delay: ms => $.clock.sleep(ms),
  }
}

async function config($: $, timeoutMs: number): Promise<TranslatorConfig> {
  return {
    baseUrl,
    model,
    lang,
    glossary,
    timeoutMs,
    extraBody,
    apiKey: optionKey || ((await $.env.get('CC_TRANSLATE_API_KEY')) ?? ''),
  }
}

function showStatus($: $) {
  const t = messages(lang)
  $.ui.status(enabled ? t.statusOn(model) : t.statusOff)
}

async function loadGlossary($: $) {
  const home = await $.env.get('HOME')
  if (!home) return
  let text: string
  try {
    text = await $.fs.read(`${home}/.config/cc-translate/glossary.json`)
  } catch {
    return // no glossary is fine
  }
  try {
    glossary = parseGlossary(text)
  } catch (err) {
    $.ui.toast(messages(lang).glossaryInvalid((err as Error).message))
  }
}

function translateLater($: $, en: string) {
  if (inFlight.has(en)) return
  inFlight.add(en)
  void (async () => {
    try {
      const result = await translateReply(deps($), await config($, REPLY_TIMEOUT_MS), en)
      remember(en, result.text)
      if (result.errors.length > 0) {
        $.ui.toast(messages(lang).replyPartial(result.errors.length, result.errors[0] ?? ''))
      }
    } catch (err) {
      const reason = (err as Error).message
      failed.set(en, reason)
      if (failed.size > CACHE_LIMIT) failed.delete(failed.keys().next().value!)
      $.ui.toast(messages(lang).replyFailed(reason))
    } finally {
      inFlight.delete(en)
      $.ui.invalidate('ui.render')
    }
  })()
}

export const register: Register = (on, options) => {
  baseUrl = String(options.base_url ?? '')
  model = String(options.model ?? '')
  lang = String(options.lang || lang)
  optionKey = String(options.api_key ?? '').trim()
  enabled = options.enabled !== false
  extraBody = {}
  extraBodyError = ''
  const extra = String(options.extra_body ?? '').trim()
  if (extra) {
    try {
      const parsed: unknown = JSON.parse(extra)
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not a JSON object')
      extraBody = parsed as Record<string, unknown>
    } catch (err) {
      extraBodyError = (err as Error).message
    }
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'translate',
      description: 'cc-translate: on | off | retry | reload | config | status',
      argumentHint: 'on|off|retry|reload|config|status',
    })
    const saved = await $.store.get('enabled').catch(() => undefined)
    if (typeof saved === 'boolean') enabled = saved
    await loadGlossary($)
    const t = messages(lang)
    if (extraBodyError) $.ui.toast(t.extraBodyInvalid(extraBodyError))
    if (enabled && !baseUrl) $.ui.toast(t.noBaseUrl)
    else if (enabled && !optionKey && !(await $.env.get('CC_TRANSLATE_API_KEY'))) $.ui.toast(t.noKey)
    showStatus($)
    return next(e)
  })

  on('command.run', { command: 'translate' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'on' || arg === 'off') {
      enabled = arg === 'on'
      await $.store.set('enabled', enabled).catch(() => undefined)
      showStatus($)
      if (enabled) failed.clear()
      $.ui.invalidate('ui.render')
    } else if (arg === 'retry') {
      failed.clear()
      $.ui.invalidate('ui.render')
    } else if (arg === 'reload') {
      await loadGlossary($)
      failed.clear()
      done.clear()
      $.ui.invalidate('ui.render')
    }
    const terms = Object.keys(glossary).length
    const t = messages(lang)
    if (arg === 'config') {
      const envKey = await $.env.get('CC_TRANSLATE_API_KEY')
      const key = optionKey ? t.keyFromOption : envKey ? t.keyFromEnv : t.unset
      return {
        text: [
          t.configTitle,
          `  base_url   ${baseUrl || t.unset}`,
          `  model      ${model || t.unset}`,
          `  api_key    ${key}`,
          `  extra_body ${JSON.stringify(extraBody)}`,
          `  lang       ${lang}`,
          `  glossary   ~/.config/cc-translate/glossary.json (${t.glossaryLine(terms)})`,
          t.configHowTo,
          t.configExtraHint,
        ].join('\n'),
      }
    }
    return { text: t.summary(enabled, model, baseUrl, terms, failed.size) }
  })

  // Input: the person's own typed prompt becomes English, or is not sent.
  on('prompt.submit', async ($, e, next) => {
    if (!enabled || e.command || e.isMeta || !isPersons(e.origin) || !promptNeedsTranslation(e.text)) return next(e)
    const mentions = foreignMentions(e.text)
    if (mentions.length > 0) {
      return { drop: messages(lang).dropMentions(mentions.join(' ')) }
    }
    $.ui.toast(messages(lang).translating)
    let english: string
    try {
      english = await translatePrompt(deps($), await config($, PROMPT_TIMEOUT_MS), e.text)
    } catch (err) {
      return { drop: messages(lang).dropFailed((err as Error).message) }
    }
    $.ui.log(`→ EN: ${english}`)
    return next({ ...e, text: english })
  })
    // Before `next`: refuse, so nothing enters. After it, the English prompt has
    // already entered, and `next(e)` only replays that settled answer (it does not
    // send `e` again); a drop there would fail the hook instead.
    .catch(($, e, next) => (next.called ? next(e) : { drop: messages(lang).dropError }))

  // Output: draw a reply block in the person's language once it has settled.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const text = e.props.text
    if (!enabled || !text || !replyNeedsTranslation(text)) return next(e)
    const shown = done.get(text)
    if (shown !== undefined) return next({ ...e, props: { ...e.props, text: shown } })
    if (failed.has(text) || inFlight.has(text)) return next(e)

    const key = e.requestId
    const pending = settling.get(key)
    if (pending?.text !== text) {
      pending?.timer.cancel()
      const timer = $.clock.after(SETTLE_MS, () => {
        settling.delete(key)
        translateLater($, text)
      })
      settling.set(key, { text, timer })
    }
    return next(e)
  })
}

// The plugin's own messages, in each language the person can pick. The keys
// are the `lang` option's values, which are also the language names the
// translating model is given.

export const LANGUAGES = [
  'Simplified Chinese',
  'Traditional Chinese',
  'Japanese',
  'Korean',
  'Russian',
] as const

export type Language = (typeof LANGUAGES)[number]

export type Messages = {
  statusOn: (model: string) => string
  statusOff: string
  translating: string
  dropMentions: (mentions: string) => string
  dropFailed: (reason: string) => string
  dropError: string
  replyPartial: (count: number, reason: string) => string
  replyFailed: (reason: string) => string
  glossaryInvalid: (reason: string) => string
  extraBodyInvalid: (reason: string) => string
  noBaseUrl: string
  noKey: string
  summary: (on: boolean, model: string, baseUrl: string, terms: number, failed: number) => string
  configTitle: string
  unset: string
  keyFromOption: string
  keyFromEnv: string
  glossaryLine: (terms: number) => string
  configHowTo: string
  configExtraHint: string
}

const zhHans: Messages = {
  statusOn: model => `译 on · ${model}`,
  statusOff: '译 off',
  translating: '正在翻译为英文…',
  dropMentions: m => `未发送：${m} 的路径含非英文字符，翻译会让引用失效。请先把文件改成英文名。`,
  dropFailed: r => `翻译失败，未发送（原文已退回输入框）：${r}`,
  dropError: '翻译出错，未发送（原文已退回输入框）',
  replyPartial: (n, r) => `回复有 ${n} 段未能翻译，保留英文：${r}（/translate retry 重试）`,
  replyFailed: r => `回复翻译失败，保留英文：${r}（/translate retry 重试）`,
  glossaryInvalid: r => `cc-translate：术语表无效，已忽略（${r}）`,
  extraBodyInvalid: r => `cc-translate：extra_body 不是合法的 JSON 对象，已忽略（${r}）`,
  noBaseUrl: 'cc-translate：未配置 base_url，请用 /plugin configure 设置翻译服务',
  noKey: 'cc-translate：未配置 API key（api_key 选项或 CC_TRANSLATE_API_KEY），需要翻译的提示词将无法发送',
  summary: (on, model, url, terms, failed) =>
    `cc-translate ${on ? 'on' : 'off'} · ${model} @ ${url} · 术语表 ${terms} 条 · 未翻译 ${failed} 条（/translate config 查看配置）`,
  configTitle: 'cc-translate 当前生效的配置：',
  unset: '（未设置）',
  keyFromOption: '已设置（api_key 选项）',
  keyFromEnv: '已设置（环境变量 CC_TRANSLATE_API_KEY）',
  glossaryLine: n => `${n} 条`,
  configHowTo: '修改：/plugin configure cc-translate@cc-translate，或在 /config 里改 cc-translate 的选项。',
  configExtraHint: '换成非 DeepSeek 的服务商时，通常要把 extra_body 设为 {}。',
}

const zhHant: Messages = {
  statusOn: model => `譯 on · ${model}`,
  statusOff: '譯 off',
  translating: '正在翻譯為英文…',
  dropMentions: m => `未送出：${m} 的路徑含非英文字元，翻譯會讓引用失效。請先把檔案改成英文名稱。`,
  dropFailed: r => `翻譯失敗，未送出（原文已退回輸入框）：${r}`,
  dropError: '翻譯出錯，未送出（原文已退回輸入框）',
  replyPartial: (n, r) => `回覆有 ${n} 段未能翻譯，保留英文：${r}（/translate retry 重試）`,
  replyFailed: r => `回覆翻譯失敗，保留英文：${r}（/translate retry 重試）`,
  glossaryInvalid: r => `cc-translate：術語表無效，已忽略（${r}）`,
  extraBodyInvalid: r => `cc-translate：extra_body 不是有效的 JSON 物件，已忽略（${r}）`,
  noBaseUrl: 'cc-translate：未設定 base_url，請用 /plugin configure 設定翻譯服務',
  noKey: 'cc-translate：未設定 API key（api_key 選項或 CC_TRANSLATE_API_KEY），需要翻譯的提示詞將無法送出',
  summary: (on, model, url, terms, failed) =>
    `cc-translate ${on ? 'on' : 'off'} · ${model} @ ${url} · 術語表 ${terms} 條 · 未翻譯 ${failed} 條（/translate config 查看設定）`,
  configTitle: 'cc-translate 目前生效的設定：',
  unset: '（未設定）',
  keyFromOption: '已設定（api_key 選項）',
  keyFromEnv: '已設定（環境變數 CC_TRANSLATE_API_KEY）',
  glossaryLine: n => `${n} 條`,
  configHowTo: '修改：/plugin configure cc-translate@cc-translate，或在 /config 裡修改 cc-translate 的選項。',
  configExtraHint: '換成非 DeepSeek 的服務商時，通常要把 extra_body 設為 {}。',
}

const ja: Messages = {
  statusOn: model => `翻訳 on · ${model}`,
  statusOff: '翻訳 off',
  translating: '英語に翻訳しています…',
  dropMentions: m => `送信しませんでした：${m} のパスに英語以外の文字が含まれており、翻訳すると参照が壊れます。先にファイル名を英語に変更してください。`,
  dropFailed: r => `翻訳に失敗したため送信しませんでした（入力欄に戻しました）：${r}`,
  dropError: '翻訳でエラーが発生したため送信しませんでした（入力欄に戻しました）',
  replyPartial: (n, r) => `返信のうち ${n} か所を翻訳できず、英語のままです：${r}（/translate retry で再試行）`,
  replyFailed: r => `返信を翻訳できず、英語のままです：${r}（/translate retry で再試行）`,
  glossaryInvalid: r => `cc-translate：用語集が無効なため無視しました（${r}）`,
  extraBodyInvalid: r => `cc-translate：extra_body が正しい JSON オブジェクトではないため無視しました（${r}）`,
  noBaseUrl: 'cc-translate：base_url が未設定です。/plugin configure で翻訳サービスを設定してください',
  noKey: 'cc-translate：API キーが未設定です（api_key オプションまたは CC_TRANSLATE_API_KEY）。翻訳が必要なプロンプトは送信できません',
  summary: (on, model, url, terms, failed) =>
    `cc-translate ${on ? 'on' : 'off'} · ${model} @ ${url} · 用語集 ${terms} 件 · 未翻訳 ${failed} 件（/translate config で設定を表示）`,
  configTitle: 'cc-translate の現在の設定：',
  unset: '（未設定）',
  keyFromOption: '設定済み（api_key オプション）',
  keyFromEnv: '設定済み（環境変数 CC_TRANSLATE_API_KEY）',
  glossaryLine: n => `${n} 件`,
  configHowTo: '変更：/plugin configure cc-translate@cc-translate、または /config で cc-translate のオプションを編集します。',
  configExtraHint: 'DeepSeek 以外のサービスに切り替えるときは、通常 extra_body を {} にします。',
}

const ko: Messages = {
  statusOn: model => `번역 on · ${model}`,
  statusOff: '번역 off',
  translating: '영어로 번역하는 중…',
  dropMentions: m => `전송하지 않았습니다: ${m} 경로에 영어가 아닌 문자가 있어 번역하면 참조가 깨집니다. 먼저 파일 이름을 영어로 바꿔 주세요.`,
  dropFailed: r => `번역에 실패해 전송하지 않았습니다(입력창으로 되돌림): ${r}`,
  dropError: '번역 중 오류가 발생해 전송하지 않았습니다(입력창으로 되돌림)',
  replyPartial: (n, r) => `답변 중 ${n}개 부분을 번역하지 못해 영어로 둡니다: ${r} (/translate retry 로 다시 시도)`,
  replyFailed: r => `답변을 번역하지 못해 영어로 둡니다: ${r} (/translate retry 로 다시 시도)`,
  glossaryInvalid: r => `cc-translate: 용어집이 올바르지 않아 무시했습니다 (${r})`,
  extraBodyInvalid: r => `cc-translate: extra_body 가 올바른 JSON 객체가 아니어서 무시했습니다 (${r})`,
  noBaseUrl: 'cc-translate: base_url 이 설정되지 않았습니다. /plugin configure 로 번역 서비스를 설정하세요',
  noKey: 'cc-translate: API 키가 설정되지 않았습니다(api_key 옵션 또는 CC_TRANSLATE_API_KEY). 번역이 필요한 프롬프트는 전송할 수 없습니다',
  summary: (on, model, url, terms, failed) =>
    `cc-translate ${on ? 'on' : 'off'} · ${model} @ ${url} · 용어집 ${terms}개 · 미번역 ${failed}개 (/translate config 로 설정 보기)`,
  configTitle: 'cc-translate 현재 적용 중인 설정:',
  unset: '(설정 안 됨)',
  keyFromOption: '설정됨 (api_key 옵션)',
  keyFromEnv: '설정됨 (환경 변수 CC_TRANSLATE_API_KEY)',
  glossaryLine: n => `${n}개`,
  configHowTo: '변경: /plugin configure cc-translate@cc-translate, 또는 /config 에서 cc-translate 옵션을 수정하세요.',
  configExtraHint: 'DeepSeek 이외의 서비스로 바꿀 때는 보통 extra_body 를 {} 로 설정합니다.',
}

const ru: Messages = {
  statusOn: model => `перевод on · ${model}`,
  statusOff: 'перевод off',
  translating: 'Перевожу на английский…',
  dropMentions: m => `Не отправлено: путь ${m} содержит неанглийские символы, и перевод сломает ссылку. Сначала переименуйте файл латиницей.`,
  dropFailed: r => `Перевод не удался, запрос не отправлен (текст возвращён в поле ввода): ${r}`,
  dropError: 'Ошибка перевода, запрос не отправлен (текст возвращён в поле ввода)',
  replyPartial: (n, r) => `Частей ответа без перевода: ${n}, они оставлены на английском: ${r} (/translate retry — повторить)`,
  replyFailed: r => `Не удалось перевести ответ, он оставлен на английском: ${r} (/translate retry — повторить)`,
  glossaryInvalid: r => `cc-translate: глоссарий некорректен и пропущен (${r})`,
  extraBodyInvalid: r => `cc-translate: extra_body — не корректный JSON-объект, пропущено (${r})`,
  noBaseUrl: 'cc-translate: не задан base_url, настройте сервис перевода через /plugin configure',
  noKey: 'cc-translate: не задан API-ключ (опция api_key или CC_TRANSLATE_API_KEY), запросы, требующие перевода, не будут отправлены',
  summary: (on, model, url, terms, failed) =>
    `cc-translate ${on ? 'on' : 'off'} · ${model} @ ${url} · терминов в глоссарии: ${terms} · без перевода: ${failed} (/translate config — настройки)`,
  configTitle: 'Действующие настройки cc-translate:',
  unset: '(не задано)',
  keyFromOption: 'задан (опция api_key)',
  keyFromEnv: 'задан (переменная окружения CC_TRANSLATE_API_KEY)',
  glossaryLine: n => `терминов: ${n}`,
  configHowTo: 'Изменить: /plugin configure cc-translate@cc-translate или опции cc-translate в /config.',
  configExtraHint: 'При переходе на сервис, отличный от DeepSeek, обычно нужно задать extra_body = {}.',
}

const TABLE: Record<Language, Messages> = {
  'Simplified Chinese': zhHans,
  'Traditional Chinese': zhHant,
  Japanese: ja,
  Korean: ko,
  Russian: ru,
}

/** The messages for a language, Simplified Chinese for one not listed. */
export function messages(lang: string): Messages {
  return (TABLE as Record<string, Messages>)[lang] ?? zhHans
}

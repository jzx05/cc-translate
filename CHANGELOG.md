# Changelog

## 0.3.0

First public release.

- Supports Simplified Chinese, Traditional Chinese, Japanese, Korean and Russian. `lang` is now a picker. The plugin's own messages follow the chosen language.
- Works with any OpenAI-compatible translator through `base_url`, `model`, `api_key` (kept in secure storage) and `extra_body`. DeepSeek `deepseek-flash` stays the default.
- Translates a reply in one request. Fenced code blocks are taken out before translating and put back byte for byte. Replies over about 6000 characters are cut at paragraph breaks, and a part that fails stays in English with a toast that says why.
- Sends the whole prompt to the model. A prompt is refused only if non-English text remains after one strict retry.
- Refuses a prompt that mentions a file whose path is not in English, because translating the path would break the reference.
- Adds `/translate retry` and `/translate config`.
- Turns DeepSeek's thinking off by default, so prompts translate in under a second.

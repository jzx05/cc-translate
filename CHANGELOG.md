# Changelog

## 0.3.2

- Windows: the glossary is now found through `USERPROFILE` when `HOME` is not set, at `C:\Users\<you>\.config\cc-translate\glossary.json`.
- Windows line endings (`\r\n`) are tested: code blocks are found and come back byte for byte.
- CI runs on Linux, Windows and macOS.
- Added a Korean README and a Korean demo.

## 0.3.1

- Each reply block is now translated on its own timer, so the blocks of a long reply are translated side by side instead of one after another.
- The timeout timer is cancelled as soon as the translator answers.
- `/translate off` now holds after a plugin reload instead of reverting to on until the next session.
- Japanese, Korean, Russian and Traditional Chinese were tested against DeepSeek.
- Added a Chinese README, a demo, and CI that runs the tests on every push.

## 0.3.0

First public release.

- Supports Simplified Chinese, Traditional Chinese, Japanese, Korean and Russian. `lang` is now a picker. The plugin's own messages follow the chosen language.
- Works with any OpenAI-compatible translator through `base_url`, `model`, `api_key` (kept in secure storage) and `extra_body`. DeepSeek `deepseek-flash` stays the default.
- Translates a reply in one request. Fenced code blocks are taken out before translating and put back byte for byte. Replies over about 6000 characters are cut at paragraph breaks, and a part that fails stays in English with a toast that says why.
- Sends the whole prompt to the model. A prompt is refused only if non-English text remains after one strict retry.
- Refuses a prompt that mentions a file whose path is not in English, because translating the path would break the reference.
- Adds `/translate retry` and `/translate config`.
- Turns DeepSeek's thinking off by default, so prompts translate in under a second.

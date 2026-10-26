# ⇄ Prompt Translator

**Say it your way. Get the prompt an expert would write.**

**Live app:** https://scarrroman-arch.github.io/prompt-translator/

Prompt Translator turns a quick, rough request like

> make me a website for my bakery where people can order cakes

into a complete, structured prompt — with a role, context, clear requirements, edge cases, a step-by-step approach, an exact output format and a "definition of done" checklist — so ChatGPT, Claude, Gemini or any other AI can do the job almost perfectly on the first try.

It's a single static web page: no server, no build step, no install. Host it free on GitHub Pages or just open `index.html`.

## Features

- **Translate** any rough request into an expert-level prompt
- **Task types** tuned for coding, writing, image generation, research and teaching
- **Detail levels**: concise, detailed or maximum
- **Clarifying questions** mode — the translator asks 3–5 quick questions first for even better results
- **Refine** — tell it "make it shorter" or "use React" and it revises the prompt
- **Edit, copy or download** the result as Markdown
- **History** saved in your browser
- **Works with** Anthropic (Claude), OpenAI, OpenRouter, Ollama (free & local) or any OpenAI-compatible API
- Light and dark mode, mobile friendly

## Quick start

1. Open the live app above (or download this repo and open `index.html`).
2. Click **⚙ Settings**, pick a provider and paste your API key:
   - Claude: <https://console.anthropic.com/>
   - OpenAI: <https://platform.openai.com/api-keys>
   - OpenRouter: <https://openrouter.ai/keys>
   - Ollama: no key needed (see below)
3. Type what you want, pick the task type, press **Translate**.
4. Copy the result into the AI of your choice.

## Privacy & security

- Your API key is stored **only in your browser** (localStorage) and is sent **only** to the provider you select. There is no backend.
- Anyone who uses the hosted page brings their own key — no key is ever in the code.
- Don't save your key on a shared or public computer. Use **Forget key** in Settings to remove it.
- Set a spending limit on your API account as a good habit.

## Using Ollama (free, local)

1. Install [Ollama](https://ollama.com) and run `ollama pull llama3.1`.
2. Allow the page to talk to Ollama by starting it with allowed origins, e.g.
   - macOS/Linux: `OLLAMA_ORIGINS="*" ollama serve`
   - Windows (PowerShell): `$env:OLLAMA_ORIGINS="*"; ollama serve`
3. In Settings choose **Ollama** and set the model to one you've pulled.

## Customising the translator

All the "brains" live in **`prompts.js`**:

- `buildSystemPrompt()` — the master instructions for how requests are translated
- `TARGETS` — add your own task types (e.g. "Marketing email", "SQL query") with their own section layout
- `DETAIL` — word-count targets for each detail level
- `CLARIFY_SYSTEM` / `REFINE_SYSTEM` — behaviour of the questions and refine steps

Default model names are in `PROVIDERS` at the top of **`app.js`**. Model names change over time; if you get a "model not found" error, update the model in Settings.

## Project structure

```
index.html   Page layout
style.css    Styling (light/dark)
app.js       UI logic and API calls
prompts.js   Translation instructions — edit this to tune results
```

## License

MIT — see [LICENSE](LICENSE).

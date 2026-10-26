// ============================================================================
//  app.js — UI + AI provider calls for Prompt Translator.
//  No build step, no dependencies. Works from GitHub Pages or a local file.
// ============================================================================

const PROVIDERS = {
  anthropic: { label: "Anthropic (Claude)", kind: "anthropic", base: "https://api.anthropic.com", model: "claude-sonnet-4-5", keyRequired: true },
  openai: { label: "OpenAI (ChatGPT)", kind: "openai", base: "https://api.openai.com/v1", model: "gpt-4o-mini", keyRequired: true },
  openrouter: { label: "OpenRouter (many models)", kind: "openai", base: "https://openrouter.ai/api/v1", model: "anthropic/claude-sonnet-4.5", keyRequired: true },
  ollama: { label: "Ollama (free, runs locally)", kind: "openai", base: "http://localhost:11434/v1", model: "llama3.1", keyRequired: false },
  custom: { label: "Custom (OpenAI-compatible)", kind: "openai", base: "", model: "", keyRequired: false, editableBase: true },
};

const EXAMPLES = [
  "make me a website for my bakery where people can order cakes",
  "write a python bot that copies trades from a solana wallet",
  "explain how the stock market works to a 12 year old",
  "write a cover letter for a junior developer job",
  "picture of a cozy cabin in the snow at night",
];

// ---------- storage (safe if localStorage is blocked) ----------
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  },
};

const settings = Object.assign({ provider: "anthropic", keys: {}, models: {}, bases: {} }, store.get("pt.settings", {}));
let history = store.get("pt.history", []);
let questions = [];

// ---------- helpers ----------
const $ = (id) => document.getElementById(id);
const els = {};
[
  "settingsBtn", "settingsDialog", "settingsForm", "provider", "apiKey", "model", "baseUrl", "keyRow", "baseRow", "clearKeyBtn",
  "request", "examples", "target", "detail", "clarify", "clarifyBox", "questions", "generateBtn", "skipBtn",
  "translateBtn", "error", "output", "stats", "copyBtn", "downloadBtn", "feedback", "refineBtn",
  "history", "historyEmpty", "clearHistoryBtn",
].forEach((id) => (els[id] = $(id)));

function showError(msg) { els.error.textContent = msg; els.error.hidden = !msg; }

function setBusy(btn, busy, busyText) {
  if (busy) { btn.dataset.label = btn.textContent; btn.textContent = busyText; btn.classList.add("loading"); }
  else if (btn.dataset.label) { btn.textContent = btn.dataset.label; btn.classList.remove("loading"); }
  [els.translateBtn, els.generateBtn, els.skipBtn, els.refineBtn].forEach((b) => (b.disabled = busy));
  if (!busy) updateOutputState();
}

function stripFences(text) {
  const m = text.trim().match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  return m ? m[1].trim() : text.trim();
}

function updateOutputState() {
  const text = els.output.value.trim();
  const words = text ? text.split(/\s+/).length : 0;
  els.stats.textContent = words ? `${words} words` : "";
  els.copyBtn.disabled = els.downloadBtn.disabled = els.refineBtn.disabled = !text;
}

// ---------- AI call ----------
async function callAI(system, user, maxTokens = 4096) {
  const id = settings.provider;
  const p = PROVIDERS[id];
  const key = (settings.keys[id] || "").trim();
  const model = (settings.models[id] || p.model).trim();
  const base = (settings.bases[id] || p.base).trim().replace(/\/+$/, "");

  if (p.keyRequired && !key) throw new Error("Add your API key in ⚙ Settings first.");
  if (!model) throw new Error("Set a model name in ⚙ Settings.");
  if (!base) throw new Error("Set an API base URL in ⚙ Settings.");

  let res;
  try {
    if (p.kind === "anthropic") {
      res = await fetch(`${base}/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
      });
    } else {
      const headers = { "content-type": "application/json" };
      if (key) headers.authorization = `Bearer ${key}`;
      res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
      });
    }
  } catch (e) {
    throw new Error(
      `Couldn't reach ${p.label}. Check your internet connection` +
      (id === "ollama" ? ", that Ollama is running, and that OLLAMA_ORIGINS allows this page (see README)." : " and the base URL.")
    );
  }

  const raw = await res.text();
  let data = null;
  try { data = JSON.parse(raw); } catch { /* not JSON */ }

  if (!res.ok) {
    const detail = data?.error?.message || (typeof data?.error === "string" ? data.error : "") || raw.slice(0, 300);
    const hint = res.status === 401 ? " (Your API key looks invalid.)" : res.status === 404 ? " (Check the model name.)" : "";
    throw new Error(`Error ${res.status}: ${detail}${hint}`);
  }

  const out = p.kind === "anthropic"
    ? (data?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("")
    : data?.choices?.[0]?.message?.content;
  if (!out || !out.trim()) throw new Error("The AI returned an empty response. Try again.");
  return out.trim();
}

// ---------- flow ----------
function parseQuestions(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const j = JSON.parse(m[0]);
      if (Array.isArray(j.questions)) return j.questions.filter((q) => typeof q === "string" && q.trim()).slice(0, 6);
    } catch { /* fall through */ }
  }
  return text.split("\n")
    .map((s) => s.replace(/^\s*(\d+[.)]|[-*•])\s*/, "").trim())
    .filter((s) => s.endsWith("?"))
    .slice(0, 6);
}

function renderQuestions() {
  els.questions.replaceChildren();
  questions.forEach((q, i) => {
    const wrap = document.createElement("div");
    wrap.className = "q";
    const label = document.createElement("label");
    label.htmlFor = `q${i}`;
    label.textContent = q;
    const input = document.createElement("input");
    input.type = "text";
    input.id = `q${i}`;
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") generate(true); });
    wrap.append(label, input);
    els.questions.append(wrap);
  });
  els.clarifyBox.hidden = questions.length === 0;
  els.translateBtn.hidden = questions.length > 0;
  els.questions.querySelector("input")?.focus();
}

function resetClarify() {
  questions = [];
  els.clarifyBox.hidden = true;
  els.translateBtn.hidden = false;
}

async function translate() {
  showError("");
  const request = els.request.value.trim();
  if (!request) { showError("Type what you want the AI to do first."); els.request.focus(); return; }

  if (!els.clarify.checked) return generate(false);

  setBusy(els.translateBtn, true, "Thinking of questions…");
  try {
    const text = await callAI(CLARIFY_SYSTEM, buildUserMessage(request), 800);
    questions = parseQuestions(text);
    if (!questions.length) { setBusy(els.translateBtn, false); await generate(false); return; }
    renderQuestions();
  } catch (e) {
    showError(e.message);
  } finally {
    setBusy(els.translateBtn, false);
  }
}

async function generate(useAnswers) {
  showError("");
  const request = els.request.value.trim();
  if (!request) { showError("Type what you want the AI to do first."); return; }
  const qa = useAnswers ? questions.map((q, i) => ({ q, a: ($(`q${i}`)?.value || "") })) : [];
  const btn = els.clarifyBox.hidden ? els.translateBtn : els.generateBtn;

  setBusy(btn, true, "Translating…");
  try {
    const system = buildSystemPrompt(els.target.value, els.detail.value);
    const result = stripFences(await callAI(system, buildUserMessage(request, qa)));
    els.output.value = result;
    addHistory({ request, target: els.target.value, detail: els.detail.value, output: result });
    resetClarify();
  } catch (e) {
    showError(e.message);
  } finally {
    setBusy(btn, false);
  }
}

async function refine() {
  showError("");
  const current = els.output.value.trim();
  const feedback = els.feedback.value.trim();
  if (!current) return;
  if (!feedback) { showError("Type what you'd like changed, then press Refine."); els.feedback.focus(); return; }

  setBusy(els.refineBtn, true, "Refining…");
  try {
    const result = stripFences(await callAI(REFINE_SYSTEM, buildRefineMessage(current, feedback)));
    els.output.value = result;
    els.feedback.value = "";
    addHistory({ request: els.request.value.trim() || "(refined)", target: els.target.value, detail: els.detail.value, output: result });
  } catch (e) {
    showError(e.message);
  } finally {
    setBusy(els.refineBtn, false);
  }
}

// ---------- history ----------
function addHistory(item) {
  history.unshift({ ...item, at: Date.now() });
  history = history.slice(0, 25);
  store.set("pt.history", history);
  renderHistory();
}

function renderHistory() {
  els.history.replaceChildren();
  history.forEach((h) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    const req = document.createElement("span");
    req.className = "req";
    req.textContent = h.request;
    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = `${TARGETS[h.target]?.label || h.target} · ${new Date(h.at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}`;
    b.append(req, meta);
    b.addEventListener("click", () => {
      els.request.value = h.request;
      if (TARGETS[h.target]) els.target.value = h.target;
      if (h.detail) els.detail.value = h.detail;
      els.output.value = h.output;
      resetClarify();
      updateOutputState();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    li.append(b);
    els.history.append(li);
  });
  els.historyEmpty.hidden = history.length > 0;
}

// ---------- settings ----------
function fillSettingsForm() {
  const id = els.provider.value;
  const p = PROVIDERS[id];
  els.apiKey.value = settings.keys[id] || "";
  els.model.value = settings.models[id] || p.model;
  els.model.placeholder = p.model || "model-name";
  els.baseUrl.value = settings.bases[id] || p.base;
  els.apiKey.placeholder = p.keyRequired ? "Paste your API key" : "Optional";
}

function saveSettings() {
  const id = els.provider.value;
  settings.provider = id;
  settings.keys[id] = els.apiKey.value.trim();
  settings.models[id] = els.model.value.trim();
  settings.bases[id] = els.baseUrl.value.trim();
  store.set("pt.settings", settings);
}

// ---------- init ----------
function init() {
  Object.entries(PROVIDERS).forEach(([id, p]) => els.provider.add(new Option(p.label, id)));
  Object.entries(TARGETS).forEach(([id, t]) => els.target.add(new Option(t.label, id)));
  els.provider.value = PROVIDERS[settings.provider] ? settings.provider : "anthropic";

  EXAMPLES.forEach((ex) => {
    const c = document.createElement("button");
    c.type = "button";
    c.className = "chip";
    c.textContent = ex;
    c.addEventListener("click", () => { els.request.value = ex; resetClarify(); els.request.focus(); });
    els.examples.append(c);
  });

  els.settingsBtn.addEventListener("click", () => { fillSettingsForm(); els.settingsDialog.showModal(); });
  els.provider.addEventListener("change", fillSettingsForm);
  els.settingsForm.addEventListener("submit", saveSettings);
  els.clearKeyBtn.addEventListener("click", () => { els.apiKey.value = ""; saveSettings(); });

  els.translateBtn.addEventListener("click", translate);
  els.generateBtn.addEventListener("click", () => generate(true));
  els.skipBtn.addEventListener("click", () => generate(false));
  els.refineBtn.addEventListener("click", refine);
  els.feedback.addEventListener("keydown", (e) => { if (e.key === "Enter") refine(); });
  els.request.addEventListener("input", resetClarify);
  els.request.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); translate(); }
  });
  els.output.addEventListener("input", updateOutputState);

  els.copyBtn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(els.output.value); }
    catch { els.output.select(); document.execCommand("copy"); }
    els.copyBtn.textContent = "Copied ✓";
    setTimeout(() => (els.copyBtn.textContent = "Copy"), 1500);
  });
  els.downloadBtn.addEventListener("click", () => {
    const blob = new Blob([els.output.value], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "prompt.md";
    a.click();
    URL.revokeObjectURL(a.href);
  });
  els.clearHistoryBtn.addEventListener("click", () => { history = []; store.set("pt.history", history); renderHistory(); });

  renderHistory();
  updateOutputState();

  const p = PROVIDERS[settings.provider];
  if (p.keyRequired && !settings.keys[settings.provider]) {
    fillSettingsForm();
    els.settingsDialog.showModal();
  }
}

init();

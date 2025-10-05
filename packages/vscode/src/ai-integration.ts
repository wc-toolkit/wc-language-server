import * as vscode from "vscode";
import { WorkspaceState } from "./state";
import { createHash } from "crypto";

// ------------------------------ Types ------------------------------
interface DocChunk {
  component: string;
  chunkId: string;
  heading?: string;
  text: string;
  tokensApprox: number;
  hash: string;
  updatedAt: number;
}
interface EmbeddingRecord {
  chunkId: string;
  component: string;
  vector: number[];
  model: string;
  chunkHash: string;
  updatedAt: number;
}

// ------------------------------ State ------------------------------
let _workspaceState: WorkspaceState | undefined;
let _context: vscode.ExtensionContext | undefined;
let _log: (m: string) => void = () => {};
let _chunks: DocChunk[] = [];
const _docsIndex: Record<string, string> = {}; // raw docs by component for direct listing & future enrichment
const _embeddings: Map<string, EmbeddingRecord> = new Map();
let _embeddingModel = "local-hash-v1";
let _ingestionInProgress: Promise<void> | null = null; // tracks current ingestion cycle

const STORAGE_CHUNKS = "ai.docChunks.v1";
const STORAGE_EMBEDDINGS = "ai.embeddings.v1";

// ------------------------------ Helpers ------------------------------
function sha256(t: string) {
  return createHash("sha256").update(t).digest("hex");
}
function tokenEstimate(t: string) {
  return Math.round(t.split(/\s+/).filter(Boolean).length * 1.2);
}
function splitSections(raw: string): string[] {
  const parts = raw.split(/\n(?=#+\s)/);
  return parts.length > 1 ? parts : raw.split(/\n\n+/);
}
function chunkDoc(component: string, raw: string, now: number): DocChunk[] {
  const maxLen = 1200;
  const secs = splitSections(raw);
  const out: DocChunk[] = [];
  let i = 0;
  for (const sec of secs) {
    if (sec.length <= maxLen) push(sec);
    else {
      const paras = sec.split(/\n\n+/);
      let buf = "";
      for (const p of paras) {
        if ((buf + p).length > maxLen && buf) {
          push(buf);
          buf = "";
        }
        buf += (buf ? "\n\n" : "") + p;
      }
      if (buf) push(buf);
    }
  }
  return out;
  function push(text: string) {
    const heading = text.match(/^#{1,6}\s+(.*)$/m)?.[1]?.trim();
    out.push({
      component,
      chunkId: `${component}::${i++}`,
      heading,
      text: text.trim(),
      tokensApprox: tokenEstimate(text),
      hash: sha256(text),
      updatedAt: now,
    });
  }
}

// ------------------------------ Embedding Provider ------------------------------
interface EmbeddingProvider {
  model: string;
  embed(texts: string[]): Promise<number[][]>;
}
class LocalHashEmbeddingProvider implements EmbeddingProvider {
  model = _embeddingModel;
  dim = 64;
  async embed(texts: string[]) {
    return texts.map((t) => this.vec(t));
  }
  vec(t: string) {
    const v = new Array<number>(this.dim).fill(0);
    for (const tok of t.toLowerCase().split(/\W+/).filter(Boolean)) {
      let h = 0;
      for (let i = 0; i < tok.length; i++)
        h = (h * 31 + tok.charCodeAt(i)) >>> 0;
      v[h % this.dim] += 1;
    }
    const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map((x) => x / n);
  }
}
let embeddingProvider: EmbeddingProvider = new LocalHashEmbeddingProvider();
export function setEmbeddingProvider(p: EmbeddingProvider) {
  embeddingProvider = p;
  _embeddingModel = p.model;
}

// ------------------------------ Persistence ------------------------------
function restore(context: vscode.ExtensionContext) {
  _context = context;
  const sc = context.workspaceState.get<DocChunk[]>(STORAGE_CHUNKS, []);
  const se = context.workspaceState.get<EmbeddingRecord[]>(
    STORAGE_EMBEDDINGS,
    []
  );
  if (sc?.length) {
    _chunks = sc;
    _log(`AI: restored ${_chunks.length} chunks`);
  }
  if (se?.length) {
    for (const e of se)
      if (e.model === embeddingProvider.model) _embeddings.set(e.chunkId, e);
    if (se.length) _log(`AI: restored ${_embeddings.size} embeddings`);
  }
}
async function persist() {
  if (!_context) return;
  await _context.workspaceState.update(STORAGE_CHUNKS, _chunks);
  await _context.workspaceState.update(
    STORAGE_EMBEDDINGS,
    Array.from(_embeddings.values())
  );
}

// ------------------------------ Public Ingestion ------------------------------
export async function activateAIIntegration(
  docs: Record<string, string>,
  context: vscode.ExtensionContext,
  log: (msg: string) => void
): Promise<void> {
  // Wrap ingestion so answerQuestion can await if needed
  const doIngest = async () => {
  _log = log;
  if (!_workspaceState) _workspaceState = new WorkspaceState(context);
  restore(context);
  const keys = Object.keys(docs || {});
  if (!keys.length) {
    log("AI Integration - no docs to process");
    return;
  }
  const updated = await _workspaceState.getUpdatedDocs(docs);
  const updatedKeys = Object.keys(updated);
  // If nothing is reported as updated BUT we have no chunks yet (first activation scenario edge), treat all as new
  if (!updatedKeys.length && _chunks.length === 0) {
    const nowAll = Date.now();
    for (const k of keys) {
      _docsIndex[k] = docs[k];
      _chunks.push(...chunkDoc(k, docs[k], nowAll));
    }
    log(`AI: chunked (initial no-update case) ${keys.length} components; total chunks=${_chunks.length}`);
    await persist();
    setTimeout(() => {
      ensureEmbeddings().catch((e) =>
        _log(`AI: embedding precompute failed: ${(e as Error).message}`)
      );
    }, 50);
    return;
  } else if (!updatedKeys.length) {
    // truly no changes and we already have chunks
    return;
  }
  const now = Date.now();
  const changed = new Set(updatedKeys);
  _chunks = _chunks.filter((c) => !changed.has(c.component));
  // update docs index with changed components
  for (const k of updatedKeys) _docsIndex[k] = docs[k];
  for (const tag of updatedKeys) {
    const raw = docs[tag];
    _chunks.push(...chunkDoc(tag, raw, now));
  }
  log(
    `AI: chunked ${updatedKeys.length} components; total chunks=${_chunks.length}`
  );
  await persist();
  // Precompute embeddings in the background (non-blocking for activation) to improve first-answer latency
  setTimeout(() => {
    ensureEmbeddings().catch((e) =>
      _log(`AI: embedding precompute failed: ${(e as Error).message}`)
    );
  }, 50);
  };
  _ingestionInProgress = doIngest();
  await _ingestionInProgress.catch(()=>{}); // don't throw here; logging already done
  _ingestionInProgress = null;
}

// ------------------------------ Embeddings & Retrieval ------------------------------
async function ensureEmbeddings() {
  const pending = _chunks.filter((c) => {
    const e = _embeddings.get(c.chunkId);
    return !e || e.chunkHash !== c.hash || e.model !== embeddingProvider.model;
  });
  if (!pending.length) return;
  const vecs = await embeddingProvider.embed(pending.map((c) => c.text));
  const now = Date.now();
  pending.forEach((c, i) => {
    _embeddings.set(c.chunkId, {
      chunkId: c.chunkId,
      component: c.component,
      vector: vecs[i],
      model: embeddingProvider.model,
      chunkHash: c.hash,
      updatedAt: now,
    });
  });
  _log(`AI: embedded ${pending.length} chunks (total=${_embeddings.size})`);
  await persist();
}
function cosine(a: number[], b: number[]) {
  let d = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    d += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return d / ((Math.sqrt(na) || 1) * (Math.sqrt(nb) || 1));
}
export async function getRAGContextForQuery(
  query: string,
  k = 8,
  maxTokens = 3500
) {
  await ensureEmbeddings();
  const [qv] = await embeddingProvider.embed([query]);
  const scored = Array.from(_embeddings.values())
    .map((e) => ({ e, score: cosine(qv, e.vector) }))
    .sort((a, b) => b.score - a.score);
  const chosen: DocChunk[] = [];
  let budget = 0;
  for (const { e } of scored) {
    if (chosen.length >= k) break;
    const c = _chunks.find((x) => x.chunkId === e.chunkId);
    if (!c) continue;
    if (budget + c.tokensApprox > maxTokens) continue;
    chosen.push(c);
    budget += c.tokensApprox;
  }
  const contextText = chosen
    .map(
      (c) =>
        `Component: <${c.component}>${c.heading ? ` | ${c.heading}` : ""}\n${c.text}`
    )
    .join("\n---\n");
  return { chunks: chosen, contextText };
}
async function waitForIngestion(timeoutMs = 4000) {
  if (_chunks.length) return; // already have data
  const start = Date.now();
  while (_ingestionInProgress) {
    try { await Promise.race([_ingestionInProgress, new Promise(r=>setTimeout(r,100))]); } catch { /* swallow */ }
    if (_chunks.length) return;
    if (Date.now() - start > timeoutMs) return; // give up after timeout
  }
}

function detectListIntent(qLower: string): boolean {
  const simple = /(what|which)\s+(web\s+)?components/.test(qLower) || /list\s+(all\s+)?(web\s+)?components/.test(qLower);
  if (simple) return true;
  // heuristic: contains 'components' + one of 'available','defined','in this project'
  if (qLower.includes('component') && (qLower.includes('available') || qLower.includes('defined') || qLower.includes('in this project'))) return true;
  return false;
}

export async function answerQuestion(question: string) {
  if (!_context) throw new Error("AI not initialized");
  const qLower = question.toLowerCase();
  await waitForIngestion();
  const listIntent = detectListIntent(qLower);

  // Fast path: direct enumeration if user is clearly asking for list of components
  if (listIntent) {
    const namesSet = new Set<string>();
    if (_chunks.length) {
      for (const c of _chunks) namesSet.add(c.component);
    } else {
      for (const k of Object.keys(_docsIndex)) namesSet.add(k);
    }
    const names = Array.from(namesSet).sort((a, b) => a.localeCompare(b));
    if (!names.length) {
      if (!_chunks.length && !_docsIndex || (Object.keys(_docsIndex).length===0)) {
        return "Docs not loaded yet (try again after build/manifest load).";
      }
      return "Not in docs.";
    }
    // Provide a concise list. Avoid invoking LM for deterministic answer
    return (
      `The project defines ${names.length} web component${names.length === 1 ? "" : "s"}:\n` +
      names.map((n) => `- <${n}>`).join("\n")
    );
  }

  const { contextText, chunks } = await getRAGContextForQuery(question);
  const system = `You are a Web Components assistant. Use ONLY provided context chunks. If answer not found, reply exactly: Not in docs.`;
  // If retrieval produced no chunks, attempt a graceful fallback for discovery-style questions
  let augmentedContext = contextText;
  if (!chunks.length) {
    const names = Array.from(new Set(_chunks.map((c) => c.component))).sort();
    if (names.length) {
      augmentedContext =
        `Component Inventory:\n` + names.map((n) => `<${n}>`).join(", ");
    }
  }
  const prompt = `${system}\n\nContext (chunks=${chunks.length}):\n${augmentedContext}\n\nQuestion:\n${question}\n\nAnswer:`;
  return sendToVSCodeLM(prompt);
}
export function getAIStats() {
  return {
    chunks: _chunks.length,
    embeddings: _embeddings.size,
    model: embeddingProvider.model,
  };
}

async function sendToVSCodeLM(prompt: string): Promise<string> {
  // Uses VSCode's built-in language model API
  // Works with Copilot, GitHub Models, or other providers

  const models = await vscode.lm.selectChatModels();

  if (models.length === 0) {
    throw new Error(
      "No language models available. Please install an AI extension like GitHub Copilot."
    );
  }

  const model = models[0];
  const messages = [vscode.LanguageModelChatMessage.User(prompt)];

  const chatRequest = await model.sendRequest(
    messages,
    {},
    new vscode.CancellationTokenSource().token
  );

  let result = "";
  for await (const fragment of chatRequest.text) {
    result += fragment;
  }

  return result;
}

// legacy helpers removed (superseded by retrieval flow)

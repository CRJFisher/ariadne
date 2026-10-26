"use strict";

// Two views, chosen by the URL hash: the overview (#/) groups every case by
// how its verdicts disagree, and a case view (#/case/<id>) holds the vote.
// A view is built once when it is entered. Every later interaction updates
// the elements it affects from `drafts`, so a click never rebuilds the page
// and never moves the scroll position. The window is the only scroller, and
// returning to the overview restores where it was left.

const KINDS = ["tp", "fp-novel", "fp-classifier-regression", "uncertain"];
const SHORT_KIND = { tp: "tp", "fp-novel": "novel", "fp-classifier-regression": "regression", uncertain: "uncertain" };
const QUICK_PROMPTS = [
  ["Explain this case", "Explain in plain terms what this case is about: what the entry is, what Ariadne reported, and what the verdict has to decide."],
  ["Why do they disagree?", "Why do the verdicts on this case disagree? For each candidate, what evidence supports it and what does it overlook?"],
  ["Is there a real caller?", "Is there a real in-repo caller of this entry that reaches this exact definition? Show me the line and explain why it does or doesn't count."],
  ["Which rule covers it?", "Does any in-scope classifier rule's described intent cover this call pattern? Quote the rule and explain the match or mismatch."],
  ["What would you vote?", "Given the definitions, which candidate verdict would you vote for, and how confident are you? If none fits, what should change in the taxonomy?"],
];

let data = null;
let current_id = null;
let last_opened_id = null;
let overview_scroll = 0;
let filter = "needs-vote";
let selection = "";
let streaming = false;
const drafts = new Map();
const saved = new Map();

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const by_id = (id) => data.cases.find((c) => c.case_id === id);
const group_of = (c) => data.groups.find((g) => g.id === c.disagreement);
const needs_vote = (c) => group_of(c).needs_vote;

function try_storage(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

// ===== Review state =====

function empty_review() {
  return {
    decision: null, chosen: null, agreed_with: [], also_acceptable: [],
    walkthrough: { real_caller: null, reaches_definition: null, rule_covers: null },
    feedback: null, notes: "", reviewed_at: "",
  };
}

function draft_for(id) {
  if (!drafts.has(id)) drafts.set(id, structuredClone(saved.get(id) ?? empty_review()));
  return drafts.get(id);
}

/** Cases in overview order: by group, then as the suite lists them. */
function ordered_cases() {
  return data.groups.flatMap((g) => data.cases.filter((c) => c.disagreement === g.id && (filter === "all" || g.needs_vote)));
}

let save_timer = null;
function schedule_save(id, delay = 0) {
  clearTimeout(save_timer);
  set_save_state("Saving…");
  save_timer = setTimeout(() => save_review(id), delay);
}

async function save_review(id) {
  const draft = draft_for(id);
  draft.reviewed_at = new Date().toISOString();
  try {
    const res = await fetch(`/api/review/${encodeURIComponent(id)}`, {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(draft),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error);
    saved.set(id, structuredClone(body.reviews[id]));
    set_save_state(`Saved to human_review.json at ${new Date().toLocaleTimeString()}`);
  } catch (err) {
    set_save_state(`Not saved: ${err.message}`, true);
  }
}

function set_save_state(text, error = false) {
  const el = $("#save-state");
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("error", error);
}

// ===== Formatting =====

function kind_chip(kind) {
  if (!kind) return `<span class="chip kind-none">no verdict</span>`;
  return `<button type="button" class="chip term kind-${esc(kind)}" data-term="kind:${esc(kind)}">${esc(kind)}</button>`;
}
function short_chip(kind, rule_id) {
  if (!kind) return `<span class="chip kind-none" title="no valid verdict">none</span>`;
  const title = rule_id ? `${kind}: ${rule_id}` : kind;
  return `<span class="chip kind-${esc(kind)}" title="${esc(title)}">${esc(SHORT_KIND[kind])}</span>`;
}
function rule_term(rule_id) {
  return rule_id ? `<button type="button" class="term mono" data-term="rule:${esc(rule_id)}">${esc(rule_id)}</button>` : "";
}
function code_block(ex) {
  if (!ex || ex.missing) return `<div class="meta">(source file not found in the clone)</div>`;
  return `<pre class="code">${ex.lines.map((l) => `<span class="ln${l.n === ex.line ? " focus" : ""}"><span class="n">${l.n}</span>${esc(l.text)}</span>`).join("")}</pre>`;
}
function file_ref(c, file, line) {
  const gh = `https://github.com/${c.github}/blob/${c.commit}/${file}#L${line}`;
  return `<div class="file-ref">${esc(file)}:${line} · <a href="${esc(gh)}" target="_blank" rel="noopener">GitHub</a></div>`;
}
function candidate_label(kind, rule_id) {
  return `${kind_chip(kind)}${rule_id ? ` rule ${rule_term(rule_id)}` : ""}`;
}
function holders_text(cand) {
  return cand.holders.map((h) => (h.of > 1 ? `${esc(h.source_label)} ${h.count}/${h.of} runs` : esc(h.source_label))).join(" · ");
}
function md(text) {
  const blocks = esc(text).split(/```(?:\w+)?\n?/);
  return blocks.map((block, i) => {
    if (i % 2 === 1) return `<pre><code>${block}</code></pre>`;
    return block
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[\s(])_([^_\n]+)_(?=[\s.,;:)]|$)/g, "$1<em>$2</em>")
      .replace(/\n/g, "<br>");
  }).join("");
}
/** The first sentence of a verdict's explanation, for a one-line summary. */
function gist(text) {
  const flat = String(text ?? "").replace(/```[\s\S]*?```/g, " ").replace(/\s+/g, " ").trim();
  const sentence = flat.match(/^(.{30,260}?[.!?])(\s|$)/);
  if (sentence) return sentence[1];
  return flat.length > 260 ? `${flat.slice(0, 260)}…` : flat;
}
function same_verdict(a, b) {
  return a.kind === b.kind && (a.rule_id ?? null) === (b.rule_id ?? null);
}
function vote_text(id) {
  const r = saved.get(id);
  if (r?.decision === "agree") return { cls: "agree", text: `agreed: ${SHORT_KIND[r.chosen.kind]}` };
  if (r?.decision === "none-fits") return { cls: "none-fits", text: "none fits" };
  return { cls: "open", text: "—" };
}
function run_views(c, model) {
  return c.verdicts.filter((v) => v.source === model).sort((a, b) => a.repeat - b.repeat);
}
function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? null : s[Math.floor((s.length - 1) / 2)];
}

// ===== Overview =====

function model_summaries() {
  return data.runs.map((run) => {
    const pairs = data.cases.flatMap((c) => run_views(c, run.model).map((v) => ({ v, c })));
    const decided = pairs.filter(({ v }) => v.kind);
    const matches = decided.filter(({ v, c }) => c.label.acceptable_kinds.includes(v.kind)).length;
    const usd = pairs.reduce((t, { v }) => t + (v.usd ?? 0), 0);
    return {
      label: run.label,
      verdicts: pairs.length,
      expected: run.expected,
      matches,
      missing: pairs.length - decided.length,
      usd_per_case: pairs.length ? usd / pairs.length : 0,
      turns: median(pairs.map(({ v }) => v.turns ?? 0)),
      exposures: run.answer_key_exposures,
    };
  });
}

function intro_html() {
  const g = data.glossary;
  return `<details class="intro" id="intro">
    <summary>What you're deciding</summary>
    <div class="body">
      <p>Ariadne reports a function as a possible <em>entry point</em> when it finds nothing that calls it. For each case, an investigator model decides whether that report is right, and an Opus adjudicator wrote a gold label. Your vote settles the cases where they disagree or the label is unsure. Agree with one verdict, or record that none fits when the definitions themselves fall short.</p>
      <dl>${KINDS.map((k) => `<dt>${kind_chip(k)}</dt><dd>${md(g.kinds[k] ?? "")}</dd>`).join("")}</dl>
      <p class="meta">Every verdict kind, diagnosis and rule on the page is clickable for its definition. Inside a case, the Ask Claude pane answers questions about it.</p>
    </div>
  </details>`;
}

function models_html() {
  const cards = model_summaries().map((m) => `<div class="model-card">
    <div class="name">${esc(m.label)}</div>
    <div class="stat">matches the Opus label on <strong>${m.verdicts ? Math.round((100 * m.matches) / m.verdicts) : 0}%</strong> of verdicts (${m.matches}/${m.verdicts})</div>
    <div class="stat"><strong>$${m.usd_per_case.toFixed(4)}</strong> per case · median <strong>${m.turns ?? "?"}</strong> turns</div>
    <div class="stat">${m.missing} without a valid verdict${m.verdicts < m.expected ? ` · <span class="warn">${m.verdicts}/${m.expected} replays recorded</span>` : ""}${m.exposures ? ` · <span class="bad">${m.exposures} saw the answer key</span>` : ""}</div>
  </div>`);
  const label_card = `<div class="model-card"><div class="name">Opus label</div>
    <div class="stat">the gold verdict the models are graded against</div>
    <div class="stat"><strong>${data.cases.filter((c) => c.label.confidence === "high").length}</strong> high confidence · <strong>${data.cases.filter((c) => c.label.confidence !== "high").length}</strong> medium</div></div>`;
  if (data.runs.length === 0) return `<div class="models">${label_card}</div><p class="warn">No benchmark runs found: only the Opus label is shown.</p>`;
  return `<div class="models">${label_card}${cards.join("")}</div>`;
}

function case_row(c) {
  const label = { kind: c.label.kind, rule_id: c.label.rule_id };
  const cells = data.runs.flatMap((run) => {
    const views = run_views(c, run.model);
    const repeats = Math.max(1, ...data.cases.map((x) => run_views(x, run.model).length));
    return Array.from({ length: repeats }, (_, i) => {
      const v = views[i];
      if (!v) return `<td class="meta">…</td>`;
      return `<td class="${same_verdict(v, label) ? "" : "differs"}">${short_chip(v.kind, v.rule_id)}</td>`;
    });
  });
  const vote = vote_text(c.case_id);
  return `<tr data-id="${esc(c.case_id)}" class="${c.case_id === last_opened_id ? "last-opened" : ""}">
    <td class="case-name"><a href="#/case/${encodeURIComponent(c.case_id)}">${esc(c.entry.name)}</a>${c.flagged ? `<span class="badge">label flagged</span>` : ""}
      <div class="sub">${esc(c.github)} · <span class="mono">${esc(c.entry.definition.file)}:${c.entry.definition.line}</span></div></td>
    <td class="label-col">${short_chip(c.label.kind, c.label.rule_id)}</td>
    ${cells.join("")}
    <td class="vote-cell ${vote.cls}">${esc(vote.text)}</td>
  </tr>`;
}

function columns_html() {
  return data.runs.flatMap((run) => {
    const repeats = Math.max(1, ...data.cases.map((x) => run_views(x, run.model).length));
    return Array.from({ length: repeats }, (_, i) => `<th>${esc(run.label)}${repeats > 1 ? ` · run ${i + 1}` : ""}</th>`);
  }).join("");
}

function group_html(group, cases) {
  const voted = cases.filter((c) => saved.get(c.case_id)?.decision).length;
  return `<details class="group" data-group="${esc(group.id)}"${group.needs_vote ? " open" : ""}>
    <summary><div class="group-head"><span class="caret">▸</span><span class="title">${esc(group.title)}</span>
      <span class="count">${cases.length} case${cases.length === 1 ? "" : "s"}${group.needs_vote ? ` · ${voted} voted` : " · no vote needed"}</span></div></summary>
    <div class="question">${esc(group.question)}</div>
    <div class="table-wrap"><table class="cases">
      <thead><tr><th>Case</th><th class="label-col">Opus label</th>${columns_html()}<th>Your vote</th></tr></thead>
      <tbody>${cases.map(case_row).join("")}</tbody>
    </table></div>
  </details>`;
}

function render_overview() {
  const pool = data.cases.filter(needs_vote);
  const decided = pool.filter((c) => saved.get(c.case_id)?.decision).length;
  const groups = data.groups
    .filter((g) => filter === "all" || g.needs_vote)
    .map((g) => ({ g, cases: data.cases.filter((c) => c.disagreement === g.id) }))
    .filter(({ cases }) => cases.length > 0);
  $("#view").className = "view overview";
  $("#view").innerHTML = `
    <div class="overview-head"><h1>Benchmark review</h1><span class="progress">${decided} of ${pool.length} cases needing a vote decided</span></div>
    ${intro_html()}
    ${models_html()}
    <div class="toolbar">
      <div class="seg" role="group" aria-label="Show">
        <button type="button" data-filter="needs-vote" class="${filter === "needs-vote" ? "on" : ""}">Needs a vote (${pool.length})</button>
        <button type="button" data-filter="all" class="${filter === "all" ? "on" : ""}">All cases (${data.cases.length})</button>
      </div>
      <span class="meta">Cells that differ from the Opus label are highlighted. Click a case to vote on it.</span>
    </div>
    ${groups.map(({ g, cases }) => group_html(g, cases)).join("")}`;
  const intro_open = try_storage(() => localStorage.getItem("benchmark-review-intro"), null);
  $("#intro").open = intro_open === null ? saved.size === 0 : intro_open === "open";
}

// ===== Case view =====

function verdict_row(c, v, label) {
  const differs = !same_verdict(v, label);
  const who = `${esc(v.source_label)}${v.repeat ? ` · run ${v.repeat}` : ""}`;
  const cost = v.usd != null ? `${v.turns ?? "?"} turns · $${v.usd.toFixed(4)}` : "";
  const warn = [
    v.saw_answer_key ? `<div class="bad">This run read a benchmark label file, so it saw the answer key.</div>` : "",
    v.error ? `<div class="bad">${esc(v.error)}</div>` : "",
  ].join("");
  const tools = v.tool_calls.length
    ? `<details class="sub"><summary>What it looked at (${v.tool_calls.length} tool calls)</summary><ol class="tools">${v.tool_calls.map((t) => `<li>${esc(t.name)} ${esc(t.input.slice(0, 220))}</li>`).join("")}</ol></details>`
    : "";
  return `<details class="verdict${differs ? " differs" : ""}">
    <summary><span class="who"><span class="caret">▸</span>${who}</span>
      <span>${candidate_label(v.kind, v.rule_id)}<div class="gist">${md(gist(v.explanation || v.error))}</div></span>
      <span class="cost">${cost}</span></summary>
    <div class="body">
      ${warn}
      ${v.explanation ? `<p>${md(v.explanation)}</p>` : ""}
      ${v.evidence ? `<div class="meta"><strong>Evidence it cites:</strong> ${md(v.evidence.why)}</div>${file_ref(c, v.evidence.excerpt.file, v.evidence.excerpt.line)}${code_block(v.evidence.excerpt)}` : ""}
      ${tools}
    </div>
  </details>`;
}

function label_row(c) {
  const l = c.label;
  const callers = l.caller_evidence.length
    ? l.caller_evidence.map((e) => `${file_ref(c, e.file, e.line)}${code_block(e)}`).join("")
    : `<p class="meta">None: a tp label cites no callers.</p>`;
  return `<details class="verdict label" id="ev-callers">
    <summary><span class="who"><span class="caret">▸</span>Opus label</span>
      <span>${candidate_label(l.kind, l.rule_id)} <span class="meta">· ${esc(l.confidence)} confidence${l.acceptable_kinds.length > 1 ? ` · also acceptable: ${l.acceptable_kinds.filter((k) => k !== l.kind).map(kind_chip).join(" ")}` : ""}</span>
        <div class="gist">${md(gist(l.rationale))}</div></span>
      <span class="cost">gold</span></summary>
    <div class="body">
      <p>${md(l.rationale)}</p>
      ${l.tp_search_summary ? `<p class="meta"><strong>How it ruled callers out:</strong> ${md(l.tp_search_summary)}</p>` : ""}
      <h3>Callers it cites (${l.caller_evidence.length})</h3>
      ${callers}
      <p class="meta"><strong>On the earlier pipeline verdicts:</strong> ${md(l.prior_verdicts_assessment)}</p>
    </div>
  </details>`;
}

function walkthrough_html() {
  const g = data.glossary;
  const pitfall = (title) => g.pitfalls.find((p) => p.title === title)?.text ?? "";
  const questions = [
    ["real_caller", "1. Does a real in-repo caller of this entry exist?", g.real_caller, "#ev-callers"],
    ["reaches_definition", "2. Does that call reach this exact definition, not a same-named sibling?", pitfall("Name collisions"), "#ev-callers"],
    ["rule_covers", "3. Does an in-scope rule's described intent clearly cover that call pattern?", pitfall("Over-generous regressions"), "#ev-rules"],
  ];
  return `<div class="walk">${questions.map(([key, q, help, anchor]) => `
    <div class="q" data-q="${key}">
      <div>${esc(q)} <button type="button" class="link" data-jump="${anchor}">see evidence</button></div>
      <div class="seg">${["yes", "no", "unsure"].map((a) => `<button type="button" data-walk="${key}" data-answer="${a}">${a}</button>`).join("")}</div>
      <div class="help">${md(help)}</div>
    </div>`).join("")}
    <div class="implied" id="implied"></div></div>`;
}

function implied_kind(w) {
  if (w.real_caller === "no") return { kind: "tp", text: "Your answers point to tp: nothing in the repo calls it." };
  if (w.real_caller === "yes" && w.reaches_definition === "no") return { kind: "tp", text: "Your answers point to tp: the call reaches a different definition, so this one has no caller." };
  if (w.real_caller === "yes" && w.reaches_definition === "yes" && w.rule_covers === "yes") return { kind: "fp-classifier-regression", text: "Your answers point to fp-classifier-regression: a rule should have caught this caller." };
  if (w.real_caller === "yes" && w.reaches_definition === "yes" && w.rule_covers === "no") return { kind: "fp-novel", text: "Your answers point to fp-novel: a real caller that no rule targets." };
  if (Object.values(w).includes("unsure")) return { kind: null, text: "You're unsure on a step: ask Claude to show you the evidence for it." };
  return { kind: null, text: "Answer the questions to see which verdict the definitions point to." };
}

function vote_html(c) {
  const targets = data.feedback_targets.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
  const rules = c.rules.map((r) => `<option value="${esc(r.group_id)}">${esc(r.group_id)}</option>`).join("");
  return `<div class="vote">
    <div class="candidates">${c.candidates.map((cand, i) => `
      <div class="candidate" data-candidate="${esc(cand.key)}">
        <div>${candidate_label(cand.kind, cand.rule_id)}<span class="match">matches your walkthrough</span></div>
        <div class="holders">held by ${holders_text(cand)}</div>
        <div class="act"><button type="button" data-agree="${esc(cand.key)}">Agree${i < 9 ? ` <kbd>${i + 1}</kbd>` : ""}</button></div>
      </div>`).join("")}
    </div>
    <details class="none-fits" id="none-fits">
      <summary><strong>None of these fits</strong> <span class="meta">The definitions or a rule don't capture this case. Say what's wrong; it feeds taxonomy changes.</span></summary>
      <div class="form">
        <label>What does it concern?<select id="fb-target">${targets}</select></label>
        <label id="fb-rule-wrap">Which rule?<select id="fb-rule">${rules}</select></label>
        <label>What doesn't fit<textarea id="fb-problem" rows="2"></textarea></label>
        <label>What should change<textarea id="fb-proposal" rows="2"></textarea></label>
        <div class="row"><button type="button" id="fb-record">Record "none fits"</button><span class="meta" id="fb-error"></span></div>
      </div>
    </details>
    <div class="vote-foot">
      <div id="also-wrap"><span class="meta">Also defensible to a careful reviewer:</span> ${KINDS.map((k) => `<label class="check"><input type="checkbox" data-also="${k}"> ${k}</label>`).join("")}</div>
      <label class="meta">Notes<textarea id="notes" rows="2" placeholder="What you checked, what convinced you"></textarea></label>
      <div class="row" style="justify-content:space-between"><span class="save-state" id="save-state"></span>
        <span class="row"><button type="button" id="clear-vote" class="link">clear vote</button><button type="button" id="next-case">Next case →</button></span></div>
    </div>
  </div>`;
}

function excerpt_lines(ex, from, to) {
  return { ...ex, lines: ex.lines.filter((l) => l.n >= from && l.n <= to) };
}

/** The definition's opening lines, with the rest of the excerpt one click away. */
function definition_html(c) {
  const ex = c.entry.definition;
  if (ex.missing) return code_block(ex);
  const head_end = ex.line + 11;
  const rest = ex.lines.filter((l) => l.n > head_end).length;
  return `${code_block(excerpt_lines(ex, ex.line - 2, head_end))}
    ${rest ? `<details class="sub"><summary>Show ${rest} more lines</summary>${code_block(excerpt_lines(ex, head_end + 1, Infinity))}</details>` : ""}`;
}

function count_phrase(n, one, many) {
  return `${n === 0 ? "no" : n} ${n === 1 ? one : many}`;
}

/** What detection saw before any investigation, as one sentence per source. */
function detection_summary(c) {
  const d = c.diagnostics;
  const first = (list) => list.items[0] ? ` (e.g. <code>${esc(list.items[0].site)}</code>: <code>${esc(list.items[0].content ?? list.items[0].resolution)}</code>)` : "";
  return `<ul class="detected">
    <li>grep found ${count_phrase(d.grep_call_sites.total, "call site", "call sites")} in indexed files${first(d.grep_call_sites)}${d.grep_call_sites_outside_index.total ? `, and ${count_phrase(d.grep_call_sites_outside_index.total, "call site", "call sites")} in files Ariadne does not index${first(d.grep_call_sites_outside_index)}` : ""}.</li>
    <li>Ariadne indexed ${count_phrase(d.ariadne_call_refs.total, "call", "calls")} with this name${d.ariadne_call_refs.items[0] ? ` (e.g. <code>${esc(d.ariadne_call_refs.items[0].site)}</code>, ${esc(d.ariadne_call_refs.items[0].resolution)})` : ""}, and resolved none of them to this definition.</li>
    ${d.reference_sites.total ? `<li>The name also appears in ${count_phrase(d.reference_sites.total, "non-call reference", "non-call references")}${first(d.reference_sites)}.</li>` : ""}
  </ul>`;
}

function about_html(c) {
  const e = c.entry;
  const diagnosis = data.glossary.diagnoses[c.diagnosis];
  const where = `${e.definition.file}:${e.definition.line}`;
  const gh = `https://github.com/${c.github}/blob/${c.commit}/${e.definition.file}#L${e.definition.line}`;
  return `<section class="about">
    <div class="about-title"><h2>${esc(e.name)}</h2><span class="chip">${esc(e.kind)}</span><span class="chip">${e.is_exported ? "exported" : "not exported"}</span><span class="chip">${esc(c.language)}</span></div>
    <div class="about-where">Defined at <code>${esc(where)}</code> in <strong>${esc(c.github)}</strong> · <a href="${esc(gh)}" target="_blank" rel="noopener">open on GitHub</a> <span class="meta">at <span class="mono">${esc(c.commit.slice(0, 10))}</span></span></div>
    ${e.signature ? `<div class="meta">Signature <code>${esc(e.signature)}</code></div>` : ""}
    ${definition_html(c)}
    <h4>Why it is a case</h4>
    <p>Ariadne's call graph has no caller for this definition, so it reported <code>${esc(e.name)}</code> as a possible entry point. Detection then sorted it into the
      <button type="button" class="term" data-term="diagnosis:${esc(c.diagnosis)}">${esc(diagnosis?.title ?? c.diagnosis)}</button> route. ${diagnosis ? md(diagnosis.text) : ""}</p>
    ${detection_summary(c)}
  </section>`;
}

function more(title, note, body, attrs = "") {
  return `<details class="more"${attrs}><summary>${esc(title)}${note ? `<span class="meta">${note}</span>` : ""}</summary><div class="body">${body}</div></details>`;
}

function render_case() {
  const c = by_id(current_id);
  const group = group_of(c);
  const label = { kind: c.label.kind, rule_id: c.label.rule_id };
  const order = ordered_cases();
  const at = order.findIndex((x) => x.case_id === c.case_id);
  const d = c.diagnostics;
  const diag_table = (title, list, cols) => list.total === 0 ? "" :
    `<details class="sub"><summary>${esc(title)}: ${list.total}${list.total > list.items.length ? ` (first ${list.items.length})` : ""}</summary><table class="diag">${list.items.map((it) => `<tr>${cols.map((k) => `<td>${esc(it[k])}</td>`).join("")}</tr>`).join("")}</table></details>`;
  const no_evidence = [d.grep_call_sites, d.grep_call_sites_outside_index, d.ariadne_call_refs, d.reference_sites].every((l) => l.total === 0);

  $("#view").className = "view";
  $("#view").innerHTML = `
    <div class="case-bar">
      <a href="#/">← Overview</a>
      <span class="crumb">${esc(group.title)}${at >= 0 ? ` · ${at + 1} of ${order.length}` : ""}</span>
      <span class="spacer"></span>
      <span class="hint"><kbd>Esc</kbd> overview · <kbd>j</kbd>/<kbd>k</kbd> next/previous · <kbd>1</kbd>–<kbd>9</kbd> agree</span>
      <button type="button" data-step="-1">← Previous</button><button type="button" data-step="1">Next →</button>
    </div>

    ${about_html(c)}

    <div class="lede"><div class="q-title">To decide: ${esc(group.title)}</div>${esc(group.question)}</div>

    <h3>What each verdict says</h3>
    <p class="meta">Click a row for its full reasoning, the evidence it cites and what it looked at. Rows marked red differ from the Opus label.</p>
    <div class="said">
      ${label_row(c)}
      ${c.verdicts.map((v) => verdict_row(c, v, label)).join("")}
      ${c.verdicts.length === 0 ? `<p class="meta">No model has replayed this case yet.</p>` : ""}
    </div>

    <h3>Your vote</h3>
    ${vote_html(c)}

    <h3>Dig deeper</h3>
    ${more("Not sure? Work it through in three questions", "the verdict definitions as yes/no steps", walkthrough_html())}
    ${more("In-scope classifier rules", `${c.rules.length} rules${c.rules.some((r) => r.cited) ? ", cited ones highlighted" : ""}`,
      `<p class="meta">A rule is a known permanent limitation of static analysis. A regression verdict claims one of these should have caught the caller.</p>
      ${c.rules.map((r) => `<div class="card${r.cited ? " cited" : ""}"><div>${rule_term(r.group_id)} · ${esc(r.title)}</div><div class="meta">${md(r.description)}</div>
        ${r.example_case_ids.length ? `<div class="meta">Other cases labelled with this rule: ${r.example_case_ids.map((id) => `<a href="#/case/${encodeURIComponent(id)}">${esc(by_id(id)?.entry.name ?? id)}</a>`).join(", ")}</div>` : ""}</div>`).join("")}`,
      ` id="ev-rules"`)}
    ${more("What Ariadne and grep saw", "the evidence detection had before any investigation",
      `${diag_table("Grep call sites", d.grep_call_sites, ["site", "content"])}
      ${diag_table("Grep call sites outside the index", d.grep_call_sites_outside_index, ["site", "content"])}
      ${diag_table("Ariadne call references", d.ariadne_call_refs, ["site", "caller", "resolution"])}
      ${diag_table("Non-call reference sites", d.reference_sites, ["site", "content"])}
      ${no_evidence ? `<p class="meta">Nothing: grep found no call site and Ariadne no reference.</p>` : ""}`)}
    ${c.historical.length ? more("Earlier pipeline verdicts", `${c.historical.length} from triage runs, model inferred from the run date`,
      c.historical.map((v) => `<div class="card"><div><strong>${esc(v.source_label)}</strong> · ${candidate_label(v.kind, v.rule_id)}</div><p>${md(v.explanation)}</p>${v.evidence ? `${file_ref(c, v.evidence.excerpt.file, v.evidence.excerpt.line)}<div class="meta">${md(v.evidence.why)}</div>` : ""}</div>`).join("")) : ""}
  `;
  fill_vote_inputs(c);
  update_vote_ui();
}

function fill_vote_inputs(c) {
  const draft = draft_for(c.case_id);
  const fb = draft.feedback;
  $("#notes").value = draft.notes;
  $("#fb-target").value = fb?.target ?? "verdict-definitions";
  if (fb?.rule_id) $("#fb-rule").value = fb.rule_id;
  $("#fb-problem").value = fb?.problem ?? "";
  $("#fb-proposal").value = fb?.proposal ?? "";
  $("#none-fits").open = draft.decision === "none-fits";
}

function update_vote_ui() {
  const c = by_id(current_id);
  const draft = draft_for(c.case_id);
  const chosen_key = draft.chosen ? (draft.chosen.rule_id ? `${draft.chosen.kind}:${draft.chosen.rule_id}` : draft.chosen.kind) : null;
  const implied = implied_kind(draft.walkthrough);
  for (const el of $$(".candidate")) {
    const cand = c.candidates.find((x) => x.key === el.dataset.candidate);
    const chosen = draft.decision === "agree" && el.dataset.candidate === chosen_key;
    el.classList.toggle("chosen", chosen);
    el.classList.toggle("implied-match", implied.kind !== null && cand.kind === implied.kind);
    $(".act button", el).firstChild.textContent = chosen ? "Agreed " : "Agree ";
  }
  $("#none-fits").classList.toggle("chosen", draft.decision === "none-fits");
  $("#fb-record").textContent = draft.decision === "none-fits" ? 'Update "none fits"' : 'Record "none fits"';
  $("#fb-rule-wrap").hidden = $("#fb-target").value !== "classifier-rule";
  for (const box of $$("[data-also]")) {
    const is_chosen = draft.chosen?.kind === box.dataset.also;
    box.disabled = draft.decision !== "agree" || is_chosen;
    box.checked = draft.also_acceptable.includes(box.dataset.also);
    box.parentElement.style.opacity = is_chosen ? ".4" : "";
  }
  for (const b of $$("[data-walk]")) b.classList.toggle("on", draft.walkthrough[b.dataset.walk] === b.dataset.answer);
  const w = draft.walkthrough;
  $('[data-q="reaches_definition"]').classList.toggle("inactive", w.real_caller === "no");
  $('[data-q="rule_covers"]').classList.toggle("inactive", w.real_caller === "no" || w.reaches_definition === "no");
  $("#implied").textContent = implied.text;
  $("#clear-vote").hidden = draft.decision === null;
  if (!$("#save-state").textContent) {
    const s = saved.get(c.case_id);
    set_save_state(s?.decision ? `Vote saved ${new Date(s.reviewed_at).toLocaleString()}` : "No vote yet");
  }
}

// ===== Vote actions =====

function agree(key) {
  const c = by_id(current_id);
  const cand = c.candidates.find((x) => x.key === key);
  const draft = draft_for(c.case_id);
  draft.decision = "agree";
  draft.chosen = { kind: cand.kind, rule_id: cand.rule_id };
  draft.agreed_with = cand.holders.map((h) => h.source);
  draft.also_acceptable = draft.also_acceptable.filter((k) => k !== cand.kind);
  update_vote_ui();
  schedule_save(c.case_id);
}

function record_none_fits() {
  const c = by_id(current_id);
  const draft = draft_for(c.case_id);
  const target = $("#fb-target").value;
  const problem = $("#fb-problem").value.trim();
  if (!problem) { $("#fb-error").textContent = "Say what doesn't fit first."; $("#fb-problem").focus({ preventScroll: true }); return; }
  $("#fb-error").textContent = "";
  draft.decision = "none-fits";
  draft.chosen = null;
  draft.agreed_with = [];
  draft.also_acceptable = [];
  draft.feedback = { target, rule_id: target === "classifier-rule" ? $("#fb-rule").value : null, problem, proposal: $("#fb-proposal").value.trim() };
  update_vote_ui();
  schedule_save(c.case_id);
}

function clear_vote() {
  const c = by_id(current_id);
  const draft = draft_for(c.case_id);
  Object.assign(draft, { decision: null, chosen: null, agreed_with: [], also_acceptable: [] });
  update_vote_ui();
  schedule_save(c.case_id);
}

// ===== Navigation =====

function route() {
  const match = location.hash.match(/^#\/case\/(.+)$/);
  const id = match ? decodeURIComponent(match[1]) : null;
  if (id && by_id(id)) return show_case(id);
  show_overview();
}

function show_overview() {
  current_id = null;
  $("#app").classList.remove("with-side");
  $("#side").hidden = true;
  $("#side-open").hidden = true;
  render_overview();
  window.scrollTo(0, overview_scroll);
}

function show_case(id) {
  if (current_id === null) overview_scroll = window.scrollY;
  current_id = id;
  last_opened_id = id;
  try_storage(() => localStorage.setItem("benchmark-review-current", id));
  $("#app").classList.add("with-side");
  $("#side").hidden = false;
  $("#side-open").hidden = false;
  render_case();
  window.scrollTo(0, 0);
  load_chat();
  render_glossary();
}

function step(delta) {
  const list = ordered_cases();
  const i = list.findIndex((c) => c.case_id === current_id);
  const next = list[i === -1 ? 0 : Math.min(list.length - 1, Math.max(0, i + delta))];
  if (next && next.case_id !== current_id) location.hash = `#/case/${encodeURIComponent(next.case_id)}`;
}

function jump_to(selector) {
  const target = $(selector);
  if (!target) return;
  if (target.tagName === "DETAILS") target.open = true;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ===== Glossary and explainers =====

function term_text(term) {
  const [type, key] = [term.slice(0, term.indexOf(":")), term.slice(term.indexOf(":") + 1)];
  const g = data.glossary;
  if (type === "kind") return { title: key, text: g.kinds[key] ?? "" };
  if (type === "diagnosis") { const d = g.diagnoses[key]; return { title: d?.title ?? key, text: d?.text ?? "No description." }; }
  if (type === "rule") { const r = g.rules[key]; return { title: r ? `${key}: ${r.title}` : key, text: r?.text ?? "No such rule in the snapshot." }; }
  return { title: key, text: "" };
}

function show_popover(anchor) {
  const { title, text } = term_text(anchor.dataset.term);
  const pop = $("#popover");
  pop.innerHTML = `<div class="title">${esc(title)}</div><div>${md(text)}</div>`;
  pop.hidden = false;
  const r = anchor.getBoundingClientRect();
  const left = Math.min(window.innerWidth - pop.offsetWidth - 12, Math.max(12, r.left));
  const below = r.bottom + 6 + pop.offsetHeight < window.innerHeight;
  pop.style.left = `${left}px`;
  pop.style.top = `${below ? r.bottom + 6 : r.top - pop.offsetHeight - 6}px`;
}

function render_glossary() {
  const g = data.glossary;
  const c = by_id(current_id);
  const dl = (entries, current) => `<dl>${entries.map(([k, t]) => `<dt class="${current.includes(k) ? "current" : ""}">${esc(k)}</dt><dd>${md(t)}</dd>`).join("")}</dl>`;
  const cited = c ? c.rules.filter((r) => r.cited).map((r) => r.group_id) : [];
  $("#tab-glossary").innerHTML = `<div class="gloss">
    <p class="meta">Terms that apply to the current case are highlighted.</p>
    <h4>Verdict kinds</h4>${dl(KINDS.map((k) => [k, g.kinds[k]]), c ? [c.label.kind] : [])}
    <h4>What counts as a caller</h4><p class="meta">${md(g.real_caller)}</p>
    <h4>Pitfalls</h4>${dl(g.pitfalls.map((p) => [p.title, p.text]), [])}
    <h4>Diagnosis routes</h4><p class="meta">How detection saw the entry's callers before any investigation.</p>${dl(Object.entries(g.diagnoses).map(([k, d]) => [k, `${d.title}: ${d.text}`]), c ? [c.diagnosis] : [])}
    <h4>Classifier rules</h4>${dl(Object.entries(g.rules).map(([k, r]) => [k, `${r.title}. ${r.text} (${r.languages.join(", ")})`]), cited)}
  </div>`;
}

function show_tab(name) {
  for (const b of $$(".side-tabs [data-tab]")) b.classList.toggle("on", b.dataset.tab === name);
  for (const t of $$(".tab")) t.classList.toggle("on", t.id === `tab-${name}`);
  try_storage(() => localStorage.setItem("benchmark-review-tab", name));
}

// ===== Claude =====

function draft_summary() {
  const c = by_id(current_id);
  const d = draft_for(current_id);
  const w = d.walkthrough;
  const vote = d.decision === "agree" ? `agrees with ${d.chosen.kind}${d.chosen.rule_id ? ` (rule ${d.chosen.rule_id})` : ""}`
    : d.decision === "none-fits" ? `says none fits: ${d.feedback?.problem ?? ""}` : "has not voted";
  return `walkthrough real_caller=${w.real_caller ?? "?"}, reaches_definition=${w.reaches_definition ?? "?"}, rule_covers=${w.rule_covers ?? "?"}; the reviewer ${vote}. Candidates: ${c.candidates.map((x) => x.key).join(", ")}.`;
}

function render_chat(transcript) {
  const log = $("#chat-log");
  log.innerHTML = transcript.turns.length === 0
    ? `<div class="chat-empty">Ask ${esc(data.chat_model)} about this case. It has read the case, sees your draft vote and any text you select on the page, and can read the ${esc(by_id(current_id)?.project ?? "")} source and Ariadne's own code. It never edits files.</div>`
    : transcript.turns.map((t) => t.role === "user"
      ? `<div class="bubble user">${esc(t.text)}</div>`
      : `<div class="bubble assistant">${t.tools.length ? `<div class="tools">${t.tools.map((x) => esc(x)).join("<br>")}</div>` : ""}${md(t.text)}</div>`).join("");
  log.scrollTop = log.scrollHeight;
  $("#chat-status").textContent = transcript.usd ? `session cost $${transcript.usd.toFixed(3)}` : "";
}

async function load_chat() {
  const id = current_id;
  const res = await fetch(`/api/chat/${encodeURIComponent(id)}`);
  if (id !== current_id) return;
  render_chat(await res.json());
}

async function send_chat(question) {
  if (streaming || !question.trim() || current_id === null) return;
  streaming = true;
  const id = current_id;
  $("#chat-send").disabled = true;
  $("#chat-input").value = "";
  $(".chat-empty")?.remove();
  const log = $("#chat-log");
  log.insertAdjacentHTML("beforeend", `<div class="bubble user">${esc(question)}</div><div class="bubble assistant"><div class="tools"></div><div class="text"></div></div>`);
  const bubble = log.lastElementChild;
  let text = "";
  $("#chat-status").textContent = "thinking…";
  try {
    const res = await fetch(`/api/chat/${encodeURIComponent(id)}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ question, draft: draft_summary(), selection }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let cut;
      while ((cut = buffer.indexOf("\n\n")) !== -1) {
        const line = buffer.slice(0, cut).replace(/^data: /, "");
        buffer = buffer.slice(cut + 2);
        const event = JSON.parse(line);
        if (id !== current_id) continue;
        if (event.type === "text") { text += event.text; $(".text", bubble).innerHTML = md(text); }
        if (event.type === "tool") { $(".tools", bubble).insertAdjacentHTML("beforeend", `${esc(event.name)} ${esc(event.detail)}<br>`); $("#chat-status").textContent = `reading: ${event.detail.slice(0, 60)}`; }
        if (event.type === "error") $(".text", bubble).insertAdjacentHTML("beforeend", `<div class="bad">${esc(event.message)}</div>`);
        if (event.type === "done") $("#chat-status").textContent = `answered · $${event.usd.toFixed(3)}`;
        log.scrollTop = log.scrollHeight;
      }
    }
  } catch (err) {
    $(".text", bubble).innerHTML = `<span class="bad">${esc(err.message)}</span>`;
    $("#chat-status").textContent = "";
  } finally {
    streaming = false;
    $("#chat-send").disabled = false;
  }
}

function set_selection(text) {
  selection = text.slice(0, 2000);
  $("#chat-selection").hidden = !selection;
  $("#chat-selection-text").textContent = selection;
}

// ===== Wiring =====

function wire() {
  window.addEventListener("hashchange", route);
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  const view = $("#view");
  view.addEventListener("click", (e) => {
    const t = e.target.closest("button, [data-term], tr[data-id], a");
    if (!t) return;
    if (t.dataset.term) { e.preventDefault(); show_popover(t); e.stopPropagation(); return; }
    if (t.tagName === "A") return;
    if (t.matches("tr[data-id]")) { location.hash = `#/case/${encodeURIComponent(t.dataset.id)}`; return; }
    if (t.dataset.filter) {
      filter = t.dataset.filter;
      try_storage(() => localStorage.setItem("benchmark-review-filter", filter));
      const y = window.scrollY;
      render_overview();
      window.scrollTo(0, y);
      return;
    }
    if (t.dataset.step) return step(Number(t.dataset.step));
    if (t.dataset.agree) return agree(t.dataset.agree);
    if (t.dataset.walk) {
      const draft = draft_for(current_id);
      draft.walkthrough[t.dataset.walk] = draft.walkthrough[t.dataset.walk] === t.dataset.answer ? null : t.dataset.answer;
      update_vote_ui();
      return schedule_save(current_id);
    }
    if (t.dataset.jump) return jump_to(t.dataset.jump);
    if (t.id === "fb-record") return record_none_fits();
    if (t.id === "clear-vote") return clear_vote();
    if (t.id === "next-case") return step(1);
  });
  view.addEventListener("toggle", (e) => {
    if (e.target.id === "intro") try_storage(() => localStorage.setItem("benchmark-review-intro", e.target.open ? "open" : "closed"));
  }, true);
  view.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.also) {
      const draft = draft_for(current_id);
      draft.also_acceptable = KINDS.filter((k) => (k === t.dataset.also ? t.checked : draft.also_acceptable.includes(k)));
      update_vote_ui();
      schedule_save(current_id);
    }
    if (t.id === "fb-target") update_vote_ui();
  });
  view.addEventListener("input", (e) => {
    if (e.target.id === "notes") { draft_for(current_id).notes = e.target.value; schedule_save(current_id, 600); }
  });
  view.addEventListener("mouseup", () => {
    if (current_id === null) return;
    const text = window.getSelection()?.toString().trim() ?? "";
    if (text) set_selection(text);
  });

  document.addEventListener("click", (e) => { if (!e.target.closest("#popover")) $("#popover").hidden = true; });
  window.addEventListener("scroll", () => { $("#popover").hidden = true; }, { passive: true });
  document.addEventListener("keydown", (e) => {
    const typing = e.target instanceof Element && e.target.matches("textarea, input, select");
    if (e.key === "Escape") {
      if (!$("#popover").hidden) { $("#popover").hidden = true; return; }
      if (current_id !== null && !typing) location.hash = "#/";
      return;
    }
    if (current_id === null || typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "j") step(1);
    else if (e.key === "k") step(-1);
    else if (/^[1-9]$/.test(e.key)) {
      const cand = by_id(current_id).candidates[Number(e.key) - 1];
      if (cand) agree(cand.key);
    }
  });

  for (const b of $$(".side-tabs [data-tab]")) b.addEventListener("click", () => show_tab(b.dataset.tab));
  $("#side-open").addEventListener("click", () => $("#side").classList.add("open"));
  $("#side-close").addEventListener("click", () => $("#side").classList.remove("open"));
  $("#chat-quick").innerHTML = QUICK_PROMPTS.map(([label], i) => `<button type="button" data-quick="${i}">${esc(label)}</button>`).join("");
  $("#chat-quick").addEventListener("click", (e) => {
    const b = e.target.closest("[data-quick]");
    if (b) send_chat(QUICK_PROMPTS[Number(b.dataset.quick)][1]);
  });
  $("#chat-send").addEventListener("click", () => send_chat($("#chat-input").value));
  $("#chat-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send_chat($("#chat-input").value); }
  });
  $("#chat-reset").addEventListener("click", async () => {
    if (streaming || current_id === null) return;
    const res = await fetch(`/api/chat/${encodeURIComponent(current_id)}`, { method: "DELETE" });
    render_chat(await res.json());
  });
  $("#chat-selection-clear").addEventListener("click", () => set_selection(""));
}

(async () => {
  const [cases_res, review_res] = await Promise.all([fetch("/api/cases"), fetch("/api/review")]);
  data = await cases_res.json();
  const review = await review_res.json();
  for (const [id, r] of Object.entries(review.reviews)) saved.set(id, r);
  filter = try_storage(() => localStorage.getItem("benchmark-review-filter"), null) ?? "needs-vote";
  last_opened_id = try_storage(() => localStorage.getItem("benchmark-review-current"), null);
  wire();
  show_tab(try_storage(() => localStorage.getItem("benchmark-review-tab"), null) ?? "chat");
  route();
})();

const view = document.querySelector("#token-view");
const slider = document.querySelector("#step-slider");
const speedSlider = document.querySelector("#speed-slider");
const stepLabel = document.querySelector("#step-label");
const remaskLabel = document.querySelector("#remask-label");
const baseAnswer = document.querySelector("#base-answer");
const guidedAnswer = document.querySelector("#guided-answer");
const goldAnswer = document.querySelector("#gold-answer");
const blockLabel = document.querySelector("#block-label");
const blockTrack = document.querySelector("#block-track");
const responsePanel = document.querySelector("#response-panel");
const responseTitle = document.querySelector("#response-title");
const responseText = document.querySelector("#response-text");
const showProblemButton = document.querySelector("#show-problem");
const showBaseResponseButton = document.querySelector("#show-base-response");
const showGuidedResponseButton = document.querySelector("#show-guided-response");
const closeResponseButton = document.querySelector("#close-response");
const changeSummary = document.querySelector("#change-summary");
const changeTableBody = document.querySelector("#change-table-body");
const modeButtons = [...document.querySelectorAll(".mode-tab")];
const prevButton = document.querySelector("#prev-step");
const nextButton = document.querySelector("#next-step");
const playButton = document.querySelector("#play-pause");
const nextRemaskButton = document.querySelector("#next-remask");
const levelSelect = document.querySelector("#level-select");
const visibleOnly = document.querySelector("#visible-only");
const fullscreenButton = document.querySelector("#fullscreen");

let trace = null;
let index = 0;
let timer = null;
let blockStats = [];
let viewMode = "guided";

function mathText(value) {
  return String(value ?? "--").replaceAll("\\\\", "\\").trim() || "--";
}

function frameHasRemask(frame) {
  return Array.isArray(frame.critic_remask) && frame.critic_remask.length > 0;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function shortToken(value) {
  const text = String(value ?? "").replace(/\s+/g, " ");
  return text.length > 18 ? `${text.slice(0, 17)}…` : text || "∅";
}

function prepareFrame(frame) {
  const rawCriticRemask = Array.isArray(frame.critic_remask) ? [...frame.critic_remask] : [];
  return {
    ...frame,
    actorSet: new Set(frame.actor_unmask || []),
    originalCriticRemask: rawCriticRemask,
    critic_remask: rawCriticRemask,
    criticSet: new Set(rawCriticRemask),
    effectiveChanges: [],
    effectiveSet: new Set(),
    cumulativeRemask: 0,
    cumulativeEffective: 0,
  };
}

function normalizeFrames(frames) {
  return (frames || []).map((frame) => prepareFrame(frame));
}

function annotateEffectiveChanges(frames) {
  const changes = [];
  let cumulativeRemask = 0;
  let cumulativeEffective = 0;

  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    const frame = frames[frameIndex];
    const previous = frameIndex > 0 ? frames[frameIndex - 1] : null;
    const localChanges = [];
    cumulativeRemask += frame.critic_remask?.length || 0;

    for (const position of frame.critic_remask || []) {
      const before = previous?.tokens?.[position] ?? "";
      const after = frame.tokens?.[position] ?? "";
      if (before === after) continue;
      const record = {
        frameIndex,
        stepNumber: Number(frame.step_number ?? frameIndex + 1),
        blockIndex: Number(frame.block_index ?? 0),
        stepIndex: Number(frame.step_index ?? 0),
        position,
        before,
        after,
      };
      localChanges.push(record);
      changes.push(record);
    }

    frame.effectiveChanges = localChanges;
    frame.effectiveSet = new Set(localChanges.map((item) => item.position));
    cumulativeEffective += localChanges.length;
    frame.cumulativeRemask = cumulativeRemask;
    frame.cumulativeEffective = cumulativeEffective;
  }

  return changes;
}

function activeFrames() {
  if (!trace) return [];
  if (viewMode === "base") return trace.baseFrames.length ? trace.baseFrames : trace.fallbackBaseFrames;
  return trace.frames;
}

function finalTokenDifferent(position) {
  const base = trace?.base_tokens?.[position] ?? "";
  const guided = trace?.guided_tokens?.[position] ?? "";
  return base !== guided;
}

function tokenClass(position, frame, visible) {
  const classes = ["token"];
  const remasked = frame.criticSet.has(position);
  const effective = frame.effectiveSet?.has(position);
  if (!visible || (remasked && !effective)) classes.push("mask");
  if (frame.actorSet.has(position) && !remasked) classes.push("actor");
  if (remasked) classes.push("critic", "remask");
  if (effective) classes.push("effective");
  if (viewMode === "diff" && finalTokenDifferent(position)) classes.push("changed");
  return classes.join(" ");
}

function tokenText(token, visible, remasked, effective) {
  if (!visible || (remasked && !effective)) return "[MASK]";
  return token || "";
}

function renderAnswers() {
  baseAnswer.textContent = `base ${mathText(trace.base_extracted)}`;
  guidedAnswer.textContent = `guided ${mathText(trace.guided_extracted)}`;
  goldAnswer.textContent = `gold ${mathText(trace.gold_extracted)}`;
  guidedAnswer.classList.toggle(
    "correct",
    mathText(trace.guided_extracted) === mathText(trace.gold_extracted),
  );
  baseAnswer.classList.toggle(
    "correct",
    mathText(trace.base_extracted) === mathText(trace.gold_extracted),
  );
  const baseMode = modeButtons.find((button) => button.dataset.mode === "base");
  const guidedMode = modeButtons.find((button) => button.dataset.mode === "guided");
  const diffMode = modeButtons.find((button) => button.dataset.mode === "diff");
  if (baseMode) baseMode.title = `Base trajectory: ${trace.num_base_frames || trace.baseFrames?.length || 0} steps, no critic remask`;
  if (guidedMode) {
    guidedMode.title = `Guided trajectory: ${trace.num_frames || trace.frames?.length || 0} steps, ${trace.filteredRemaskCount || 0} critic remasks`;
  }
  if (diffMode) diffMode.title = "Guided trajectory with final-token differences from base highlighted";
}

function showResponse(kind) {
  if (!trace) return;
  const isBase = kind === "base";
  const label = isBase ? "base response" : "guided response";
  const extracted = isBase ? trace.base_extracted : trace.guided_extracted;
  const response = isBase ? trace.base_response : trace.guided_response;
  responseTitle.textContent = `${label} · answer ${mathText(extracted)}`;
  responseText.classList.remove("math-problem");
  responseText.textContent = String(response || "").trim() || "--";
  responsePanel.hidden = false;
}

function typesetPanel() {
  if (window.MathJax?.typesetPromise) {
    window.MathJax.typesetPromise([responseText]).catch(() => {});
  }
}

function showProblem() {
  if (!trace) return;
  const level = trace.level ? `L${String(trace.level).match(/\d+/)?.[0] || trace.level}` : "L--";
  responseTitle.textContent = `${level} problem`;
  responseText.classList.add("math-problem");
  responseText.innerHTML = escapeHtml(trace.problem || "--").replaceAll("\n", "<br>");
  responsePanel.hidden = false;
  typesetPanel();
}

function closeResponse() {
  responsePanel.hidden = true;
}

function renderEffectiveChanges() {
  if (!trace) return;
  const changes = trace.effectiveChanges || [];
  changeSummary.textContent = `eff change ${changes.length} / remask ${trace.filteredRemaskCount ?? "--"}`;

  if (changes.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.textContent = "no changed remask tokens";
    row.appendChild(cell);
    changeTableBody.replaceChildren(row);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const item of changes) {
    const row = document.createElement("tr");

    const stepCell = document.createElement("td");
    const jump = document.createElement("button");
    jump.type = "button";
    jump.textContent = `B${item.blockIndex + 1}.${item.stepIndex + 1}`;
    jump.title = `Jump to step ${item.stepNumber}`;
    jump.addEventListener("click", () => {
      stop();
      setMode("guided");
      goTo(item.frameIndex);
    });
    stepCell.appendChild(jump);

    const posCell = document.createElement("td");
    posCell.textContent = String(item.position);

    const beforeCell = document.createElement("td");
    beforeCell.textContent = shortToken(item.before);
    beforeCell.title = String(item.before || "");

    const afterCell = document.createElement("td");
    afterCell.className = "after";
    afterCell.textContent = shortToken(item.after);
    afterCell.title = String(item.after || "");

    row.append(stepCell, posCell, beforeCell, afterCell);
    fragment.appendChild(row);
  }

  changeTableBody.replaceChildren(fragment);
}

function buildBlockStats(frames) {
  const stats = new Map();
  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    const frame = frames[frameIndex];
    const blockIndex = Number(frame.block_index ?? 0);
    if (!stats.has(blockIndex)) {
      stats.set(blockIndex, {
        blockIndex,
        firstFrame: frameIndex,
        lastFrame: frameIndex,
        stepCount: 0,
        remaskCount: 0,
      });
    }
    const item = stats.get(blockIndex);
    item.lastFrame = frameIndex;
    item.stepCount += 1;
    item.remaskCount += frame.critic_remask?.length || 0;
  }
  return [...stats.values()].sort((a, b) => a.blockIndex - b.blockIndex);
}

function renderBlockTrack() {
  if (!trace) return;
  const frames = activeFrames();
  const frame = frames[index];
  if (!frame) return;
  const activeBlock = Number(frame.block_index ?? 0);
  const maxRemask = Math.max(1, ...blockStats.map((item) => item.remaskCount));
  const fragment = document.createDocumentFragment();

  for (const item of blockStats) {
    const button = document.createElement("button");
    const density = item.remaskCount / maxRemask;
    button.type = "button";
    button.className = "block-chip";
    button.dataset.block = String(item.blockIndex);
    button.style.setProperty("--remask-density", density.toFixed(3));
    button.textContent = String(item.blockIndex + 1);
    button.title = `Block ${item.blockIndex + 1}: steps ${item.firstFrame + 1}-${item.lastFrame + 1}, remask ${item.remaskCount}`;
    button.setAttribute("aria-label", button.title);
    if (item.blockIndex === activeBlock) button.classList.add("active");
    button.addEventListener("click", () => {
      stop();
      goTo(item.firstFrame);
    });
    fragment.appendChild(button);
  }

  blockTrack.replaceChildren(fragment);
}

function renderBlockLabel(frame) {
  const block = Number(frame.block_index ?? 0);
  const local = Number(frame.step_index ?? 0);
  const item = blockStats.find((candidate) => candidate.blockIndex === block);
  const totalLocal = item?.stepCount || 16;
  const remask = item?.remaskCount ?? 0;
  blockLabel.textContent = `block ${block + 1} · ${local + 1}/${totalLocal} · ${remask} remask`;
}

function renderTokens(frame) {
  const fragment = document.createDocumentFragment();
  const compact = visibleOnly.checked;

  for (let position = 0; position < frame.tokens.length; position += 1) {
    const visible = Boolean(frame.visible[position]);
    const remasked = frame.criticSet.has(position);
    if (compact && !visible && !remasked) continue;

    const span = document.createElement("span");
    const effective = frame.effectiveSet?.has(position);
    span.className = tokenClass(position, frame, visible);
    span.textContent = tokenText(frame.tokens[position], visible, remasked, effective);
    if (effective) {
      const change = frame.effectiveChanges.find((item) => item.position === position);
      span.title = `changed after remask: ${shortToken(change?.before)} → ${shortToken(change?.after)}`;
    }
    fragment.appendChild(span);
  }

  view.replaceChildren(fragment);
}

function render() {
  const frames = activeFrames();
  if (!trace || frames.length === 0) return;

  const frame = frames[index];
  renderTokens(frame);

  const total = frames.length;
  const current = index + 1;
  const level = trace.level ? `L${String(trace.level).match(/\d+/)?.[0] || trace.level}` : "L--";
  const localRemask = frame.critic_remask?.length || 0;
  const localEffective = frame.effectiveChanges?.length || 0;

  stepLabel.textContent = `${level} ${viewMode} ${current} / ${total}`;
  if (viewMode === "base") {
    remaskLabel.textContent = "remask --";
    remaskLabel.title = "Base trajectory has no critic remask.";
  } else {
    remaskLabel.textContent = `remask ${frame.cumulativeRemask ?? 0}/${trace.filteredRemaskCount ?? "--"} · eff ${frame.cumulativeEffective ?? 0}/${trace.effectiveChangeCount ?? 0}`;
    remaskLabel.title = `This step: remask ${localRemask}, effective change ${localEffective}.`;
  }
  slider.value = String(index);
  const progress = total > 1 ? (index / (total - 1)) * 100 : 0;
  slider.style.setProperty("--progress", `${progress.toFixed(3)}%`);
  renderBlockLabel(frame);
  renderBlockTrack();
  playButton.textContent = timer ? "Ⅱ" : "▶";
  playButton.setAttribute("aria-label", timer ? "Pause" : "Play");
}

function stop() {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
  render();
}

function pauseWithoutRender() {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
}

function goTo(nextIndex) {
  const frames = activeFrames();
  if (!trace || frames.length === 0) return;
  index = Math.max(0, Math.min(frames.length - 1, nextIndex));
  render();
}

function step(delta) {
  goTo(index + delta);
}

function tick() {
  if (!trace) return;
  const frames = activeFrames();
  if (index >= frames.length - 1) {
    stop();
    return;
  }
  step(1);
}

function play() {
  if (!trace || activeFrames().length === 0) return;
  if (timer !== null) {
    stop();
    return;
  }
  if (index >= activeFrames().length - 1) goTo(0);
  timer = window.setInterval(tick, Number(speedSlider.value));
  render();
}

function nextRemask() {
  if (!trace) return;
  const frames = activeFrames();
  for (let i = index + 1; i < frames.length; i += 1) {
    if (frameHasRemask(frames[i])) {
      goTo(i);
      return;
    }
  }
  for (let i = 0; i <= index; i += 1) {
    if (frameHasRemask(frames[i])) {
      goTo(i);
      return;
    }
  }
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}`);
  return response.json();
}

function buildFallbackBaseFrames(baseTokens, guidedFrames) {
  if (!Array.isArray(baseTokens) || !Array.isArray(guidedFrames)) return [];
  return guidedFrames.map((frame) => ({
    ...frame,
    tokens: baseTokens,
    actorSet: new Set(),
    critic_remask: [],
    criticSet: new Set(),
    effectiveChanges: [],
    effectiveSet: new Set(),
    cumulativeRemask: 0,
    cumulativeEffective: 0,
  }));
}

function setMode(mode) {
  viewMode = mode;
  modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
  const frames = activeFrames();
  index = Math.min(index, Math.max(0, frames.length - 1));
  blockStats = buildBlockStats(frames);
  render();
}

function loadTraceData(data) {
  const normalizedFrames = normalizeFrames(data.frames);
  const normalizedBaseFrames = normalizeFrames(data.base_frames);
  const effectiveChanges = annotateEffectiveChanges(normalizedFrames);
  trace = {
    ...data,
    rawRemaskCount: Number(data.remask_count || 0),
    frames: normalizedFrames,
    baseFrames: normalizedBaseFrames,
    fallbackBaseFrames: [],
    effectiveChanges,
    effectiveChangeCount: effectiveChanges.length,
  };
  trace.filteredRemaskCount = trace.frames.reduce(
    (total, frame) => total + (frame.critic_remask?.length || 0),
    0,
  );
  trace.fallbackBaseFrames = buildFallbackBaseFrames(trace.base_tokens, trace.frames);
  blockStats = buildBlockStats(activeFrames());
  index = 0;
  slider.max = String(Math.max(0, activeFrames().length - 1));
  renderAnswers();
  renderEffectiveChanges();
  render();
}

async function loadTrace(path) {
  stop();
  closeResponse();
  view.innerHTML = '<span class="loading">Loading trace...</span>';
  loadTraceData(await fetchJson(path));
}

function caseLabel(item) {
  const level = item.level_int ?? item.level ?? "";
  const kind = String(item.selection_kind || "").replaceAll("_", " ");
  return `Level ${String(level).match(/\d+/)?.[0] || level}${kind ? ` · ${kind}` : ""}`;
}

async function setupLevels() {
  const manifest = await fetchJson("assets/manifest.json");
  const cases = [...(manifest.cases || [])].sort((a, b) => Number(a.level_int) - Number(b.level_int));

  levelSelect.replaceChildren();
  for (const item of cases) {
    const option = document.createElement("option");
    option.value = item.trace_path;
    option.textContent = caseLabel(item);
    option.selected = Number(item.level_int) === Number(manifest.default_level);
    levelSelect.appendChild(option);
  }

  await loadTrace(levelSelect.value || "assets/trace.json");
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen?.();
  }
}

prevButton.addEventListener("click", () => {
  stop();
  step(-1);
});

nextButton.addEventListener("click", () => {
  stop();
  step(1);
});

playButton.addEventListener("click", play);

nextRemaskButton.addEventListener("click", () => {
  stop();
  nextRemask();
});

showProblemButton.addEventListener("click", showProblem);

showBaseResponseButton.addEventListener("click", () => showResponse("base"));

showGuidedResponseButton.addEventListener("click", () => showResponse("guided"));

closeResponseButton.addEventListener("click", closeResponse);

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    stop();
    setMode(button.dataset.mode || "guided");
    slider.max = String(Math.max(0, activeFrames().length - 1));
  });
});

slider.addEventListener("pointerdown", pauseWithoutRender);

slider.addEventListener("input", (event) => {
  const nextIndex = Number(event.target.value);
  pauseWithoutRender();
  goTo(nextIndex);
});

slider.addEventListener("change", (event) => {
  const nextIndex = Number(event.target.value);
  pauseWithoutRender();
  goTo(nextIndex);
});

speedSlider.addEventListener("input", () => {
  if (timer !== null) {
    stop();
    play();
  }
});

visibleOnly.addEventListener("change", render);

levelSelect.addEventListener("change", async (event) => {
  await loadTrace(event.target.value);
});

fullscreenButton.addEventListener("click", toggleFullscreen);

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") prevButton.click();
  if (event.key === "ArrowRight") nextButton.click();
  if (event.key.toLowerCase() === "r") nextRemaskButton.click();
  if (event.key.toLowerCase() === "f") fullscreenButton.click();
  if (event.key === "Escape") closeResponse();
  if (event.key === " ") {
    event.preventDefault();
    play();
  }
});

setupLevels().catch(async (error) => {
  try {
    await loadTrace("assets/trace.json");
  } catch (fallbackError) {
    const localFileHint =
      window.location.protocol === "file:"
        ? " Open this demo through an HTTP server, not by double-clicking index.html. Run: python -m http.server 8000 -d Paper/demo"
        : "";
    view.textContent = `Missing trace: ${error.message || fallbackError.message}.${localFileHint}`;
  }
});

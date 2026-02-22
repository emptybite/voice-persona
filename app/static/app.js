const state = {
  profiles: [],
  selectedProfileId: null,
  sessions: [],
  voices: [],
  voiceNames: {},
  ttsModels: [],
  selectedTtsModel: "",
  lastAssistantText: "",
  rec: { active: false, recorder: null, stream: null },
  ptt: { spaceActive: false },
};

const $ = (id) => document.getElementById(id);
const setStatus = (t) => ($("status").textContent = t);
const sid = () => `web-${Math.random().toString(16).slice(2, 10)}`;
const now = () => new Date().toISOString();
const fmt = (ts) => (ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");
async function api(path, opts = {}) {
  const r = await fetch(path, opts);
  if (r.ok) return r;
  let detail = `${r.status} ${r.statusText}`;
  try {
    const p = await r.json();
    if (p?.detail) detail += ` - ${p.detail}`;
  } catch (_) {}
  throw new Error(detail);
}

function uniq(items) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    const v = String(item || "").trim();
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

function validVoiceId(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  const lowered = v.toLowerCase();
  if (lowered === "default" || lowered === "alloy" || lowered === "no voices loaded") return "";
  return v;
}

function applyVoiceItems(voiceItems) {
  for (const item of voiceItems || []) {
    const id = String(item?.voice_id || "").trim();
    const name = String(item?.name || "").trim();
    if (id) state.voiceNames[id] = name || id;
  }
}

function voiceLabel(id) {
  const clean = String(id || "").trim();
  if (!clean) return "";
  const name = String(state.voiceNames[clean] || "").trim();
  if (!name || name === clean) return clean;
  return `${name} (${clean})`;
}

function setVoiceOptions(voices, keep, voiceItems = []) {
  applyVoiceItems(voiceItems);
  const cur = validVoiceId(keep || $("profile-voice").value || "");
  const fallback = cur ? [cur] : [];
  const list = uniq([...(voices || state.voices), ...fallback]);
  state.voices = list;
  $("profile-voice").innerHTML = "";
  if (!list.length) {
    const o = document.createElement("option");
    o.value = "";
    o.textContent = "No voices loaded";
    $("profile-voice").appendChild(o);
    return;
  }
  for (const v of list) {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = voiceLabel(v);
    $("profile-voice").appendChild(o);
  }
  $("profile-voice").value = list.includes(cur) ? cur : list[0];
}

function renderTtsModels() {
  const sel = $("tts-model-select");
  sel.innerHTML = "";
  const models = state.ttsModels.length ? state.ttsModels : ["default"];
  if (!state.selectedTtsModel && models[0] !== "default") state.selectedTtsModel = models[0];
  for (const m of models) {
    const o = document.createElement("option");
    o.value = m === "default" ? "" : m;
    o.textContent = m;
    sel.appendChild(o);
  }
  sel.value = state.selectedTtsModel;
}

async function loadTtsModels() {
  const r = await api("/v1/tts/models");
  const p = await r.json();
  state.ttsModels = uniq(p.models || []);
  if (p.default_model && !state.ttsModels.includes(p.default_model)) state.ttsModels.unshift(p.default_model);
  if (!state.selectedTtsModel) state.selectedTtsModel = p.default_model || "";
  renderTtsModels();
}

async function loadVoices() {
  const q = state.selectedTtsModel ? `?model=${encodeURIComponent(state.selectedTtsModel)}` : "";
  const r = await api(`/v1/voices${q}`);
  const p = await r.json();
  const prof = state.profiles.find((x) => x.id === state.selectedProfileId);
  setVoiceOptions(p.voices || [], prof?.voice?.voice || p.default_voice || null, p.voice_items || []);
  setStatus(`Voices loaded (${(p.voices || []).length}).`);
}

function fillProfile(profile) {
  $("profile-id").value = profile?.id || "";
  $("profile-name").value = profile?.name || "";
  $("profile-prompt").value = profile?.system_prompt || "";
  $("profile-tone").value = profile?.voice?.tone_prompt || "";
  $("profile-language").value = profile?.voice?.language || "Auto";
  $("profile-speed").value = String(profile?.voice?.speed ?? 1.0);
  setVoiceOptions(state.voices, profile?.voice?.voice || null);
}

function renderProfiles() {
  $("profiles").innerHTML = "";
  for (const p of state.profiles) {
    const d = document.createElement("div");
    d.className = `item ${p.id === state.selectedProfileId ? "active" : ""}`;
    d.innerHTML = `<strong>${p.name}</strong><span class="meta">${voiceLabel(p.voice.voice)}</span>`;
    d.onclick = () => selectProfile(p.id).catch((e) => setStatus(`Select failed: ${e.message}`));
    $("profiles").appendChild(d);
  }
}

function renderSessions() {
  const active = $("session-id").value.trim();
  $("sessions").innerHTML = "";
  for (const s of state.sessions) {
    const d = document.createElement("div");
    d.className = `item ${s.session_id === active ? "active" : ""}`;
    const t = s.updated_at ? new Date(s.updated_at).toLocaleString() : "no activity";
    d.innerHTML = `<strong>${s.session_id}</strong><span class="meta">${s.message_count} msgs | ${t}</span>`;
    d.onclick = async () => {
      $("session-id").value = s.session_id;
      await loadHistory();
    };
    $("sessions").appendChild(d);
  }
}

function addMsg(role, text, ts = null) {
  const row = document.createElement("div");
  row.className = `msg-row ${role}`;
  const b = document.createElement("div");
  b.className = `msg ${role}`;
  b.textContent = text;
  const t = fmt(ts);
  if (t) {
    const s = document.createElement("span");
    s.className = "msg-time";
    s.textContent = t;
    b.appendChild(s);
  }
  row.appendChild(b);
  $("chat-log").appendChild(row);
  $("chat-log").scrollTop = $("chat-log").scrollHeight;
}

function renderHistory(messages) {
  $("chat-log").innerHTML = "";
  for (const m of messages) addMsg(m.role, m.content, m.timestamp || null);
  const a = messages.filter((m) => m.role === "assistant");
  state.lastAssistantText = a.length ? a[a.length - 1].content : "";
}

async function loadProfiles() {
  const r = await api("/v1/profiles");
  state.profiles = await r.json();
  state.profiles.sort((a, b) => {
    if ((a.name || "").toLowerCase() === "main") return -1;
    if ((b.name || "").toLowerCase() === "main") return 1;
    return 0;
  });
  renderProfiles();
  if (!state.selectedProfileId && state.profiles.length) await selectProfile(state.profiles[0].id);
}

async function selectProfile(id) {
  const p = state.profiles.find((x) => x.id === id);
  if (!p) return;
  state.selectedProfileId = id;
  fillProfile(p);
  renderProfiles();
  await loadSessions();
  if (!$("session-id").value.trim()) $("session-id").value = sid();
  setStatus(`Selected ${p.name}.`);
}

async function loadSessions() {
  if (!state.selectedProfileId) return;
  const r = await api(`/v1/profiles/${encodeURIComponent(state.selectedProfileId)}/sessions`);
  state.sessions = await r.json();
  renderSessions();
}

async function loadHistory() {
  if (!state.selectedProfileId) return setStatus("Pick a profile first.");
  const s = $("session-id").value.trim();
  if (!s) return setStatus("Set a session id.");
  const r = await api(`/v1/profiles/${encodeURIComponent(state.selectedProfileId)}/sessions/${encodeURIComponent(s)}/messages?limit=200`);
  const msgs = await r.json();
  renderHistory(msgs);
  renderSessions();
  setStatus(`Loaded ${msgs.length} messages.`);
}

async function deleteCurrentProfile() {
  if (!state.selectedProfileId) return setStatus("Pick a profile first.");
  const profile = state.profiles.find((x) => x.id === state.selectedProfileId);
  const name = profile?.name || state.selectedProfileId;
  if (!confirm(`Delete profile '${name}' and all its sessions?`)) return;
  await api(`/v1/profiles/${encodeURIComponent(state.selectedProfileId)}`, { method: "DELETE" });
  state.selectedProfileId = null;
  $("chat-log").innerHTML = "";
  await loadProfiles();
  setStatus(`Deleted profile '${name}'.`);
}

async function keepOnlyCurrentProfile() {
  if (!state.selectedProfileId) return setStatus("Pick a profile first.");
  const profile = state.profiles.find((x) => x.id === state.selectedProfileId);
  const name = profile?.name || state.selectedProfileId;
  if (!confirm(`Keep only '${name}' and delete all other profiles + memories?`)) return;
  const r = await api("/v1/profiles/cleanup?keep_profile_id=" + encodeURIComponent(state.selectedProfileId), {
    method: "POST",
  });
  const p = await r.json();
  await loadProfiles();
  await loadSessions();
  setStatus(`Cleanup done. Removed ${p.profiles_removed} profiles.`);
}

async function deleteCurrentSession() {
  if (!state.selectedProfileId) return setStatus("Pick a profile first.");
  const sessionId = $("session-id").value.trim();
  if (!sessionId) return setStatus("Set a session id.");
  if (!confirm(`Delete session '${sessionId}'?`)) return;
  await api(
    `/v1/profiles/${encodeURIComponent(state.selectedProfileId)}/sessions/${encodeURIComponent(sessionId)}`,
    { method: "DELETE" },
  );
  $("chat-log").innerHTML = "";
  state.lastAssistantText = "";
  await loadSessions();
  setStatus(`Deleted session '${sessionId}'.`);
}

async function saveProfile(ev) {
  ev.preventDefault();
  const payload = {
    id: $("profile-id").value || null,
    name: $("profile-name").value.trim(),
    system_prompt: $("profile-prompt").value.trim(),
    voice: {
      voice: validVoiceId($("profile-voice").value),
      tone_prompt: $("profile-tone").value.trim() || "Speak clearly and naturally.",
      language: $("profile-language").value.trim() || "Auto",
      speed: Number($("profile-speed").value || "1.0"),
    },
  };
  if (!payload.name || !payload.system_prompt) return setStatus("Name and system prompt are required.");
  const r = await api("/v1/profiles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const p = await r.json();
  state.selectedProfileId = p.id;
  await loadProfiles();
  setStatus(`Saved ${p.name}.`);
}

async function sendChatText(text, clearComposer = false, autoSpeak = false) {
  if (!state.selectedProfileId) return setStatus("Pick a profile first.");
  const s = $("session-id").value.trim();
  const t = String(text || "").trim();
  if (!s || !t) return setStatus("Session id and message are required.");
  addMsg("user", t, now());
  if (clearComposer) $("user-message").value = "";
  setStatus("Waiting for chat response...");
  const r = await api("/v1/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile_id: state.selectedProfileId, session_id: s, user_message: t, temperature: 0.3 }),
  });
  const p = await r.json();
  state.lastAssistantText = String(p.assistant_message || "");
  addMsg("assistant", state.lastAssistantText, now());
  await loadSessions();
  setStatus("Chat response received.");
  if (autoSpeak && $("auto-speak").checked && state.lastAssistantText.trim()) await speakText(state.lastAssistantText.trim());
}

async function sendComposer() {
  await sendChatText($("user-message").value, true, false);
}

function b64(b) {
  const bin = atob(b);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) u[i] = bin.charCodeAt(i);
  return u;
}

function wsUrl(path) {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}${path}`;
}

function compactForUi(value, depth = 0) {
  if (depth > 6) return "[truncated depth]";
  if (Array.isArray(value)) return value.map((v) => compactForUi(v, depth + 1));
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && value.length > 900) return `${value.slice(0, 220)}... [truncated ${value.length - 220} chars]`;
    return value;
  }
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const key = String(k || "").toLowerCase();
    if (typeof v === "string" && (key.includes("audio_base_64") || key.endsWith("_base64") || key.endsWith("_b64"))) {
      out[k] = `[base64 omitted, length=${v.length}]`;
      continue;
    }
    out[k] = compactForUi(v, depth + 1);
  }
  return out;
}

function renderJsonOutput(id, payload) {
  const el = $(id);
  if (!el) return;
  el.textContent = JSON.stringify(compactForUi(payload), null, 2);
}

async function speakHttp(text) {
  const r = await api("/v1/audio/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profile_id: state.selectedProfileId,
      text,
      format: "mp3",
      tts_model: state.selectedTtsModel || null,
      voice_id: validVoiceId($("profile-voice").value) || null,
    }),
  });
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  $("audio-player").src = url;
  await $("audio-player").play();
}

async function speakStream(text) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl("/ws/tts"));
    const chunks = [];
    let mime = "audio/mpeg";
    let progressive = null;

    function createProgressivePlayer(selectedMime) {
      if (!window.MediaSource || !MediaSource.isTypeSupported(selectedMime)) return null;
      const mediaSource = new MediaSource();
      const audioEl = $("audio-player");
      const url = URL.createObjectURL(mediaSource);
      const queue = [];
      let sourceBuffer = null;
      let ended = false;
      let started = false;

      const flush = () => {
        if (!sourceBuffer || sourceBuffer.updating) return;
        if (queue.length) {
          sourceBuffer.appendBuffer(queue.shift());
          if (!started) {
            started = true;
            audioEl.play().catch(() => {});
          }
          return;
        }
        if (ended && mediaSource.readyState === "open") {
          try {
            mediaSource.endOfStream();
          } catch (_) {}
        }
      };

      mediaSource.addEventListener("sourceopen", () => {
        try {
          sourceBuffer = mediaSource.addSourceBuffer(selectedMime);
          sourceBuffer.mode = "sequence";
          sourceBuffer.addEventListener("updateend", flush);
          flush();
        } catch (_) {
          // If SourceBuffer init fails, we fall back to buffered playback below.
        }
      });

      audioEl.src = url;
      audioEl.onended = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      audioEl.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Audio playback failed."));
      };

      return {
        push: (u8) => {
          queue.push(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength));
          flush();
        },
        done: () => {
          ended = true;
          flush();
        },
      };
    }

    ws.onopen = () => ws.send(JSON.stringify({
      profile_id: state.selectedProfileId,
      text,
      tts_model: state.selectedTtsModel || null,
      voice_id: validVoiceId($("profile-voice").value) || null,
    }));
    ws.onmessage = async (ev) => {
      const p = JSON.parse(ev.data);
      if (p.type === "start") {
        mime = p.mime || "audio/mpeg";
        progressive = createProgressivePlayer(mime);
      } else if (p.type === "audio_chunk") {
        const data = b64(p.audio_b64 || "");
        if (progressive) {
          progressive.push(data);
        } else {
          chunks.push(data);
        }
        setStatus(`Streaming ${Number(p.index ?? chunks.length) + 1} chunks...`);
      } else if (p.type === "done") {
        try {
          if (progressive) {
            progressive.done();
            ws.close();
            return;
          }
          if (!chunks.length) throw new Error("No streamed audio received.");
          const totalBytes = chunks.reduce((sum, item) => sum + item.length, 0);
          const merged = new Uint8Array(totalBytes);
          let offset = 0;
          for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
          }
          await play(new Blob([merged], { type: mime }));
          resolve();
        } catch (e) {
          reject(e);
        } finally {
          if (!progressive) ws.close();
        }
      } else if (p.type === "error") {
        reject(new Error(p.detail || "TTS stream error"));
        ws.close();
      }
    };
    ws.onerror = () => reject(new Error("WebSocket connection failed."));
  });
}

async function speakText(text) {
  if (!state.selectedProfileId) return setStatus("Pick a profile first.");
  if (!text.trim()) return setStatus("No text to speak.");
  setStatus("Generating speech...");
  if ($("use-stream-tts").checked) {
    try {
      await speakStream(text);
      setStatus("Played streamed TTS.");
      return;
    } catch (e) {
      setStatus(`Stream failed (${e.message}). Falling back...`);
    }
  }
  await speakHttp(text);
  setStatus("Played TTS.");
}

async function speakLast() {
  await speakText(state.lastAssistantText.trim());
}

async function runSttFile() {
  const f = $("stt-file").files?.[0];
  if (!f) return setStatus("Choose an audio file first.");
  const form = new FormData();
  form.append("file", f, f.name || "audio.wav");
  setStatus("Transcribing audio...");
  const r = await api("/v1/audio/transcribe", { method: "POST", body: form });
  const p = await r.json();
  $("stt-output").textContent = p.text || "";
  $("user-message").value = p.text || "";
  setStatus("Transcription ready.");
}

async function cloneVoice() {
  const name = $("clone-name").value.trim();
  if (!name) return setStatus("Voice clone name is required.");
  const files = Array.from($("clone-files").files || []);
  if (!files.length) return setStatus("Select at least one sample file.");
  const form = new FormData();
  form.append("name", name);
  form.append("description", $("clone-description").value.trim());
  for (const file of files) form.append("files", file, file.name);
  const r = await api("/v1/elevenlabs/voices/clone", { method: "POST", body: form });
  const p = await r.json();
  renderJsonOutput("voice-lab-output", p);
  await loadVoices();
  setStatus("Voice clone created.");
}

async function designVoice() {
  const text = $("design-text").value.trim();
  if (text.length < 100) {
    return setStatus(`Design prompt too short (${text.length}/100).`);
  }
  const payload = {
    text,
    voice_description: text,
    gender: $("design-gender").value,
    accent: $("design-accent").value.trim() || "american",
    age: $("design-age").value,
    accent_strength: Number($("design-strength").value || "0.35"),
  };
  const r = await api("/v1/elevenlabs/voices/design", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const p = await r.json();
  renderJsonOutput("voice-lab-output", p);
  const previewGenerated = Array.isArray(p.previews)
    ? String((p.previews.find((x) => x && x.generated_voice_id)?.generated_voice_id) || "").trim()
    : "";
  const generated = String(p.generated_voice_id || p.voice_id || previewGenerated || "").trim();
  if (generated) $("design-generated-id").value = generated;
  setStatus("Voice design generated.");
}

async function saveDesignedVoice() {
  const saveName = $("design-save-name").value.trim();
  const generatedId = $("design-generated-id").value.trim();
  const fallbackDescription = $("design-text").value.trim();
  const saveDescription = $("design-save-description").value.trim() || fallbackDescription;
  const payload = {
    voice_name: saveName,
    voice_description: saveDescription,
    generated_voice_id: generatedId,
  };
  if (!payload.voice_name || !payload.generated_voice_id) {
    return setStatus("Save name and generated voice id are required.");
  }
  if (payload.voice_description.length < 20) {
    return setStatus("Save description must be at least 20 characters (or provide a longer design prompt).");
  }
  const r = await api("/v1/elevenlabs/voices/create-from-design", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const p = await r.json();
  renderJsonOutput("voice-lab-output", p);
  await loadVoices();
  setStatus("Designed voice saved.");
}

function micSupported() {
  return Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";
}

function syncTalkBtn() {
  const b = $("talk-toggle");
  if (!micSupported()) {
    b.disabled = true;
    b.textContent = "Mic Unsupported";
    b.classList.remove("recording");
    return;
  }
  b.disabled = false;
  if (state.rec.active) {
    b.textContent = "Release Space To Send";
    b.classList.add("recording");
  } else {
    b.textContent = "Hold Space To Talk";
    b.classList.remove("recording");
  }
}

async function processMic(blob) {
  if (!blob || blob.size === 0) return setStatus("No mic audio captured.");
  const form = new FormData();
  form.append("file", blob, "mic.webm");
  setStatus("Transcribing microphone...");
  const r = await api("/v1/audio/transcribe", { method: "POST", body: form });
  const p = await r.json();
  const text = String(p.text || "").trim();
  $("stt-output").textContent = text;
  $("user-message").value = text;
  if (!text) return setStatus("Mic transcription was empty.");
  await sendChatText(text, true, true);
}

async function startTalk() {
  if (!micSupported()) return setStatus("Browser mic capture is unavailable.");
  if (state.rec.active) return;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" })
    : new MediaRecorder(stream);
  const chunks = [];
  rec.ondataavailable = (e) => {
    if (e.data?.size) chunks.push(e.data);
  };
  rec.onstop = () => {
    try {
      stream.getTracks().forEach((t) => t.stop());
    } catch (_) {}
    state.rec = { active: false, recorder: null, stream: null };
    syncTalkBtn();
    processMic(new Blob(chunks, { type: rec.mimeType || "audio/webm" })).catch((e) =>
      setStatus(`Voice flow failed: ${e.message}`),
    );
  };
  rec.start();
  state.rec = { active: true, recorder: rec, stream };
  syncTalkBtn();
  setStatus("Listening... release Space when done.");
}

async function stopTalk() {
  if (!state.rec.active || !state.rec.recorder) return;
  setStatus("Stopping recording...");
  state.rec.recorder.stop();
}

async function toggleTalk() {
  if (state.rec.active) await stopTalk();
  else await startTalk();
}

function isInputLike(target) {
  if (!target) return false;
  const tag = (target.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

async function onSpaceDown(ev) {
  if (ev.code !== "Space") return;
  if (state.ptt.spaceActive || state.rec.active) return;
  if (isInputLike(ev.target)) return;
  ev.preventDefault();
  state.ptt.spaceActive = true;
  try {
    await startTalk();
  } catch (e) {
    state.ptt.spaceActive = false;
    setStatus(`Mic failed: ${e.message}`);
  }
}

async function onSpaceUp(ev) {
  if (ev.code !== "Space") return;
  if (!state.ptt.spaceActive) return;
  ev.preventDefault();
  state.ptt.spaceActive = false;
  if (!state.rec.active) return;
  try {
    await stopTalk();
  } catch (e) {
    setStatus(`Mic failed: ${e.message}`);
  }
}

function wire() {
  $("profile-form").addEventListener("submit", (e) => saveProfile(e).catch((x) => setStatus(`Save failed: ${x.message}`)));
  $("new-profile").addEventListener("click", () => {
    state.selectedProfileId = null;
    fillProfile(null);
    renderProfiles();
    setStatus("Fill the form and save a new profile.");
  });
  $("new-session").addEventListener("click", () => {
    $("session-id").value = sid();
    renderSessions();
    setStatus("Created new session id.");
  });
  $("delete-profile").addEventListener("click", () => deleteCurrentProfile().catch((x) => setStatus(`Delete failed: ${x.message}`)));
  $("cleanup-profiles").addEventListener("click", () => keepOnlyCurrentProfile().catch((x) => setStatus(`Cleanup failed: ${x.message}`)));
  $("delete-session").addEventListener("click", () => deleteCurrentSession().catch((x) => setStatus(`Delete session failed: ${x.message}`)));
  $("load-history").addEventListener("click", () => loadHistory().catch((x) => setStatus(`History failed: ${x.message}`)));
  $("send-chat").addEventListener("click", () => sendComposer().catch((x) => setStatus(`Chat failed: ${x.message}`)));
  $("user-message").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      sendComposer().catch((x) => setStatus(`Chat failed: ${x.message}`));
    }
  });
  $("speak-reply").addEventListener("click", () => speakLast().catch((x) => setStatus(`Speak failed: ${x.message}`)));
  $("run-stt").addEventListener("click", () => runSttFile().catch((x) => setStatus(`STT failed: ${x.message}`)));
  $("talk-toggle").addEventListener("click", () => toggleTalk().catch((x) => setStatus(`Mic failed: ${x.message}`)));
  $("tts-model-select").addEventListener("change", () => {
    state.selectedTtsModel = $("tts-model-select").value || "";
    setStatus(`Using model: ${state.selectedTtsModel || "default"}`);
  });
  $("tts-model-add").addEventListener("click", () => {
    const v = $("tts-model-custom").value.trim();
    if (!v) return setStatus("Enter a model id first.");
    if (!state.ttsModels.some((m) => m.toLowerCase() === v.toLowerCase())) state.ttsModels.unshift(v);
    state.selectedTtsModel = v;
    renderTtsModels();
    $("tts-model-custom").value = "";
    setStatus(`Using custom model: ${v}`);
  });
  $("refresh-voices").addEventListener("click", () => loadVoices().catch((x) => setStatus(`Voice refresh failed: ${x.message}`)));
  $("clone-voice").addEventListener("click", () => cloneVoice().catch((x) => setStatus(`Clone failed: ${x.message}`)));
  $("design-voice").addEventListener("click", () => designVoice().catch((x) => setStatus(`Design failed: ${x.message}`)));
  $("save-designed-voice").addEventListener("click", () => saveDesignedVoice().catch((x) => setStatus(`Save designed voice failed: ${x.message}`)));
  document.addEventListener("keydown", (e) => {
    onSpaceDown(e).catch((x) => setStatus(`Mic failed: ${x.message}`));
  });
  document.addEventListener("keyup", (e) => {
    onSpaceUp(e).catch((x) => setStatus(`Mic failed: ${x.message}`));
  });
}

async function init() {
  wire();
  $("session-id").value = sid();
  syncTalkBtn();
  setVoiceOptions(state.voices, null);
  await loadTtsModels();
  await loadProfiles();
  setStatus(micSupported() ? "Ready. Hold Space to talk, release to send." : "Ready. Mic capture unsupported in this browser.");
}

function boot() {
  init().catch((e) => {
    console.error(e);
    setStatus(`Initialization failed: ${e.message}`);
  });
}

if (document.getElementById('profile-form')) {
  boot();
} else {
  window.addEventListener('ui:ready', boot, { once: true });
}



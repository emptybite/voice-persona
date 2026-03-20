(() => {
  const state = {
    currentView: "chat",
    profiles: [],
    sessions: [],
    currentProfile: null,
    currentSessionId: "",
    currentSessionDraft: false,
    selectedTtsModel: "",
    defaultTtsModel: "",
    llmApiKeyVisible: false,
    llmApiKeyMasked: "",
    elevenLabsApiKeyVisible: false,
    elevenLabsApiKeyMasked: "",
    availableVoices: [],
    streamTts: true,
    autoSpeak: false,
    lastAssistantText: "",
    currentAudio: null,
    currentAudioCleanup: null,
    isStreamingPlayback: false,
    saveTimer: null,
    isHydrating: false,
    mediaRecorder: null,
    mediaStream: null,
    recordedChunks: [],
  };

  const refs = {
    navButtons: Array.from(document.querySelectorAll("[data-view-target]")),
    views: Array.from(document.querySelectorAll("[data-view-panel]")),
    personaList: document.getElementById("persona-list"),
    sessionList: document.getElementById("session-list"),
    createPersona: document.getElementById("create-persona"),
    chatLog: document.getElementById("chat-log"),
    activeProfileName: document.getElementById("active-profile-name"),
    activeSessionTitle: document.getElementById("active-session-title"),
    activeProfileMeta: document.getElementById("active-profile-meta"),
    activeVoiceMeta: document.getElementById("active-voice-meta"),
    activeModelChip: document.getElementById("active-model-chip"),
    activeStreamChip: document.getElementById("active-stream-chip"),
    activeProfileAvatar: document.getElementById("active-profile-avatar"),
    shellAvatar: document.getElementById("shell-avatar"),
    userMessage: document.getElementById("user-message"),
    sendChat: document.getElementById("send-chat"),
    newSession: document.getElementById("new-session"),
    deleteSession: document.getElementById("delete-session"),
    talkToggle: document.getElementById("talk-toggle"),
    streamToggle: document.getElementById("stream-toggle"),
    streamToggleKnob: document.getElementById("stream-toggle-knob"),
    autoSpeakToggle: document.getElementById("auto-speak-toggle"),
    autoSpeakToggleKnob: document.getElementById("auto-speak-toggle-knob"),
    profileId: document.getElementById("profile-id"),
    profileName: document.getElementById("profile-name"),
    profileVoice: document.getElementById("profile-voice"),
    profilePersonality: document.getElementById("profile-personality"),
    profileSpeed: document.getElementById("profile-speed"),
    profileSpeedDisplay: document.getElementById("profile-speed-display"),
    profileTone: document.getElementById("profile-tone"),
    profileToneDisplay: document.getElementById("profile-tone-display"),
    profileAvatarPreview: document.getElementById("profile-avatar-preview"),
    avatarUpload: document.getElementById("avatar-upload"),
    avatarUploadTrigger: document.getElementById("avatar-upload-trigger"),
    renameVoiceName: document.getElementById("rename-voice-name"),
    renameVoiceDescription: document.getElementById("rename-voice-description"),
    renameVoice: document.getElementById("rename-voice"),
    deletePersona: document.getElementById("delete-persona"),
    wipeMemory: document.getElementById("wipe-memory"),
    status: document.getElementById("status"),
    cloneName: document.getElementById("clone-name"),
    cloneDescription: document.getElementById("clone-description"),
    cloneFiles: document.getElementById("clone-files"),
    cloneDropzone: document.getElementById("clone-dropzone"),
    cloneFileLabel: document.getElementById("clone-file-label"),
    cloneVoice: document.getElementById("clone-voice"),
    designName: document.getElementById("design-name"),
    designText: document.getElementById("design-text"),
    designGender: document.getElementById("design-gender"),
    designAge: document.getElementById("design-age"),
    designAccent: document.getElementById("design-accent"),
    designStrength: document.getElementById("design-strength"),
    designStrengthValue: document.getElementById("design-strength-value"),
    saveDesignedVoice: document.getElementById("save-designed-voice"),
    modelCards: Array.from(document.querySelectorAll("[data-tts-model]")),
    llmApiKey: document.getElementById("llm-api-key"),
    llmApiKeyToggle: document.getElementById("llm-api-key-toggle"),
    llmApiKeyToggleIcon: document.getElementById("llm-api-key-toggle-icon"),
    llmApiKeySave: document.getElementById("llm-api-key-save"),
    llmApiKeyStatus: document.getElementById("llm-api-key-status"),
    elevenLabsApiKey: document.getElementById("elevenlabs-api-key"),
    elevenLabsApiKeyToggle: document.getElementById("elevenlabs-api-key-toggle"),
    elevenLabsApiKeyToggleIcon: document.getElementById("elevenlabs-api-key-toggle-icon"),
    elevenLabsApiKeySave: document.getElementById("elevenlabs-api-key-save"),
    elevenLabsApiKeyStatus: document.getElementById("elevenlabs-api-key-status"),
    ttsModelCustom: document.getElementById("tts-model-custom"),
    ttsModelAdd: document.getElementById("tts-model-add"),
    refreshVoices: document.getElementById("refresh-voices"),
    factoryReset: document.getElementById("factory-reset"),
  };

  function newSessionId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function sortProfiles(profiles) {
    return [...profiles].sort((left, right) => new Date(right.updated_at || 0) - new Date(left.updated_at || 0));
  }

  function initials(name) {
    return (name || "VP")
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0] || "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "VP";
  }

  function avatarPlaceholder(name) {
    const label = initials(name);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="24" fill="#4f46e5"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Inter, sans-serif" font-size="42" font-weight="800" fill="#dad7ff">${label}</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function avatarSrc(profile) {
    return (profile && profile.avatar_url) || avatarPlaceholder(profile?.name || "VP");
  }

  function setAvatarImage(element, profile) {
    if (!element) {
      return;
    }
    element.src = avatarSrc(profile);
    element.alt = profile ? `${profile.name} avatar` : "Persona avatar";
  }

  function profilePreview(text) {
    const cleaned = String(text || "").replace(/\s+/g, " ").trim();
    if (!cleaned) {
      return "No personality set yet.";
    }
    return cleaned.length <= 64 ? cleaned : `${cleaned.slice(0, 61)}...`;
  }

  function toneLabelFromValue(value) {
    const numeric = Number(value);
    if (numeric <= 20) return "Analytical";
    if (numeric <= 40) return "Focused";
    if (numeric <= 60) return "Balanced";
    if (numeric <= 80) return "Expressive";
    return "Creative";
  }

  function tonePromptFromValue(value) {
    const label = toneLabelFromValue(value);
    const prompts = {
      Analytical: "Speak clearly, precisely, and with a calm analytical tone.",
      Focused: "Speak with a composed and efficient tone that stays direct.",
      Balanced: "Speak clearly and naturally with a balanced, professional tone.",
      Expressive: "Speak with warmth and light emotional color while staying polished.",
      Creative: "Speak with vivid, imaginative energy while remaining clear and controlled.",
    };
    return prompts[label] || prompts.Balanced;
  }

  function inferToneValue(tonePrompt) {
    const tone = (tonePrompt || "").toLowerCase();
    if (tone.includes("analytical")) return 15;
    if (tone.includes("efficient") || tone.includes("focused")) return 35;
    if (tone.includes("expressive") || tone.includes("warmth")) return 75;
    if (tone.includes("creative") || tone.includes("imaginative")) return 90;
    return 50;
  }

  function setStatus(message, tone = "neutral") {
    if (!refs.status) {
      return;
    }
    refs.status.textContent = message;
    refs.status.classList.remove("text-error", "text-secondary", "text-on-surface-variant");
    refs.status.classList.add(
      tone === "error" ? "text-error" : tone === "success" ? "text-secondary" : "text-on-surface-variant"
    );
  }

  async function api(path, options = {}) {
    const request = { ...options };
    request.headers = { Accept: "application/json", ...(options.headers || {}) };
    if (request.body && !(request.body instanceof FormData) && !request.headers["Content-Type"]) {
      request.headers["Content-Type"] = "application/json";
    }
    const response = await fetch(path, request);
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : await response.text();
    if (!response.ok) {
      const detail =
        payload && typeof payload === "object" && "detail" in payload
          ? payload.detail
          : `${response.status} ${response.statusText}`;
      throw new Error(friendlyErrorMessage(String(detail)));
    }
    return payload;
  }

  function setActiveView(viewName) {
    state.currentView = viewName;
    for (const button of refs.navButtons) {
      const active = button.dataset.viewTarget === viewName;
      button.classList.toggle("text-[#c3c0ff]", active);
      button.classList.toggle("border-[#4f46e5]", active);
      button.classList.toggle("pb-1", active);
      button.classList.toggle("border-b-2", active);
      button.classList.toggle("text-slate-400", !active);
    }
    for (const view of refs.views) {
      view.hidden = view.dataset.viewPanel !== viewName;
    }
  }

  function updateSpeedDisplay() {
    refs.profileSpeedDisplay.textContent = `${Number(refs.profileSpeed.value).toFixed(1)}x`;
  }

  function updateToneDisplay() {
    refs.profileToneDisplay.textContent = toneLabelFromValue(refs.profileTone.value);
  }

  function updateDesignStrengthDisplay() {
    refs.designStrengthValue.textContent = `${refs.designStrength.value}%`;
  }

  function selectedVoiceId() {
    const value = (refs.profileVoice.value || "").trim();
    return value || "default";
  }

  function selectedVoiceItem() {
    const voiceId = selectedVoiceId();
    return state.availableVoices.find((voice) => voice.voice_id === voiceId) || null;
  }

  function modelLabel(modelId) {
    const model = (modelId || "").trim().toLowerCase();
    if (model === "eleven_turbo_v2_5") return "Turbo v2.5";
    if (model === "eleven_multilingual_v2") return "Multilingual v2";
    if (model === "eleven_v3") return "Eleven v3";
    return modelId || "Default";
  }

  function friendlyErrorMessage(message) {
    const text = String(message || "").trim();
    if (!text) {
      return "Something went wrong.";
    }
    const lower = text.toLowerCase();
    if (lower.includes("quota_exceeded") || (lower.includes("credits remaining") && lower.includes("required"))) {
      return "ElevenLabs credits are too low for this request. Try Turbo v2.5, shorten the reply, or use another API key.";
    }
    if (
      lower.includes("api key is not configured") ||
      (lower.includes("elevenlabs") && lower.includes("401")) ||
      lower.includes("invalid_api_key")
    ) {
      return "ElevenLabs API access failed. Check the API key in the Models tab.";
    }
    if (lower.includes("lm studio request failed")) {
      return "LM Studio did not respond. Make sure the local model server is running.";
    }
    if (lower.includes("whisper request failed")) {
      return "Whisper transcription is unavailable right now.";
    }
    if (lower.startsWith("502: ")) {
      return text.slice(5);
    }
    return text;
  }

  function updateStreamingBadge() {
    refs.activeStreamChip.classList.toggle("hidden", !state.isStreamingPlayback);
  }

  function syncVoiceRenameFields() {
    const voice = selectedVoiceItem();
    refs.renameVoiceName.value = voice ? voice.name : "";
  }

  function syncDraftToCurrentProfile() {
    if (!state.currentProfile || state.isHydrating) {
      return;
    }
    state.currentProfile = {
      ...state.currentProfile,
      name: (refs.profileName.value || "Untitled Persona").trim(),
      system_prompt: (refs.profilePersonality.value || "").trim(),
      voice: {
        ...(state.currentProfile.voice || {}),
        voice: selectedVoiceId(),
        tone_prompt: tonePromptFromValue(refs.profileTone.value),
        language: "en",
        speed: Number(refs.profileSpeed.value),
      },
    };
  }

  function updateHeaderMeta() {
    const profile = state.currentProfile;
    const selectedOption = refs.profileVoice.selectedOptions[0];
    const session = currentSessionSummary();
    refs.activeProfileName.textContent = profile?.name || refs.profileName.value || "Persona";
    refs.activeSessionTitle.textContent = session?.title || "New conversation";
    refs.activeProfileMeta.textContent = profilePreview(profile?.system_prompt || refs.profilePersonality.value);
    refs.activeVoiceMeta.textContent = `Voice: ${selectedOption ? selectedOption.textContent.trim() : "Unassigned"}`;
    refs.activeModelChip.textContent = modelLabel(state.selectedTtsModel || state.defaultTtsModel);
    setAvatarImage(refs.activeProfileAvatar, profile);
    setAvatarImage(refs.shellAvatar, profile);
    setAvatarImage(refs.profileAvatarPreview, profile);
    updateStreamingBadge();
  }

  function updateToggleVisual(label, knob, active) {
    const track = label.querySelector("div");
    track.classList.toggle("bg-primary-container", active);
    track.classList.toggle("bg-surface-container-highest", !active);
    knob.classList.toggle("translate-x-4", active);
    knob.classList.toggle("bg-primary", active);
    knob.classList.toggle("bg-outline-variant", !active);
  }

  function updateApiKeyVisibility() {
    refs.elevenLabsApiKey.type = state.elevenLabsApiKeyVisible ? "text" : "password";
    refs.elevenLabsApiKeyToggleIcon.textContent = state.elevenLabsApiKeyVisible ? "visibility_off" : "visibility";
  }

  function updateLlmApiKeyVisibility() {
    refs.llmApiKey.type = state.llmApiKeyVisible ? "text" : "password";
    refs.llmApiKeyToggleIcon.textContent = state.llmApiKeyVisible ? "visibility_off" : "visibility";
  }

  function setApiKeyStatus(message, tone = "neutral") {
    refs.elevenLabsApiKeyStatus.textContent = message;
    refs.elevenLabsApiKeyStatus.classList.remove("text-error", "text-secondary", "text-on-surface-variant");
    refs.elevenLabsApiKeyStatus.classList.add(
      tone === "error" ? "text-error" : tone === "success" ? "text-secondary" : "text-on-surface-variant"
    );
  }

  function setLlmApiKeyStatus(message, tone = "neutral") {
    refs.llmApiKeyStatus.textContent = message;
    refs.llmApiKeyStatus.classList.remove("text-error", "text-secondary", "text-on-surface-variant");
    refs.llmApiKeyStatus.classList.add(
      tone === "error" ? "text-error" : tone === "success" ? "text-secondary" : "text-on-surface-variant"
    );
  }

  async function loadLlmApiKeyStatus() {
    const payload = await api("/v1/runtime/llm-api-key");
    state.llmApiKeyMasked = payload.masked || "";
    refs.llmApiKey.value = payload.masked || "";
    setLlmApiKeyStatus(
      payload.configured
        ? "LLM key is active. Enter a new one to override it, or leave blank and save to use the backend default."
        : "LLM key not configured yet.",
      payload.configured ? "success" : "neutral"
    );
  }

  async function saveLlmApiKey() {
    const value = (refs.llmApiKey.value || "").trim();
    if (state.llmApiKeyMasked && value === state.llmApiKeyMasked) {
      setLlmApiKeyStatus("API key unchanged.", "success");
      return;
    }

    setLlmApiKeyStatus(value ? "Saving API key..." : "Clearing custom override...");
    const payload = await api("/v1/runtime/llm-api-key", {
      method: "POST",
      body: JSON.stringify({ api_key: value }),
    });
    state.llmApiKeyMasked = payload.masked || "";
    refs.llmApiKey.value = payload.masked || "";
    state.llmApiKeyVisible = false;
    updateLlmApiKeyVisibility();
    setLlmApiKeyStatus(
      payload.configured
        ? value
          ? "LLM API key saved."
          : "Using backend default LLM API key."
        : "LLM API key cleared.",
      payload.configured ? "success" : "neutral"
    );
  }

  async function loadElevenLabsApiKeyStatus() {
    const payload = await api("/v1/runtime/elevenlabs-api-key");
    state.elevenLabsApiKeyMasked = payload.masked || "";
    refs.elevenLabsApiKey.value = payload.masked || "";
    setApiKeyStatus(
      payload.configured ? "Provider key is configured. Enter a new one to replace it." : "Provider key not configured yet.",
      payload.configured ? "success" : "neutral"
    );
  }

  async function saveElevenLabsApiKey() {
    const value = (refs.elevenLabsApiKey.value || "").trim();
    if (!value) {
      setApiKeyStatus("Enter an ElevenLabs API key first.", "error");
      return;
    }
    if (state.elevenLabsApiKeyMasked && value === state.elevenLabsApiKeyMasked) {
      setApiKeyStatus("API key unchanged.", "success");
      return;
    }

    setApiKeyStatus("Saving API key...");
    const payload = await api("/v1/runtime/elevenlabs-api-key", {
      method: "POST",
      body: JSON.stringify({ api_key: value }),
    });
    state.elevenLabsApiKeyMasked = payload.masked || "";
    refs.elevenLabsApiKey.value = payload.masked || "";
    state.elevenLabsApiKeyVisible = false;
    updateApiKeyVisibility();
    setApiKeyStatus("API key saved.", "success");
  }

  function renderPersonaList() {
    refs.personaList.innerHTML = "";
    if (!state.profiles.length) {
      const empty = document.createElement("div");
      empty.className = "px-3 py-4 text-xs leading-relaxed text-on-surface-variant border border-outline-variant/10 rounded-xl bg-surface-container-lowest/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]";
      empty.textContent = "No personas yet. Create one to get started.";
      refs.personaList.append(empty);
      return;
    }

    for (const profile of state.profiles) {
      const active = profile.id === state.currentProfile?.id;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.profileId = profile.id;
      button.className = `w-full text-left rounded-2xl p-3 transition-all border ${active ? "bg-primary/10 border-primary/30 shadow-[0_10px_24px_rgba(79,70,229,0.14)]" : "bg-surface-container-lowest/95 border-outline-variant/10 hover:border-primary/20 hover:bg-surface-container-high hover:-translate-y-[1px]"}`;

      const row = document.createElement("div");
      row.className = "flex items-start gap-3";
      const avatar = document.createElement("img");
      avatar.className = "w-10 h-10 rounded-full object-cover border border-outline-variant/20";
      avatar.src = avatarSrc(profile);
      avatar.alt = `${profile.name} avatar`;

      const textWrap = document.createElement("div");
      textWrap.className = "min-w-0 flex-1";
      const title = document.createElement("div");
      title.className = active ? "text-sm font-bold text-primary truncate" : "text-sm font-bold text-on-surface truncate";
      title.textContent = profile.name;
      const preview = document.createElement("p");
      preview.className = "mt-1 text-[11px] leading-relaxed text-on-surface-variant line-clamp-2";
      preview.textContent = profilePreview(profile.system_prompt);

      textWrap.append(title, preview);
      row.append(avatar, textWrap);
      button.append(row);
      refs.personaList.append(button);
    }
  }

  function formatSessionTime(value) {
    if (!value) {
      return "Now";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Now";
    }
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    if (sameDay) {
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function sessionItems() {
    const items = Array.isArray(state.sessions) ? [...state.sessions] : [];
    const hasCurrent = items.some((session) => session.session_id === state.currentSessionId);
    if (state.currentSessionId && state.currentSessionDraft && !hasCurrent) {
      items.unshift({
        session_id: state.currentSessionId,
        message_count: 0,
        title: "New conversation",
        preview: "No messages yet.",
        updated_at: new Date().toISOString(),
        draft: true,
      });
    }
    return items;
  }

  function currentSessionSummary() {
    return sessionItems().find((session) => session.session_id === state.currentSessionId) || null;
  }

  function renderSessionList() {
    refs.sessionList.innerHTML = "";
    const items = sessionItems();
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "px-3 py-4 text-xs leading-relaxed text-on-surface-variant border border-outline-variant/10 rounded-xl bg-surface-container-lowest/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]";
      empty.textContent = "No conversations yet. Start one to begin chatting.";
      refs.sessionList.append(empty);
      return;
    }

    for (const session of items) {
      const active = session.session_id === state.currentSessionId;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.sessionId = session.session_id;
      button.className = `w-full text-left rounded-2xl p-3 transition-all border ${active ? "bg-secondary-container/10 border-secondary/25 shadow-[0_10px_22px_rgba(28,166,77,0.12)]" : "bg-surface-container-lowest/95 border-outline-variant/10 hover:border-secondary/20 hover:bg-surface-container-high hover:-translate-y-[1px]"}`;

      const top = document.createElement("div");
      top.className = "flex items-center justify-between gap-3";
      const title = document.createElement("div");
      title.className = active ? "text-sm font-semibold text-secondary truncate" : "text-sm font-semibold text-on-surface truncate";
      title.textContent = session.title || "Conversation";
      const time = document.createElement("span");
      time.className = "text-[10px] uppercase tracking-widest text-on-surface-variant/60 shrink-0";
      time.textContent = formatSessionTime(session.updated_at);
      top.append(title, time);

      const preview = document.createElement("p");
      preview.className = "mt-1 text-[11px] leading-relaxed text-on-surface-variant line-clamp-2";
      preview.textContent = session.preview || "No messages yet.";

      const footer = document.createElement("div");
      footer.className = "mt-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-on-surface-variant/50";
      const badge = document.createElement("span");
      badge.className = "px-2 py-1 rounded-full bg-surface-container-highest border border-outline-variant/10";
      badge.textContent = session.draft ? "Draft" : `${session.message_count || 0} msgs`;
      footer.append(badge);

      button.append(top, preview, footer);
      refs.sessionList.append(button);
    }
  }

  function stopCurrentAudio() {
    state.isStreamingPlayback = false;
    updateStreamingBadge();
    if (typeof state.currentAudioCleanup === "function") {
      try {
        state.currentAudioCleanup();
      } catch (_error) {
        // Best-effort cleanup for active streams.
      }
      state.currentAudioCleanup = null;
    }
    if (state.currentAudio) {
      state.currentAudio.pause();
      if (state.currentAudio.dataset.objectUrl) {
        URL.revokeObjectURL(state.currentAudio.dataset.objectUrl);
      }
      state.currentAudio = null;
    }
  }

  async function playAudioBlob(blob) {
    stopCurrentAudio();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.dataset.objectUrl = url;
    state.currentAudio = audio;
    state.currentAudioCleanup = null;
    audio.addEventListener("ended", () => {
      URL.revokeObjectURL(url);
      if (state.currentAudio === audio) {
        state.currentAudio = null;
      }
      state.isStreamingPlayback = false;
      updateStreamingBadge();
      state.currentAudioCleanup = null;
    });
    await audio.play();
  }

  function clearChat() {
    refs.chatLog.innerHTML = "";
  }

  function renderEmptyState() {
    clearChat();
    const wrapper = document.createElement("div");
    wrapper.className = "max-w-3xl mx-auto text-center py-16 px-6 text-on-surface-variant";
    const title = document.createElement("p");
    title.className = "text-sm font-semibold text-on-surface mb-2";
    title.textContent = "Session ready.";
    const copy = document.createElement("p");
    copy.className = "text-xs uppercase tracking-[0.2em] leading-relaxed";
    copy.textContent = "Send a message to begin this conversation.";
    wrapper.append(title, copy);
    refs.chatLog.append(wrapper);
  }

  function messageBubble(role, text, timestamp) {
    const time = timestamp ? new Date(timestamp) : new Date();
    const stamp = time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (role === "user") {
      const outer = document.createElement("div");
      outer.className = "flex justify-end gap-4 max-w-4xl ml-auto";
      const column = document.createElement("div");
      column.className = "flex flex-col items-end gap-1.5";
      const bubble = document.createElement("div");
      bubble.className = "bg-primary-container text-on-primary-container px-5 py-3 rounded-2xl rounded-tr-lg shadow-[0_14px_30px_rgba(79,70,229,0.18)] max-w-lg whitespace-pre-wrap";
      bubble.textContent = text;
      const label = document.createElement("span");
      label.className = "font-label text-[9px] uppercase tracking-widest text-on-surface-variant/50";
      label.textContent = stamp;
      column.append(bubble, label);
      outer.append(column);
      return outer;
    }

    const outer = document.createElement("div");
    outer.className = "flex gap-4 max-w-4xl";
    const avatarWrap = document.createElement("div");
    avatarWrap.className = "flex-shrink-0 mt-1";
    const avatar = document.createElement("img");
    avatar.className = "w-8 h-8 rounded-full object-cover border border-outline-variant/20";
    avatar.src = avatarSrc(state.currentProfile);
    avatar.alt = `${state.currentProfile?.name || "Persona"} avatar`;
    avatarWrap.append(avatar);

    const column = document.createElement("div");
    column.className = "flex flex-col gap-1.5";
    const bubble = document.createElement("div");
    bubble.className = "bg-surface-container-high text-on-surface px-5 py-3 rounded-2xl rounded-tl-lg border border-outline-variant/10 shadow-[0_14px_30px_rgba(0,0,0,0.16)] max-w-lg whitespace-pre-wrap";
    bubble.textContent = text;

    const meta = document.createElement("div");
    meta.className = "flex items-center gap-3 mt-1";
    const label = document.createElement("span");
    label.className = "font-label text-[9px] uppercase tracking-widest text-on-surface-variant/50";
    label.textContent = stamp;
    const replay = document.createElement("button");
    replay.className = "flex items-center gap-1.5 text-secondary hover:text-secondary-fixed transition-colors";
    replay.dataset.replayText = text;
    replay.innerHTML = '<span class="material-symbols-outlined text-sm">play_circle</span><span class="font-label text-[9px] font-bold uppercase tracking-widest">Replay TTS</span>';

    meta.append(label, replay);
    column.append(bubble, meta);
    outer.append(avatarWrap, column);
    return outer;
  }

  function renderMessages(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
      renderEmptyState();
      return;
    }
    clearChat();
    for (const message of messages) {
      if (!message || (message.role !== "user" && message.role !== "assistant")) {
        continue;
      }
      refs.chatLog.append(messageBubble(message.role, message.content || "", message.timestamp));
    }
    refs.chatLog.scrollTop = refs.chatLog.scrollHeight;
    const assistants = messages.filter((message) => message.role === "assistant");
    state.lastAssistantText = assistants.length ? assistants[assistants.length - 1].content || "" : "";
  }

  function upsertProfileInState(profile) {
    const existingIndex = state.profiles.findIndex((item) => item.id === profile.id);
    if (existingIndex >= 0) {
      state.profiles[existingIndex] = profile;
    } else {
      state.profiles.push(profile);
    }
    state.profiles = sortProfiles(state.profiles);
    state.currentProfile = state.profiles.find((item) => item.id === profile.id) || profile;
    renderPersonaList();
    renderSessionList();
    updateHeaderMeta();
  }

  async function loadSessionMessages() {
    if (!state.currentProfile || !state.currentSessionId) {
      renderEmptyState();
      return;
    }
    const messages = await api(`/v1/profiles/${encodeURIComponent(state.currentProfile.id)}/sessions/${encodeURIComponent(state.currentSessionId)}/messages`);
    renderMessages(messages);
    renderSessionList();
    updateHeaderMeta();
  }

  async function refreshSessions({ selectLatest = false } = {}) {
    if (!state.currentProfile) {
      return;
    }
    const sessions = await api(`/v1/profiles/${encodeURIComponent(state.currentProfile.id)}/sessions`);
    state.sessions = Array.isArray(sessions) ? sessions : [];

    if (selectLatest) {
      if (state.sessions.length > 0) {
        state.currentSessionId = state.sessions[0].session_id;
        state.currentSessionDraft = false;
      } else {
        state.currentSessionId = newSessionId();
        state.currentSessionDraft = true;
      }
    } else if (state.currentSessionId) {
      state.currentSessionDraft = !state.sessions.some((session) => session.session_id === state.currentSessionId);
    }

    renderSessionList();
    updateHeaderMeta();
  }

  async function loadLatestSession() {
    await refreshSessions({ selectLatest: true });
    if (state.currentSessionDraft) {
      renderEmptyState();
      setStatus(`Started a fresh chat for ${state.currentProfile.name}.`);
      return;
    }
    await loadSessionMessages();
    setStatus(`Loaded ${state.currentProfile.name}.`);
  }

  async function openSession(sessionId) {
    state.currentSessionId = sessionId;
    state.currentSessionDraft = false;
    renderSessionList();
    updateHeaderMeta();
    await loadSessionMessages();
  }

  async function deleteCurrentSession() {
    if (!state.currentProfile) {
      return;
    }
    if (!state.currentSessionId) {
      setStatus("There is no conversation to delete.");
      return;
    }

    const current = currentSessionSummary();
    const label = current?.title || "this conversation";
    const confirmed = window.confirm(`Delete ${label}?`);
    if (!confirmed) {
      return;
    }

    if (!state.currentSessionDraft) {
      await api(
        `/v1/profiles/${encodeURIComponent(state.currentProfile.id)}/sessions/${encodeURIComponent(state.currentSessionId)}`,
        { method: "DELETE" }
      );
    }

    await refreshSessions({ selectLatest: true });
    if (state.currentSessionDraft) {
      renderEmptyState();
    } else {
      await loadSessionMessages();
    }
    refs.userMessage.focus();
    setStatus("Conversation deleted.", "success");
  }

  function profilePayload() {
    return {
      id: refs.profileId.value || undefined,
      name: (refs.profileName.value || "Untitled Persona").trim(),
      system_prompt: (refs.profilePersonality.value || "").trim() || "Helpful, conversational, and distinct. Stay in character while responding naturally.",
      avatar_url: state.currentProfile?.avatar_url || null,
      voice: {
        voice: selectedVoiceId(),
        tone_prompt: tonePromptFromValue(refs.profileTone.value),
        language: "en",
        speed: Number(refs.profileSpeed.value),
      },
    };
  }

  async function saveProfile() {
    if (state.isHydrating) {
      return;
    }
    const saved = await api("/v1/profiles", {
      method: "POST",
      body: JSON.stringify(profilePayload()),
    });
    refs.profileId.value = saved.id;
    upsertProfileInState(saved);
  }

  function queueProfileSave() {
    clearTimeout(state.saveTimer);
    state.saveTimer = window.setTimeout(async () => {
      try {
        await saveProfile();
        setStatus("Persona updated.", "success");
      } catch (error) {
        setStatus(`Could not save persona: ${error.message}`, "error");
      }
    }, 250);
  }

  function populateProfile(profile) {
    state.isHydrating = true;
    refs.profileId.value = profile.id;
    refs.profileName.value = profile.name || "Untitled Persona";
    refs.profilePersonality.value = profile.system_prompt || "";
    refs.profileSpeed.value = String(profile.voice?.speed ?? 1.0);
    refs.profileTone.value = String(inferToneValue(profile.voice?.tone_prompt));
    updateSpeedDisplay();
    updateToneDisplay();
    state.isHydrating = false;
    updateHeaderMeta();
  }

  async function selectProfile(profileId) {
    const profile = state.profiles.find((item) => item.id === profileId);
    if (!profile) {
      return;
    }
    state.currentProfile = profile;
    state.sessions = [];
    state.currentSessionId = "";
    state.currentSessionDraft = false;
    populateProfile(profile);
    renderPersonaList();
    renderSessionList();
    await loadVoices({ quiet: true });
    await loadLatestSession();
  }

  async function createPersona() {
    const created = await api("/v1/profiles", {
      method: "POST",
      body: JSON.stringify({
        name: `Persona ${state.profiles.length + 1}`,
        system_prompt: "Helpful, conversational, and distinct. Stay in character while responding naturally.",
        avatar_url: null,
        voice: {
          voice: "default",
          tone_prompt: tonePromptFromValue(refs.profileTone.value),
          language: "en",
          speed: 1.0,
        },
      }),
    });
    upsertProfileInState(created);
    await selectProfile(created.id);
    setStatus("New persona created.", "success");
  }

  async function deleteCurrentPersona() {
    if (!state.currentProfile) {
      return;
    }
    const profile = state.currentProfile;
    const confirmed = window.confirm(`Delete persona "${profile.name}"? This also removes its saved conversations.`);
    if (!confirmed) {
      return;
    }

    clearTimeout(state.saveTimer);
    await api(`/v1/profiles/${encodeURIComponent(profile.id)}`, { method: "DELETE" });
    state.profiles = state.profiles.filter((item) => item.id !== profile.id);
    state.sessions = [];
    state.currentSessionId = "";
    state.currentSessionDraft = false;
    renderPersonaList();
    renderSessionList();
    renderEmptyState();

    if (state.profiles.length) {
      await selectProfile(state.profiles[0].id);
    } else {
      await createPersona();
    }
    setStatus(`Deleted ${profile.name}.`, "success");
  }

  async function ensureProfile() {
    const profiles = await api("/v1/profiles");
    state.profiles = sortProfiles(Array.isArray(profiles) ? profiles : []);
    renderPersonaList();
    if (!state.profiles.length) {
      await createPersona();
      return;
    }
    await selectProfile(state.profiles[0].id);
  }

  function populateVoices(catalog) {
    state.availableVoices = Array.isArray(catalog.voice_items) ? catalog.voice_items : [];
    const currentValue = state.currentProfile?.voice?.voice || selectedVoiceId();
    refs.profileVoice.innerHTML = "";

    if (!state.availableVoices.length) {
      const option = document.createElement("option");
      option.value = "default";
      option.textContent = "No voices loaded";
      refs.profileVoice.append(option);
      refs.profileVoice.value = "default";
      syncVoiceRenameFields();
      updateHeaderMeta();
      return;
    }

    for (const voice of state.availableVoices) {
      const option = document.createElement("option");
      option.value = voice.voice_id;
      option.textContent = voice.name;
      refs.profileVoice.append(option);
    }

    const fallback = catalog.default_voice || state.availableVoices[0].voice_id;
    refs.profileVoice.value = state.availableVoices.some((voice) => voice.voice_id === currentValue)
      ? currentValue
      : fallback;
    syncVoiceRenameFields();
    syncDraftToCurrentProfile();
    updateHeaderMeta();
  }

  async function loadVoices({ quiet = false } = {}) {
    const query = state.selectedTtsModel ? `?model=${encodeURIComponent(state.selectedTtsModel)}` : "";
    const catalog = await api(`/v1/voices${query}`);
    populateVoices(catalog);
    if (state.currentProfile && state.currentProfile.voice?.voice !== refs.profileVoice.value) {
      await saveProfile();
    }
    if (!quiet) {
      setStatus("Voice library synced.", "success");
    }
  }

  async function loadRuntimeCatalog() {
    const [runtime, tts] = await Promise.all([api("/v1/runtime/catalog"), api("/v1/tts/models")]);
    state.defaultTtsModel = runtime.tts?.configured_model || tts.default_model || "";
    state.selectedTtsModel = state.defaultTtsModel || (Array.isArray(tts.models) ? tts.models[0] : "") || "";
    refs.ttsModelCustom.value = state.selectedTtsModel;
    updateModelSelection();
  }

  function updateModelSelection() {
    for (const card of refs.modelCards) {
      const active = card.dataset.ttsModel === state.selectedTtsModel;
      card.classList.toggle("ring-2", active);
      card.classList.toggle("ring-primary/60", active);
      card.classList.toggle("ring-offset-2", active);
      card.classList.toggle("ring-offset-surface", active);
    }
    if (refs.ttsModelCustom && !refs.modelCards.some((card) => card.dataset.ttsModel === state.selectedTtsModel)) {
      refs.ttsModelCustom.value = state.selectedTtsModel;
    }
  }

  async function speakText(text) {
    if (!state.currentProfile || !text.trim()) {
      return;
    }

    setStatus("Rendering speech output...");
    if (state.streamTts) {
      state.isStreamingPlayback = true;
      updateStreamingBadge();
      setStatus("Live streaming voice...");
      await streamSpeak(text);
      setStatus("Speech playback complete.", "success");
      return;
    }

    const response = await fetch("/v1/audio/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        profile_id: state.currentProfile.id,
        text,
        format: "mp3",
        tts_model: state.selectedTtsModel || null,
        voice_id: selectedVoiceId(),
      }),
    });

    if (!response.ok) {
      let detail = `${response.status} ${response.statusText}`;
      try {
        const payload = await response.json();
        if (payload && payload.detail) {
          detail = payload.detail;
        }
      } catch (_error) {
        // Keep the HTTP status when the body is not JSON.
      }
      throw new Error(friendlyErrorMessage(detail));
    }

    const blob = await response.blob();
    state.isStreamingPlayback = false;
    updateStreamingBadge();
    await playAudioBlob(blob);
    setStatus("Speech playback complete.", "success");
  }

  function streamSpeak(text) {
    const supportsLiveStream =
      typeof window.MediaSource !== "undefined" &&
      typeof window.MediaSource.isTypeSupported === "function" &&
      window.MediaSource.isTypeSupported("audio/mpeg");

    if (!supportsLiveStream) {
      return new Promise((resolve, reject) => {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const socket = new WebSocket(`${protocol}//${window.location.host}/ws/tts`);
        const parts = [];

        socket.addEventListener("open", () => {
          socket.send(
            JSON.stringify({
              profile_id: state.currentProfile.id,
              text,
              tts_model: state.selectedTtsModel || null,
              voice_id: selectedVoiceId(),
            })
          );
        });

        socket.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
        if (payload.type === "audio_chunk" && payload.audio_b64) {
            const decoded = atob(payload.audio_b64);
            const bytes = new Uint8Array(decoded.length);
            for (let index = 0; index < decoded.length; index += 1) {
              bytes[index] = decoded.charCodeAt(index);
            }
            parts.push(bytes);
            return;
          }
          if (payload.type === "done") {
            socket.close();
            playAudioBlob(new Blob(parts, { type: "audio/mpeg" })).then(resolve).catch(reject);
            return;
          }
          if (payload.type === "error") {
            socket.close();
            reject(new Error(friendlyErrorMessage(payload.detail || "Streaming TTS failed.")));
          }
        });

        socket.addEventListener("error", () => {
          reject(new Error(friendlyErrorMessage("Streaming TTS connection failed.")));
        });
      });
    }

    return new Promise((resolve, reject) => {
      stopCurrentAudio();
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${window.location.host}/ws/tts`);
      const mediaSource = new MediaSource();
      const objectUrl = URL.createObjectURL(mediaSource);
      const audio = new Audio(objectUrl);
      audio.dataset.objectUrl = objectUrl;
      audio.preload = "auto";
      state.currentAudio = audio;

      let sourceBuffer = null;
      let playbackStarted = false;
      let streamFinished = false;
      let settled = false;
      const pendingChunks = [];

      const finishResolve = () => {
        if (settled) {
          return;
        }
        settled = true;
        resolve();
      };

      const finishReject = (error) => {
        if (settled) {
          return;
        }
        settled = true;
        reject(error);
      };

      const cleanup = () => {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
        if (audio.dataset.objectUrl) {
          URL.revokeObjectURL(audio.dataset.objectUrl);
        }
        state.isStreamingPlayback = false;
        updateStreamingBadge();
        if (state.currentAudio === audio) {
          state.currentAudio = null;
          state.currentAudioCleanup = null;
        }
      };

      state.currentAudioCleanup = cleanup;

      const maybeFinalizeStream = () => {
        if (!streamFinished || !sourceBuffer || sourceBuffer.updating || pendingChunks.length) {
          return;
        }
        if (mediaSource.readyState === "open") {
          try {
            mediaSource.endOfStream();
          } catch (_error) {
            // Ignore close races when the stream is already done.
          }
        }
      };

      const appendNextChunk = () => {
        if (!sourceBuffer || sourceBuffer.updating || !pendingChunks.length) {
          maybeFinalizeStream();
          return;
        }
        sourceBuffer.appendBuffer(pendingChunks.shift());
      };

      mediaSource.addEventListener("sourceopen", () => {
        try {
          sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
        } catch (_error) {
          cleanup();
          finishReject(new Error("This browser could not initialize live MP3 streaming."));
          return;
        }

        sourceBuffer.addEventListener("updateend", () => {
          if (!playbackStarted && audio.buffered.length) {
            playbackStarted = true;
            audio.play().catch(() => undefined);
          }
          appendNextChunk();
        });

        appendNextChunk();
      });

      socket.addEventListener("open", () => {
        socket.send(
          JSON.stringify({
            profile_id: state.currentProfile.id,
            text,
            tts_model: state.selectedTtsModel || null,
            voice_id: selectedVoiceId(),
          })
        );
      });

      socket.addEventListener("message", (event) => {
        const payload = JSON.parse(event.data);
        if (payload.type === "audio_chunk" && payload.audio_b64) {
          const decoded = atob(payload.audio_b64);
          const bytes = new Uint8Array(decoded.length);
          for (let index = 0; index < decoded.length; index += 1) {
            bytes[index] = decoded.charCodeAt(index);
          }
          pendingChunks.push(bytes);
          appendNextChunk();
          return;
        }
        if (payload.type === "done") {
          streamFinished = true;
          if (!playbackStarted) {
            audio.play().catch(() => undefined);
          }
          maybeFinalizeStream();
          return;
        }
        if (payload.type === "error") {
          cleanup();
          finishReject(new Error(friendlyErrorMessage(payload.detail || "Streaming TTS failed.")));
        }
      });

      audio.addEventListener("ended", () => {
        cleanup();
        finishResolve();
      });

      audio.addEventListener("error", () => {
        const mediaError = audio.error ? `code ${audio.error.code}` : "unknown audio error";
        cleanup();
        finishReject(new Error(`Live audio playback failed: ${mediaError}`));
      });

      socket.addEventListener("error", () => {
        cleanup();
        finishReject(new Error(friendlyErrorMessage("Streaming TTS connection failed.")));
      });
    });
  }

  async function submitChat() {
    const text = refs.userMessage.value.trim();
    if (!text || !state.currentProfile) {
      return;
    }

    const original = refs.userMessage.value;
    refs.userMessage.value = "";
    setStatus("Generating response...");

    try {
      await api("/v1/chat", {
        method: "POST",
        body: JSON.stringify({
          profile_id: state.currentProfile.id,
          session_id: state.currentSessionId,
          tts_model: state.selectedTtsModel || null,
          user_message: text,
        }),
      });
      state.currentSessionDraft = false;
      await refreshSessions();
      await loadSessionMessages();
      if (state.autoSpeak && state.lastAssistantText) {
        await speakText(state.lastAssistantText);
      } else {
        setStatus("Response ready.", "success");
      }
    } catch (error) {
      refs.userMessage.value = original;
      setStatus(`Chat failed: ${error.message}`, "error");
    }
  }

  async function replayLastAssistant(textOverride) {
    const text = textOverride || state.lastAssistantText;
    if (!text) {
      setStatus("There is no assistant reply to replay yet.");
      return;
    }
    try {
      await speakText(text);
    } catch (error) {
      setStatus(`Replay failed: ${error.message}`, "error");
    }
  }

  async function clearMemory() {
    if (!state.currentProfile) {
      return;
    }
    setStatus("Wiping saved memory...");
    const sessions = await api(`/v1/profiles/${encodeURIComponent(state.currentProfile.id)}/sessions`);
    for (const session of sessions) {
      await api(
        `/v1/profiles/${encodeURIComponent(state.currentProfile.id)}/sessions/${encodeURIComponent(session.session_id)}`,
        { method: "DELETE" }
      );
    }
    state.currentSessionId = newSessionId();
    renderEmptyState();
    setStatus(`Memory cleared for ${state.currentProfile.name}.`, "success");
  }

  async function uploadAvatar(file) {
    if (!file || !state.currentProfile) {
      return;
    }
    setStatus("Uploading avatar...");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("current_avatar_url", state.currentProfile.avatar_url || "");
    const payload = await api("/v1/profiles/avatar", {
      method: "POST",
      body: formData,
    });
    state.currentProfile = { ...state.currentProfile, avatar_url: payload.url };
    upsertProfileInState(state.currentProfile);
    await saveProfile();
    setStatus("Persona avatar updated.", "success");
  }

  async function cloneVoice() {
    const files = Array.from(refs.cloneFiles.files || []);
    if (!files.length) {
      setStatus("Add at least one audio sample before cloning.", "error");
      return;
    }

    const name = (refs.cloneName.value || "").trim() || `Voice Clone ${new Date().toLocaleDateString()}`;
    const description = (refs.cloneDescription.value || "").trim();
    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    for (const file of files) {
      formData.append("files", file);
    }

    setStatus("Uploading clone samples...");
    const payload = await api("/v1/elevenlabs/voices/clone", { method: "POST", body: formData });
    await loadVoices({ quiet: true });

    const newVoiceId = String(payload.voice_id || payload.voice?.voice_id || "").trim();
    if (newVoiceId) {
      refs.profileVoice.value = newVoiceId;
      syncDraftToCurrentProfile();
      await saveProfile();
    }
    setStatus("Voice clone created and added to the library.", "success");
  }

  async function renameSelectedVoice() {
    const voiceId = selectedVoiceId();
    if (!voiceId || voiceId === "default") {
      setStatus("Select a real voice first.", "error");
      return;
    }

    const name = (refs.renameVoiceName.value || "").trim();
    const description = (refs.renameVoiceDescription.value || "").trim();
    if (!name) {
      setStatus("Enter a new voice name first.", "error");
      return;
    }

    setStatus("Renaming selected voice...");
    await api(`/v1/elevenlabs/voices/${encodeURIComponent(voiceId)}/rename`, {
      method: "POST",
      body: JSON.stringify({ name, description }),
    });
    await loadVoices({ quiet: true });
    refs.profileVoice.value = voiceId;
    syncVoiceRenameFields();
    syncDraftToCurrentProfile();
    await saveProfile();
    setStatus("Voice name updated.", "success");
  }

  function mapDesignGender(value) {
    return value.toLowerCase().startsWith("masc") ? "male" : "female";
  }

  function mapDesignAge(value) {
    if (value.toLowerCase().includes("young")) return "young";
    if (value.toLowerCase().includes("senior")) return "old";
    return "middle_aged";
  }

  function mapDesignAccent(value) {
    const normalized = value.toLowerCase();
    if (normalized.includes("british")) return "british";
    if (normalized.includes("australian")) return "australian";
    if (normalized.includes("transatlantic")) return "transatlantic";
    return "american";
  }

  function generatedVoiceIdFromPayload(payload) {
    if (!payload || typeof payload !== "object") {
      return "";
    }
    for (const key of ["generated_voice_id", "voice_id", "preview_voice_id"]) {
      const value = payload[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    for (const value of Object.values(payload)) {
      if (value && typeof value === "object") {
        const nested = generatedVoiceIdFromPayload(value);
        if (nested) {
          return nested;
        }
      }
    }
    return "";
  }

  async function saveDesignedVoice() {
    const text = (refs.designText.value || "").trim();
    const designedName = (refs.designName.value || `${(refs.profileName.value || "Voice Persona").trim()} Designed Voice`).trim();
    if (text.length < 20) {
      setStatus("Describe the designed voice in a bit more detail first.", "error");
      return;
    }
    if (!designedName) {
      setStatus("Add a name for the designed voice first.", "error");
      return;
    }

    setStatus("Designing voice...");
    const designPayload = await api("/v1/elevenlabs/voices/design", {
      method: "POST",
      body: JSON.stringify({
        text,
        voice_description: text,
        gender: mapDesignGender(refs.designGender.value),
        age: mapDesignAge(refs.designAge.value),
        accent: mapDesignAccent(refs.designAccent.value),
        accent_strength: Number(refs.designStrength.value) / 100,
      }),
    });

    const generatedVoiceId = generatedVoiceIdFromPayload(designPayload);
    if (!generatedVoiceId) {
      throw new Error("The provider did not return a generated voice id.");
    }

    setStatus("Saving designed voice...");
    const createdPayload = await api("/v1/elevenlabs/voices/create-from-design", {
      method: "POST",
      body: JSON.stringify({
        voice_name: designedName,
        voice_description: text,
        generated_voice_id: generatedVoiceId,
      }),
    });

    await loadVoices({ quiet: true });
    const createdVoiceId = generatedVoiceIdFromPayload(createdPayload);
    if (createdVoiceId) {
      refs.profileVoice.value = createdVoiceId;
      syncVoiceRenameFields();
      syncDraftToCurrentProfile();
      await saveProfile();
    }
    setStatus("Designed voice saved to the provider library.", "success");
  }

  async function toggleRecording() {
    if (state.mediaRecorder && state.mediaRecorder.state === "recording") {
      state.mediaRecorder.stop();
      setStatus("Stopping recording...");
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus("Microphone access is not available in this browser.", "error");
      return;
    }

    try {
      state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.recordedChunks = [];
      state.mediaRecorder = new MediaRecorder(state.mediaStream);

      state.mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data && event.data.size > 0) {
          state.recordedChunks.push(event.data);
        }
      });

      state.mediaRecorder.addEventListener("stop", async () => {
        const audioBlob = new Blob(state.recordedChunks, { type: state.mediaRecorder.mimeType || "audio/webm" });
        state.mediaStream.getTracks().forEach((track) => track.stop());
        state.mediaStream = null;
        refs.talkToggle.classList.remove("bg-error/10", "text-error", "border-error/20");
        refs.talkToggle.classList.add("bg-secondary/10", "text-secondary", "border-secondary/20");

        try {
          setStatus("Transcribing microphone input...");
          const formData = new FormData();
          formData.append("file", audioBlob, "push-to-talk.webm");
          const payload = await api("/v1/audio/transcribe", { method: "POST", body: formData });
          refs.userMessage.value = payload.text || "";
          setStatus("Transcription ready. Sending message...");
          await submitChat();
        } catch (error) {
          setStatus(`Push-to-talk failed: ${error.message}`, "error");
        }
      });

      state.mediaRecorder.start();
      refs.talkToggle.classList.remove("bg-secondary/10", "text-secondary", "border-secondary/20");
      refs.talkToggle.classList.add("bg-error/10", "text-error", "border-error/20");
      setStatus("Recording... click Push-To-Talk again to stop.");
    } catch (error) {
      setStatus(`Could not access the microphone: ${error.message}`, "error");
    }
  }

  function bindCloneDropzone() {
    refs.cloneDropzone.addEventListener("click", () => refs.cloneFiles.click());
    refs.cloneFiles.addEventListener("change", () => {
      const count = (refs.cloneFiles.files || []).length;
      refs.cloneFileLabel.textContent = count ? `${count} audio file${count === 1 ? "" : "s"} selected` : "Drag and drop audio file";
    });

    refs.cloneDropzone.addEventListener("dragover", (event) => {
      event.preventDefault();
      refs.cloneDropzone.classList.add("border-primary/50");
    });

    refs.cloneDropzone.addEventListener("dragleave", () => {
      refs.cloneDropzone.classList.remove("border-primary/50");
    });

    refs.cloneDropzone.addEventListener("drop", (event) => {
      event.preventDefault();
      refs.cloneDropzone.classList.remove("border-primary/50");
      const files = event.dataTransfer?.files;
      if (files && files.length) {
        const transfer = new DataTransfer();
        for (const file of files) {
          transfer.items.add(file);
        }
        refs.cloneFiles.files = transfer.files;
        refs.cloneFileLabel.textContent = `${files.length} audio file${files.length === 1 ? "" : "s"} selected`;
      }
    });
  }

  function bindEvents() {
    for (const button of refs.navButtons) {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        setActiveView(button.dataset.viewTarget || "chat");
      });
    }

    refs.personaList.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) {
        return;
      }
      const button = event.target.closest("[data-profile-id]");
      if (!button) {
        return;
      }
      selectProfile(button.dataset.profileId).catch((error) =>
        setStatus(`Could not switch persona: ${error.message}`, "error")
      );
    });

    refs.sessionList.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) {
        return;
      }
      const button = event.target.closest("[data-session-id]");
      if (!button) {
        return;
      }
      openSession(button.dataset.sessionId).catch((error) =>
        setStatus(`Could not open conversation: ${error.message}`, "error")
      );
    });

    refs.createPersona.addEventListener("click", () => {
      createPersona().catch((error) => setStatus(`Could not create persona: ${error.message}`, "error"));
    });

    refs.deletePersona.addEventListener("click", () => {
      deleteCurrentPersona().catch((error) => setStatus(`Could not delete persona: ${error.message}`, "error"));
    });

    refs.avatarUploadTrigger.addEventListener("click", () => refs.avatarUpload.click());
    refs.avatarUpload.addEventListener("change", () => {
      const [file] = refs.avatarUpload.files || [];
      uploadAvatar(file).catch((error) => setStatus(`Avatar upload failed: ${error.message}`, "error"));
      refs.avatarUpload.value = "";
    });

    refs.sendChat.addEventListener("click", () => {
      submitChat().catch((error) => setStatus(`Chat failed: ${error.message}`, "error"));
    });

    refs.userMessage.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submitChat().catch((error) => setStatus(`Chat failed: ${error.message}`, "error"));
      }
    });

    refs.newSession.addEventListener("click", () => {
      state.currentSessionId = newSessionId();
      state.currentSessionDraft = true;
      renderEmptyState();
      renderSessionList();
      updateHeaderMeta();
      refs.userMessage.focus();
      setStatus("New conversation ready.", "success");
    });

    refs.deleteSession.addEventListener("click", () => {
      deleteCurrentSession().catch((error) => setStatus(`Could not delete conversation: ${error.message}`, "error"));
    });

    refs.chatLog.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) {
        return;
      }
      const replayButton = event.target.closest("[data-replay-text]");
      if (!replayButton) {
        return;
      }
      replayLastAssistant(replayButton.dataset.replayText).catch((error) =>
        setStatus(`Replay failed: ${error.message}`, "error")
      );
    });

    refs.streamToggle.addEventListener("click", () => {
      state.streamTts = !state.streamTts;
      updateToggleVisual(refs.streamToggle, refs.streamToggleKnob, state.streamTts);
      setStatus(`Stream TTS ${state.streamTts ? "enabled" : "disabled"}.`);
    });

    refs.autoSpeakToggle.addEventListener("click", () => {
      state.autoSpeak = !state.autoSpeak;
      updateToggleVisual(refs.autoSpeakToggle, refs.autoSpeakToggleKnob, state.autoSpeak);
      setStatus(`Auto-Speak ${state.autoSpeak ? "enabled" : "disabled"}.`);
    });

    refs.profileName.addEventListener("input", () => {
      syncDraftToCurrentProfile();
      renderPersonaList();
      updateHeaderMeta();
      queueProfileSave();
    });

    refs.profilePersonality.addEventListener("input", () => {
      syncDraftToCurrentProfile();
      renderPersonaList();
      updateHeaderMeta();
      queueProfileSave();
    });

    refs.profileVoice.addEventListener("change", () => {
      syncVoiceRenameFields();
      syncDraftToCurrentProfile();
      updateHeaderMeta();
      queueProfileSave();
    });

    refs.renameVoice.addEventListener("click", () => {
      renameSelectedVoice().catch((error) => setStatus(`Could not rename voice: ${error.message}`, "error"));
    });

    refs.profileSpeed.addEventListener("input", () => {
      syncDraftToCurrentProfile();
      updateSpeedDisplay();
      queueProfileSave();
    });

    refs.profileTone.addEventListener("input", () => {
      syncDraftToCurrentProfile();
      updateToneDisplay();
      queueProfileSave();
    });

    refs.wipeMemory.addEventListener("click", () => {
      clearMemory().catch((error) => setStatus(`Could not wipe memory: ${error.message}`, "error"));
    });

    refs.talkToggle.addEventListener("click", () => {
      toggleRecording().catch((error) => setStatus(`Microphone error: ${error.message}`, "error"));
    });

    refs.cloneVoice.addEventListener("click", () => {
      cloneVoice().catch((error) => setStatus(`Voice cloning failed: ${error.message}`, "error"));
    });

    refs.elevenLabsApiKeyToggle.addEventListener("click", () => {
      state.elevenLabsApiKeyVisible = !state.elevenLabsApiKeyVisible;
      updateApiKeyVisibility();
    });

    refs.llmApiKeyToggle.addEventListener("click", () => {
      state.llmApiKeyVisible = !state.llmApiKeyVisible;
      updateLlmApiKeyVisibility();
    });

    refs.elevenLabsApiKeySave.addEventListener("click", () => {
      saveElevenLabsApiKey()
        .then(() => loadVoices({ quiet: true }).catch(() => undefined))
        .catch((error) => setApiKeyStatus(`Could not save API key: ${error.message}`, "error"));
    });

    refs.llmApiKeySave.addEventListener("click", () => {
      saveLlmApiKey().catch((error) => setLlmApiKeyStatus(`Could not save API key: ${error.message}`, "error"));
    });

    refs.designStrength.addEventListener("input", updateDesignStrengthDisplay);

    refs.saveDesignedVoice.addEventListener("click", () => {
      saveDesignedVoice().catch((error) => setStatus(`Voice design failed: ${error.message}`, "error"));
    });

    for (const card of refs.modelCards) {
      card.addEventListener("click", async () => {
        state.selectedTtsModel = card.dataset.ttsModel || state.selectedTtsModel;
        refs.ttsModelCustom.value = state.selectedTtsModel;
        updateModelSelection();
        try {
          await loadVoices({ quiet: true });
          setStatus(`Selected TTS model: ${state.selectedTtsModel}`, "success");
        } catch (error) {
          setStatus(`Could not switch model: ${error.message}`, "error");
        }
      });
    }

    refs.ttsModelAdd.addEventListener("click", async () => {
      const customModel = (refs.ttsModelCustom.value || "").trim();
      if (!customModel) {
        setStatus("Enter a model id first.", "error");
        return;
      }
      state.selectedTtsModel = customModel;
      updateModelSelection();
      try {
        await loadVoices({ quiet: true });
        setStatus(`Using custom TTS model: ${customModel}`, "success");
      } catch (error) {
        setStatus(`Could not use that model: ${error.message}`, "error");
      }
    });

    refs.refreshVoices.addEventListener("click", () => {
      loadVoices().catch((error) => setStatus(`Could not refresh voices: ${error.message}`, "error"));
    });

    refs.factoryReset.addEventListener("click", async () => {
      state.selectedTtsModel = state.defaultTtsModel;
      refs.ttsModelCustom.value = state.selectedTtsModel;
      updateModelSelection();
      try {
        await loadVoices({ quiet: true });
        setStatus("Model selection reset to backend defaults.", "success");
      } catch (error) {
        setStatus(`Could not reset model selection: ${error.message}`, "error");
      }
    });
  }

  async function init() {
    bindEvents();
    bindCloneDropzone();
    updateLlmApiKeyVisibility();
    updateApiKeyVisibility();
    updateSpeedDisplay();
    updateToneDisplay();
    updateDesignStrengthDisplay();
    updateToggleVisual(refs.streamToggle, refs.streamToggleKnob, state.streamTts);
    updateToggleVisual(refs.autoSpeakToggle, refs.autoSpeakToggleKnob, state.autoSpeak);
    setActiveView("chat");

    try {
      await loadRuntimeCatalog();
      await loadLlmApiKeyStatus();
      await loadElevenLabsApiKeyStatus();
      await ensureProfile();
      updateHeaderMeta();
      setStatus("Voice Persona connected to the backend.", "success");
    } catch (error) {
      renderEmptyState();
      setStatus(`Startup failed: ${error.message}`, "error");
    }
  }

  init().catch((error) => {
    setStatus(`Startup failed: ${error.message}`, "error");
  });
})();

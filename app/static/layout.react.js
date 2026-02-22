(() => {
  const rootNode = document.getElementById("app-root");
  if (!rootNode) {
    throw new Error("app-root not found");
  }

  rootNode.innerHTML = `
<div class="app-shell">
  <div class="bg-noise"></div>
  <div class="bg-orb orb-a"></div>
  <div class="bg-orb orb-b"></div>
  <div class="bg-orb orb-c"></div>

  <header class="topbar">
    <div class="brand">
      <p class="eyebrow">Neural Voice Desk</p>
      <h1>Voice Persona Studio</h1>
      <p class="subtitle">Live persona chat, speech capture, and ElevenLabs voice lab in one control surface.</p>
    </div>
    <div class="model-picker panel">
      <label for="tts-model-select">TTS Model</label>
      <select id="tts-model-select"></select>
      <input id="tts-model-custom" placeholder="Custom model id">
      <button id="tts-model-add" type="button">Use Model</button>
      <button id="refresh-voices" type="button" class="ghost">Refresh Voice IDs</button>
    </div>
  </header>

  <main class="workspace">
    <section class="left-column">
      <section class="panel block">
        <div class="block-head">
          <h2>Profiles</h2>
          <button id="new-profile" type="button">New</button>
        </div>
        <div id="profiles" class="list"></div>
      </section>

      <section class="panel block">
        <h2>Profile Settings</h2>
        <form id="profile-form" class="form">
          <input id="profile-id" type="hidden">
          <label for="profile-name">Name</label>
          <input id="profile-name" required placeholder="Assistant name">

          <label for="profile-prompt">System Prompt</label>
          <textarea id="profile-prompt" rows="5" required placeholder="Persona instructions"></textarea>

          <label for="profile-voice">ElevenLabs Voice ID</label>
          <select id="profile-voice"></select>

          <div class="two-col">
            <div>
              <label for="profile-language">Language</label>
              <input id="profile-language" placeholder="Auto, en, es">
            </div>
            <div>
              <label for="profile-speed">Speed</label>
              <input id="profile-speed" type="number" step="0.1" min="0.5" max="2.0" value="1.0">
            </div>
          </div>

          <label for="profile-tone">Tone Direction</label>
          <input id="profile-tone" placeholder="Calm, clear, concise">

          <button type="submit">Save Profile</button>
        </form>
        <div class="actions-row">
          <button id="delete-profile" type="button" class="danger">Delete Profile</button>
          <button id="cleanup-profiles" type="button" class="ghost">Keep Only This Profile</button>
        </div>
      </section>

      <section class="panel block split">
        <div>
          <h2>Sessions</h2>
          <div class="session-controls">
            <input id="session-id" placeholder="session id">
            <button id="new-session" type="button">New Session</button>
            <button id="load-history" type="button" class="ghost">Load History</button>
            <button id="delete-session" type="button" class="danger">Delete Session</button>
          </div>
          <div id="sessions" class="list"></div>
        </div>
        <div>
          <h2>File Transcription</h2>
          <input id="stt-file" type="file" accept="audio/*">
          <button id="run-stt" type="button">Transcribe File</button>
          <pre id="stt-output" class="output"></pre>
          <audio id="audio-player" controls></audio>
          <p id="status" class="status">Ready.</p>
        </div>
      </section>

      <section class="panel block split">
        <div>
          <h2>Voice Clone</h2>
          <div class="form">
            <label for="clone-name">Voice Name</label>
            <input id="clone-name" placeholder="My Cloned Voice">
            <label for="clone-description">Description</label>
            <input id="clone-description" placeholder="Short description">
            <label for="clone-files">Audio Samples (1-25)</label>
            <input id="clone-files" type="file" accept="audio/*" multiple>
            <button id="clone-voice" type="button">Create Cloned Voice</button>
          </div>
        </div>
        <div>
          <h2>Text To Voice Design</h2>
          <div class="form">
            <label for="design-text">Voice Description Prompt (100+ chars)</label>
            <textarea id="design-text" rows="4" placeholder="Describe voice personality, cadence, tone, pacing, and emotional style in detail."></textarea>
            <div class="two-col">
              <div>
                <label for="design-gender">Gender</label>
                <select id="design-gender">
                  <option value="female">female</option>
                  <option value="male">male</option>
                </select>
              </div>
              <div>
                <label for="design-age">Age</label>
                <select id="design-age">
                  <option value="young">young</option>
                  <option value="middle_aged" selected>middle_aged</option>
                  <option value="old">old</option>
                </select>
              </div>
            </div>
            <label for="design-accent">Accent</label>
            <input id="design-accent" value="american">
            <label for="design-strength">Accent Strength</label>
            <input id="design-strength" type="number" value="0.35" min="0" max="2" step="0.05">
            <button id="design-voice" type="button">Generate Voice Design</button>
            <label for="design-generated-id">Generated Voice ID</label>
            <input id="design-generated-id" placeholder="generated_voice_id">
            <label for="design-save-name">Save As Name</label>
            <input id="design-save-name" placeholder="My Designed Voice">
            <label for="design-save-description">Save Description</label>
            <input id="design-save-description" placeholder="Optional description">
            <button id="save-designed-voice" type="button">Save Designed Voice</button>
          </div>
          <pre id="voice-lab-output" class="output"></pre>
        </div>
      </section>

    </section>

    <aside class="chat-dock panel">
      <div class="dock-head">
        <h2>Live Chat</h2>
        <div class="voice-controls">
          <button id="speak-reply" type="button">Replay Reply</button>
          <label class="toggle"><input id="use-stream-tts" type="checkbox">Stream</label>
          <label class="toggle"><input id="auto-speak" type="checkbox" checked>Auto Speak</label>
        </div>
      </div>

      <button id="talk-toggle" class="talk-big" type="button">Hold Space To Talk</button>
      <div id="chat-log" class="chat-log"></div>
      <div class="composer">
        <textarea id="user-message" rows="3" placeholder="Type a message. Ctrl+Enter to send."></textarea>
        <button id="send-chat" type="button">Send</button>
      </div>
    </aside>
  </main>
</div>
`;

  window.dispatchEvent(new Event("ui:ready"));
})();

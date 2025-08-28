
// Point Tracker app using localStorage per-page
(function() {
  const pageId = document.body.getAttribute('data-page') || location.pathname.replace(/\W+/g, '_') || 'default';
  const storageKey = (suffix) => `pts::${pageId}::${suffix}`;

  const defaultState = {
    timer: { running: false, targetMs: 0, remainingMs: 0, lastStartTs: null },
    teams: {
      A: { name: 'Team One', score: 0 },
      B: { name: 'Team Two', score: 0 }
    },
    players: [],
    history: []
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(storageKey('state'));
      const s = raw ? JSON.parse(raw) : structuredClone(defaultState);
      // Upgrade paths
      if (!s.timer) s.timer = { running: false, targetMs: 0, remainingMs: 0, lastStartTs: null };
      if (!s.teams) s.teams = structuredClone(defaultState.teams);
      if (!Array.isArray(s.players)) s.players = [];
      if (!Array.isArray(s.history)) s.history = [];
      // Initialize remainingMs from target if both are zero (fresh page)
      if (!s.timer.remainingMs && s.timer.targetMs) s.timer.remainingMs = s.timer.targetMs;
      return s;
    } catch (e) {
      console.error('Failed to load state, resetting:', e);
      return structuredClone(defaultState);
    }
  }

  function saveState() {
    localStorage.setItem(storageKey('state'), JSON.stringify(state));
    render();
  }

  function resetPage() {
    if (!confirm('Reset all scores, players, timer, and history for this page?')) return;
    localStorage.removeItem(storageKey('state'));
    state = structuredClone(defaultState);
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    render();
  }

  // DOM refs
  const teamANameInput = document.getElementById('teamAName');
  const teamBNameInput = document.getElementById('teamBName');
  const teamALabel = document.getElementById('teamALabel');
  const teamBLabel = document.getElementById('teamBLabel');
  const teamAScore = document.getElementById('teamAScore');
  const teamBScore = document.getElementById('teamBScore');
  const addButtons = document.querySelectorAll('[data-action="add"]');
  const playerSelectA = document.getElementById('playerSelectA');
  const playerSelectB = document.getElementById('playerSelectB');
  const noteInputA = document.getElementById('noteInputA');
  const noteInputB = document.getElementById('noteInputB');
  const addPlayerForm = document.getElementById('addPlayerForm');
  const playerName = document.getElementById('playerName');
  const officerName = document.getElementById('officerName');
  const playerTeam = document.getElementById('playerTeam');
  const playersTbody = document.getElementById('playersTbody');
  const historyTbody = document.getElementById('historyTbody');
  const resetBtn = document.getElementById('resetBtn');
  const exportJsonBtn = document.getElementById('exportJsonBtn');

  // Timer refs
  const timerDisplay = document.getElementById('timerDisplay');
  const timerStartPauseBtn = document.getElementById('timerStartPauseBtn');
  const timerResetBtn = document.getElementById('timerResetBtn');
  const timerSetBtn = document.getElementById('timerSetBtn');
  const timerHours = document.getElementById('timerHours');
  const timerMinutes = document.getElementById('timerMinutes');
  const timerSeconds = document.getElementById('timerSeconds');

  let state = loadState();

  function render() {
    // Team names
    if (teamANameInput) teamANameInput.value = state.teams.A.name;
    if (teamBNameInput) teamBNameInput.value = state.teams.B.name;
    if (teamALabel) teamALabel.textContent = state.teams.A.name;
    if (teamBLabel) teamBLabel.textContent = state.teams.B.name;

    // Update team names in player add select
    if (playerTeam) {
      const optA = playerTeam.querySelector('option[value="A"]');
      const optB = playerTeam.querySelector('option[value="B"]');
      if (optA) optA.textContent = state.teams.A.name;
      if (optB) optB.textContent = state.teams.B.name;
    }

    // Scores
    if (teamAScore) teamAScore.textContent = state.teams.A.score;
    if (teamBScore) teamBScore.textContent = state.teams.B.score;

    // Populate per-team player selects
    if (playerSelectA) {
      const prev = playerSelectA.value;
      playerSelectA.innerHTML = '<option value="">-- Select Officer --</option>';
      state.players.forEach((p, idx) => {
        if (p.team === 'A') {
          const opt = document.createElement('option');
          opt.value = String(idx);
          opt.textContent = `${p.playerName} (${p.officerName})`;
          playerSelectA.appendChild(opt);
        }
      });
      if ([...playerSelectA.options].some(o => o.value === prev)) playerSelectA.value = prev;
    }
    if (playerSelectB) {
      const prev = playerSelectB.value;
      playerSelectB.innerHTML = '<option value="">-- Select Officer --</option>';
      state.players.forEach((p, idx) => {
        if (p.team === 'B') {
          const opt = document.createElement('option');
          opt.value = String(idx);
          opt.textContent = `${p.playerName} (${p.officerName})`;
          playerSelectB.appendChild(opt);
        }
      });
      if ([...playerSelectB.options].some(o => o.value === prev)) playerSelectB.value = prev;
    }

    // Players table
    if (playersTbody) {
      playersTbody.innerHTML = '';
      state.players.forEach((p, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${idx + 1}</td>
          <td>${escapeHtml(p.playerName)}</td>
          <td>${escapeHtml(p.officerName)}</td>
          <td>${p.team === 'A' ? escapeHtml(state.teams.A.name) : escapeHtml(state.teams.B.name)}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-danger" data-remove-player="${idx}">Remove</button>
          </td>
        `;
        playersTbody.appendChild(tr);
      });
    }

    // History table (no timestamp displayed)
    if (historyTbody) {
      historyTbody.innerHTML = '';
      [...state.history].reverse().forEach(h => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${h.team === 'A' ? escapeHtml(state.teams.A.name) : escapeHtml(state.teams.B.name)}</td>
          <td>${h.player ? escapeHtml(h.player) : ''}</td>
          <td>${h.officer ? escapeHtml(h.officer) : ''}</td>
          <td>${h.delta > 0 ? '+' : ''}${h.delta}</td>
          <td>${h.note ? escapeHtml(h.note) : ''}</td>
        `;
        historyTbody.appendChild(tr);
      });
    }

    // Timer
    renderTimer();
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[s]));
  }

  // Team name change listeners
  if (teamANameInput) {
    teamANameInput.addEventListener('input', e => {
      state.teams.A.name = e.target.value || 'Team One';
      saveState();
    });
  }
  if (teamBNameInput) {
    teamBNameInput.addEventListener('input', e => {
      state.teams.B.name = e.target.value || 'Team Two';
      saveState();
    });
  }

  // Scoring buttons: positive adds entry; negative undoes last positive entry for the team
  addButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const team = btn.getAttribute('data-team');
      const amount = parseInt(btn.getAttribute('data-amount'), 10) || 0;
      if (!['A', 'B'].includes(team)) return;

      if (amount > 0) {
        // Determine selected player index
        let pIdx = null;
        if (team === 'A' && playerSelectA && playerSelectA.value !== '') pIdx = parseInt(playerSelectA.value, 10);
        if (team === 'B' && playerSelectB && playerSelectB.value !== '') pIdx = parseInt(playerSelectB.value, 10);
        let playerNameSel = '', officerNameSel = '';
        if (Number.isInteger(pIdx) && state.players[pIdx] && state.players[pIdx].team === team) {
          playerNameSel = state.players[pIdx].playerName;
          officerNameSel = state.players[pIdx].officerName;
        }
        const note = team === 'A' && noteInputA ? noteInputA.value.trim() :
                     team === 'B' && noteInputB ? noteInputB.value.trim() : '';

        state.teams[team].score = Math.max(0, state.teams[team].score + amount);
        state.history.push({ ts: Date.now(), team, delta: amount, player: playerNameSel, officer: officerNameSel, note });
        if (team === 'A' && noteInputA) noteInputA.value = '';
        if (team === 'B' && noteInputB) noteInputB.value = '';
        saveState();
      } else if (amount < 0) {
        // Undo last positive entry for this team
        let idx = state.history.length - 1;
        while (idx >= 0) {
          const h = state.history[idx];
          if (h.team === team && h.delta > 0) {
            state.teams[team].score = Math.max(0, state.teams[team].score - h.delta);
            state.history.splice(idx, 1);
            saveState();
            return;
          }
          idx--;
        }
      }
    });
  });

  // Add player form
  if (addPlayerForm) {
    addPlayerForm.addEventListener('submit', e => {
      e.preventDefault();
      const pn = playerName.value.trim();
      const on = officerName.value.trim();
      const tm = playerTeam.value;
      if (!pn || !on) return;
      state.players.push({ playerName: pn, officerName: on, team: tm });
      playerName.value = '';
      officerName.value = '';
      playerTeam.value = 'A';
      saveState();
    });
  }

  // Remove player
  if (playersTbody) {
    playersTbody.addEventListener('click', e => {
      const btn = e.target.closest('button[data-remove-player]');
      if (!btn) return;
      const idx = parseInt(btn.getAttribute('data-remove-player'), 10);
      if (!Number.isInteger(idx)) return;
      state.players.splice(idx, 1);
      saveState();
    });
  }

  if (resetBtn) resetBtn.addEventListener('click', resetPage);

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${pageId}-point-tracker.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // --- Countdown Timer ---
  let timerInterval = null;

  function pad2(n) { return n.toString().padStart(2, '0'); }
  function clamp(n, min, max) { return Math.min(Math.max(n, min), max); }

  function formatHMS(ms) {
    const msSafe = Math.max(0, Math.floor(ms));
    const totalSeconds = Math.floor(msSafe / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  }

  function getRemainingNow() {
    if (!state.timer.running || !state.timer.lastStartTs) return state.timer.remainingMs || 0;
    const elapsed = Date.now() - state.timer.lastStartTs;
    return Math.max(0, (state.timer.remainingMs || 0) - elapsed);
  }

  function renderTimer() {
    if (timerDisplay) timerDisplay.textContent = formatHMS(getRemainingNow());
    if (timerStartPauseBtn) timerStartPauseBtn.textContent = state.timer.running ? 'Pause' : 'Start';
  }

  function setTimerFromInputs() {
    if (!timerHours || !timerMinutes || !timerSeconds) return;
    const h = Math.max(0, parseInt(timerHours.value || '0', 10) || 0);
    const m = clamp(parseInt(timerMinutes.value || '0', 10) || 0, 0, 59);
    const s = clamp(parseInt(timerSeconds.value || '0', 10) || 0, 0, 59);
    const totalMs = ((h * 3600) + (m * 60) + s) * 1000;
    state.timer.targetMs = totalMs;
    state.timer.remainingMs = totalMs;
    state.timer.running = false;
    state.timer.lastStartTs = null;
    saveState();
    renderTimer();
  }

  function startTimer() {
    if (state.timer.running) return;
    // If we haven't set anything, do nothing
    if ((state.timer.remainingMs || 0) <= 0 && (state.timer.targetMs || 0) <= 0) return;
    state.timer.running = true;
    state.timer.lastStartTs = Date.now();
    saveState();
    if (!timerInterval) {
      timerInterval = setInterval(() => {
        const rem = getRemainingNow();
        if (timerDisplay) timerDisplay.textContent = formatHMS(rem);
        if (rem <= 0) {
          pauseTimer(true);
          if (timerDisplay) {
            timerDisplay.classList.add('text-danger');
            setTimeout(() => timerDisplay.classList.remove('text-danger'), 1500);
          }
        }
      }, 250);
    }
  }

  function pauseTimer(auto=false) {
    if (!state.timer.running) return;
    const rem = getRemainingNow();
    state.timer.remainingMs = rem;
    state.timer.running = false;
    state.timer.lastStartTs = null;
    saveState();
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    if (!auto) renderTimer();
  }

  function resetTimer() {
    state.timer.running = false;
    state.timer.remainingMs = state.timer.targetMs || 0;
    state.timer.lastStartTs = null;
    saveState();
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    renderTimer();
  }

  if (timerSetBtn) timerSetBtn.addEventListener('click', setTimerFromInputs);
  if (timerStartPauseBtn) timerStartPauseBtn.addEventListener('click', () => {
    if (state.timer.running) pauseTimer(); else startTimer();
  });
  if (timerResetBtn) timerResetBtn.addEventListener('click', resetTimer);

  // Initial render + resume running timer
  render();
  if (state.timer.running) {
    startTimer();
  } else {
    renderTimer();
  }
})();

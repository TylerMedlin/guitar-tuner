(() => {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const IN_TUNE_CENTS = 5;     // within this = in tune
  const CLOSE_CENTS = 15;      // within this = almost there
  const HOLD_MS = 350;         // how long to stay in tune before confirming
  const SILENCE_MS = 700;      // how long without a pitch before going idle
  const MIN_RMS = 0.008;       // ignore very quiet input
  const MIN_MIDI = 24, MAX_MIDI = 84;
  const STORE_CURRENT = 'guitarTuner.current';
  const STORE_CUSTOM = 'guitarTuner.custom';

  const $ = (id) => document.getElementById(id);

  // ---------- State ----------
  const state = {
    notes: PRESET_TUNINGS[0].notes.slice(),
    selected: 0,          // string index (0 = low E / 6th string)
    locked: false,        // true = only listen for the selected string
    tuned: [false, false, false, false, false, false],
    customs: [],
    editing: -1,
  };

  function load() {
    try {
      const cur = JSON.parse(localStorage.getItem(STORE_CURRENT));
      if (Array.isArray(cur) && cur.length === 6 && cur.every(Number.isInteger)) state.notes = cur;
      const customs = JSON.parse(localStorage.getItem(STORE_CUSTOM));
      if (Array.isArray(customs)) state.customs = customs.filter((c) => c && Array.isArray(c.notes) && c.notes.length === 6);
    } catch (_) { /* storage unavailable: use defaults */ }
  }

  function save() {
    try {
      localStorage.setItem(STORE_CURRENT, JSON.stringify(state.notes));
      localStorage.setItem(STORE_CUSTOM, JSON.stringify(state.customs));
    } catch (_) { /* ignore */ }
  }

  const sameNotes = (a, b) => a.length === b.length && a.every((n, i) => n === b[i]);

  // ---------- Tuning dropdown ----------
  const select = $('tuningSelect');

  function renderSelect() {
    select.innerHTML = '';
    let matched = false;

    const addOpt = (parent, value, text, notes) => {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = text;
      if (!matched && notes && sameNotes(notes, state.notes)) { o.selected = true; matched = true; }
      parent.appendChild(o);
    };

    const presets = document.createElement('optgroup');
    presets.label = 'Presets';
    PRESET_TUNINGS.forEach((t, i) => addOpt(presets, 'p' + i, t.name, t.notes));
    select.appendChild(presets);

    if (state.customs.length) {
      const g = document.createElement('optgroup');
      g.label = 'My tunings';
      state.customs.forEach((t, i) => addOpt(g, 'c' + i, `${t.name} (${t.notes.map(Notes.name).join(' ')})`, t.notes));
      select.appendChild(g);
    }

    if (!matched) {
      addOpt(select, 'edited', `Custom: ${state.notes.map(Notes.name).join(' ')}`, null);
      select.value = 'edited';
    }

    $('deleteTuning').hidden = !select.value.startsWith('c');
  }

  select.addEventListener('change', () => {
    const v = select.value;
    if (v.startsWith('p')) state.notes = PRESET_TUNINGS[+v.slice(1)].notes.slice();
    else if (v.startsWith('c')) state.notes = state.customs[+v.slice(1)].notes.slice();
    state.tuned.fill(false);
    save();
    renderAll();
  });

  $('saveTuning').addEventListener('click', () => {
    const name = (prompt('Name this tuning:', 'My tuning') || '').trim();
    if (!name) return;
    const existing = state.customs.findIndex((c) => c.name === name);
    const entry = { name, notes: state.notes.slice() };
    if (existing >= 0) state.customs[existing] = entry; else state.customs.push(entry);
    save();
    renderSelect();
  });

  $('deleteTuning').addEventListener('click', () => {
    const v = select.value;
    if (!v.startsWith('c')) return;
    const t = state.customs[+v.slice(1)];
    if (!confirm(`Delete “${t.name}”?`)) return;
    state.customs.splice(+v.slice(1), 1);
    save();
    renderSelect();
  });

  // ---------- Headstock drawing ----------
  const headstock = $('headstock');
  // Peg layout (3 + 3). Index = string (0 = low E).
  const POSTS = [
    { x: 108, y: 238, side: -1 }, // 6th
    { x: 108, y: 158, side: -1 }, // 5th
    { x: 108, y: 78, side: -1 },  // 4th
    { x: 212, y: 78, side: 1 },   // 3rd
    { x: 212, y: 158, side: 1 },  // 2nd
    { x: 212, y: 238, side: 1 },  // 1st
  ];
  const NUT_Y = 322;
  const nutX = (i) => 132 + i * 11.2;
  const pegEls = [];
  const stringEls = [];

  function el(tag, attrs, parent) {
    const e = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function buildHeadstock() {
    const defs = el('defs', {}, headstock);
    const wood = el('linearGradient', { id: 'woodGrad', x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
    el('stop', { offset: '0', 'stop-color': '#7a4a24' }, wood);
    el('stop', { offset: '1', 'stop-color': '#3e2410' }, wood);
    const knob = el('radialGradient', { id: 'knobGrad', cx: '35%', cy: '30%', r: '75%' }, defs);
    el('stop', { offset: '0', 'stop-color': '#ffffff' }, knob);
    el('stop', { offset: '.55', 'stop-color': '#c9ced6' }, knob);
    el('stop', { offset: '1', 'stop-color': '#7d838d' }, knob);

    // Neck below the nut
    el('rect', { x: 124, y: NUT_Y, width: 72, height: 60, fill: '#3a2414' }, headstock);
    // Headstock body
    el('path', {
      d: 'M124 322 L118 290 C100 230 82 150 78 60 C76 30 100 12 160 12 C220 12 244 30 242 60 C238 150 220 230 202 290 L196 322 Z',
      fill: 'url(#woodGrad)',
      stroke: '#2a180a',
      'stroke-width': 2,
    }, headstock);
    // Nut
    el('rect', { x: 122, y: NUT_Y - 4, width: 76, height: 8, rx: 2, fill: '#efe6d2' }, headstock);

    // Shafts to the knobs (drawn under strings and posts)
    POSTS.forEach((p) => {
      const kx = p.x + p.side * 72;
      el('rect', {
        x: Math.min(p.x, kx), y: p.y - 5, width: Math.abs(kx - p.x), height: 10, rx: 3,
        fill: '#9aa0a8', stroke: '#5c6169', 'stroke-width': 1,
      }, headstock);
    });

    // Strings from nut to posts, then down the neck
    for (let i = 0; i < 6; i++) {
      const w = 2.6 - i * 0.35;
      const g = el('g', {}, headstock);
      el('line', { x1: nutX(i), y1: NUT_Y, x2: POSTS[i].x, y2: POSTS[i].y, 'stroke-width': w, class: 'string-line' }, g);
      el('line', { x1: nutX(i), y1: NUT_Y, x2: nutX(i), y2: 380, 'stroke-width': w, class: 'string-line' }, g);
      stringEls.push(g);
    }

    // Posts
    POSTS.forEach((p) => {
      el('circle', { cx: p.x, cy: p.y, r: 9, fill: '#d6dae0', stroke: '#6b7079', 'stroke-width': 2 }, headstock);
      el('circle', { cx: p.x, cy: p.y, r: 3, fill: '#6b7079' }, headstock);
    });

    // Tappable knobs
    POSTS.forEach((p, i) => {
      const kx = p.x + p.side * 72;
      const g = el('g', { class: 'peg', tabindex: 0, role: 'button' }, headstock);
      el('ellipse', { cx: kx, cy: p.y, rx: 28, ry: 32, class: 'knob' }, g);
      const label = el('text', { x: kx, y: p.y + 4, 'text-anchor': 'middle', class: 'knob-label' }, g);
      const oct = el('text', { x: kx, y: p.y + 18, 'text-anchor': 'middle', class: 'knob-oct' }, g);
      el('text', { x: kx, y: p.y - 38, 'text-anchor': 'middle', class: 'string-num' }, g).textContent = `String ${6 - i}`;
      el('text', { x: kx + p.side * -24, y: p.y - 22, 'text-anchor': 'middle', class: 'check' }, g).textContent = '✓';

      const open = () => openSheet(i);
      g.addEventListener('click', open);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });

      // Separate "listen" button beside the knob: tune only this string
      const bx = kx + p.side * 54;
      const lb = el('g', { class: 'listen-btn', tabindex: 0, role: 'button' }, headstock);
      el('circle', { cx: bx, cy: p.y, r: 20 }, lb);
      el('text', { x: bx, y: p.y + 6, 'text-anchor': 'middle', class: 'listen-icon' }, lb).textContent = '🎯';
      el('text', { x: bx, y: p.y + 34, 'text-anchor': 'middle', class: 'listen-text' }, lb).textContent = 'Tune';
      const listen = () => toggleListen(i);
      lb.addEventListener('click', listen);
      lb.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); listen(); } });

      pegEls.push({ g, label, oct, lb });
    });
  }

  function renderHeadstock() {
    pegEls.forEach((p, i) => {
      const m = state.notes[i];
      p.label.textContent = Notes.name(m);
      p.oct.textContent = Notes.octave(m);
      const listening = state.locked && i === state.selected;
      p.g.setAttribute('aria-label', `String ${6 - i}, ${Notes.label(m)}. Tap to change its note.`);
      p.lb.setAttribute('aria-label', listening
        ? `Listening to string ${6 - i}. Tap to go back to auto detect.`
        : `Tune string ${6 - i} only`);
      p.lb.setAttribute('aria-pressed', listening);
      p.lb.classList.toggle('on', listening);
      p.g.classList.toggle('active', i === state.selected);
      p.g.classList.toggle('tuned', state.tuned[i]);
      stringEls[i].querySelectorAll('line').forEach((l) => {
        l.classList.toggle('active', i === state.selected && !state.tuned[i]);
        l.classList.toggle('tuned', state.tuned[i]);
      });
    });
  }

  // ---------- Note picker sheet ----------
  const sheet = $('sheet');
  const noteGrid = $('noteGrid');

  Notes.NAMES.forEach((n, idx) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = n;
    b.addEventListener('click', () => {
      const m = state.notes[state.editing];
      setEditingNote(m - (((m % 12) + 12) % 12) + idx);
    });
    noteGrid.appendChild(b);
  });

  // Listen button: lock onto this string, or tap again to go back to auto.
  function toggleListen(i) {
    if (state.locked && state.selected === i) state.locked = false;
    else { state.selected = i; state.locked = true; }
    inTuneSince = 0;
    history = [];
    renderAll();
  }

  function openSheet(i) {
    state.editing = i;
    sheet.hidden = false;
    renderSheet();
    renderAll();
  }

  function closeSheet() {
    sheet.hidden = true;
    state.editing = -1;
  }

  function setEditingNote(m) {
    const i = state.editing;
    if (i < 0) return;
    m = Math.max(MIN_MIDI, Math.min(MAX_MIDI, m));
    if (m === state.notes[i]) return;
    state.notes[i] = m;
    state.tuned[i] = false;
    save();
    renderSheet();
    renderAll();
  }

  function renderSheet() {
    const i = state.editing;
    if (i < 0) return;
    const m = state.notes[i];
    $('sheetTitle').textContent = `String ${6 - i} — pick the note you want`;
    $('pickNote').innerHTML = `${Notes.name(m)}<small>${Notes.octave(m)}</small>`;
    $('pickFreq').textContent = `${Notes.midiToFreq(m).toFixed(2)} Hz`;
    [...noteGrid.children].forEach((b, idx) => b.classList.toggle('selected', idx === ((m % 12) + 12) % 12));
  }

  $('semiDown').addEventListener('click', () => setEditingNote(state.notes[state.editing] - 1));
  $('semiUp').addEventListener('click', () => setEditingNote(state.notes[state.editing] + 1));
  $('octDown').addEventListener('click', () => setEditingNote(state.notes[state.editing] - 12));
  $('octUp').addEventListener('click', () => setEditingNote(state.notes[state.editing] + 12));
  $('playRef').addEventListener('click', () => playTone(state.notes[state.editing]));
  sheet.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeSheet));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });

  // ---------- Reference tone ----------
  let outCtx = null;
  function playTone(midi) {
    outCtx = outCtx || audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (outCtx.state === 'suspended') outCtx.resume();
    const t = outCtx.currentTime;
    const f = Notes.midiToFreq(midi);
    const gain = outCtx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    gain.connect(outCtx.destination);
    [[1, 'triangle', 1], [2, 'sine', 0.35], [3, 'sine', 0.15]].forEach(([mult, type, vol]) => {
      const o = outCtx.createOscillator();
      const g = outCtx.createGain();
      o.type = type;
      o.frequency.value = f * mult;
      g.gain.value = vol;
      o.connect(g).connect(gain);
      o.start(t);
      o.stop(t + 2.3);
    });
  }

  // ---------- Gauge ----------
  const needle = $('needle');
  const polar = (cents, r) => {
    const a = (cents * 1.8) * Math.PI / 180; // ±50 cents → ±90°
    return [150 + r * Math.sin(a), 150 - r * Math.cos(a)];
  };

  function buildGauge() {
    const [x1, y1] = polar(-IN_TUNE_CENTS, 120);
    const [x2, y2] = polar(IN_TUNE_CENTS, 120);
    $('gaugeZone').setAttribute('d', `M${x1} ${y1} A120 120 0 0 1 ${x2} ${y2}`);
    const ticks = $('gaugeTicks');
    for (let c = -50; c <= 50; c += 5) {
      const major = c % 25 === 0;
      const [ax, ay] = polar(c, 104);
      const [bx, by] = polar(c, major ? 88 : 96);
      el('line', { x1: ax, y1: ay, x2: bx, y2: by, class: 'gauge-tick' + (major ? ' major' : '') }, ticks);
    }
  }

  function setNeedle(cents, cls) {
    const c = Math.max(-50, Math.min(50, cents));
    needle.setAttribute('transform', `rotate(${c * 1.8} 150 150)`);
    needle.setAttribute('class', 'needle ' + cls);
  }

  // ---------- Readout ----------
  const statusEl = $('status');
  const meterEl = document.querySelector('.meter');

  function setStatus(text, cls) {
    statusEl.textContent = text;
    statusEl.className = 'status ' + (cls || '');
  }

  function renderTarget() {
    const m = state.notes[state.selected];
    $('targetNote').innerHTML = `${Notes.name(m)}<small>${Notes.octave(m)}</small>`;
    const chip = $('modeChip');
    chip.textContent = state.locked ? `🎯 String ${6 - state.selected} only · tap for Auto` : 'Auto detect · tap 🎯 to pick a string';
    chip.classList.toggle('locked', state.locked);
    $('listenLabel').textContent = state.locked
      ? `Listening to String ${6 - state.selected} (${Notes.label(m)})`
      : 'Listening to any string';
  }

  $('modeChip').addEventListener('click', () => {
    state.locked = !state.locked;
    inTuneSince = 0;
    history = [];
    renderAll();
  });

  function renderAll() {
    renderSelect();
    renderHeadstock();
    renderTarget();
  }

  // ---------- Microphone + pitch tracking ----------
  let audioCtx = null, analyser = null, stream = null, buf = null, rafId = 0;
  let history = [];
  let lastPitchAt = 0;
  let inTuneSince = 0;

  async function startMic() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('Microphone not available. Open this page over https:// in a modern browser.', 'sharp');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (err) {
      setStatus('Microphone permission was blocked. Allow it in your browser settings and try again.', 'sharp');
      return;
    }
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    const src = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 4096;
    src.connect(analyser);
    buf = new Float32Array(analyser.fftSize);

    const btn = $('micButton');
    btn.textContent = '⏹ Stop listening';
    btn.classList.add('on');
    setStatus('Listening… pluck a string', '');
    history = [];
    rafId = requestAnimationFrame(tick);
  }

  function stopMic() {
    cancelAnimationFrame(rafId);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    analyser = null;
    const btn = $('micButton');
    btn.textContent = '🎤 Start listening';
    btn.classList.remove('on');
    setIdle('Tap “Start listening” and pluck a string');
  }

  $('micButton').addEventListener('click', () => (stream ? stopMic() : startMic()));

  function median(arr) {
    const s = arr.slice().sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  }

  function closestString(freq, current) {
    const midi = Notes.freqToMidi(freq);
    let best = 0, bestDist = Infinity;
    state.notes.forEach((m, i) => {
      const d = Math.abs(midi - m);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    // Stay on the current string unless another one is clearly closer
    if (current != null && best !== current && Math.abs(midi - state.notes[current]) - bestDist < 0.5) return current;
    return best;
  }

  // In locked mode, spot when a different string is being played.
  function otherStringPlayed(freq, i) {
    if (Math.abs(Notes.centsOff(freq, state.notes[i])) < 250) return -1;
    let found = -1, bestAbs = 60;
    state.notes.forEach((m, j) => {
      if (j === i) return;
      const a = Math.abs(Notes.centsOff(freq, m));
      if (a < bestAbs) { bestAbs = a; found = j; }
    });
    return found;
  }

  function setIdle(msg) {
    setNeedle(0, 'idle');
    $('freqText').textContent = '-- Hz';
    $('centsText').innerHTML = '&nbsp;';
    meterEl.classList.remove('in-tune');
    inTuneSince = 0;
    setStatus(msg, '');
  }

  function tick(now) {
    rafId = requestAnimationFrame(tick);
    if (!analyser) return;
    analyser.getFloatTimeDomainData(buf);

    const result = Pitch.rms(buf) >= MIN_RMS ? Pitch.detect(buf, audioCtx.sampleRate) : null;

    if (!result) {
      if (lastPitchAt && now - lastPitchAt > SILENCE_MS) {
        lastPitchAt = 0;
        history = [];
        setIdle('Listening… pluck a string');
      }
      return;
    }

    // Reset smoothing if the pitch jumps (new string plucked)
    if (history.length && Math.abs(Notes.freqToMidi(result.freq) - Notes.freqToMidi(median(history))) > 1) history = [];
    history.push(result.freq);
    if (history.length > 7) history.shift();
    lastPitchAt = now;

    const freq = median(history);
    handlePitch(freq, now);
  }

  function handlePitch(freq, now) {
    if (!state.locked) {
      const idx = closestString(freq, state.selected);
      if (idx !== state.selected) {
        state.selected = idx;
        inTuneSince = 0;
        renderHeadstock();
        renderTarget();
      }
    }

    const i = state.selected;
    const target = state.notes[i];
    const cents = Notes.centsOff(freq, target);
    const abs = Math.abs(cents);
    const heard = Math.round(Notes.freqToMidi(freq));

    $('freqText').textContent = `${freq.toFixed(1)} Hz`;
    const rounded = Math.round(cents);
    const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '';
    let centsLine = `${sign}${Math.abs(rounded)} cents`;
    if (heard !== target) centsLine += ` · hearing ${Notes.label(heard)}`;
    $('centsText').textContent = centsLine;

    if (state.locked) {
      const other = otherStringPlayed(freq, i);
      if (other >= 0) {
        inTuneSince = 0;
        meterEl.classList.remove('in-tune');
        setNeedle(0, 'idle');
        setStatus(`That sounds like String ${6 - other} — pluck String ${6 - i} (${Notes.label(target)})`, 'close');
        return;
      }
    }

    if (abs <= IN_TUNE_CENTS) {
      setNeedle(cents, 'good');
      if (!inTuneSince) inTuneSince = now;
      if (now - inTuneSince >= HOLD_MS) {
        if (!state.tuned[i]) {
          state.tuned[i] = true;
          if (navigator.vibrate) navigator.vibrate(60);
          renderHeadstock();
        }
        meterEl.classList.add('in-tune');
        setStatus(`✓ In tune! String ${6 - i} is on ${Notes.label(target)}`, 'good');
      } else {
        setStatus('Hold it…', 'close');
      }
      return;
    }

    inTuneSince = 0;
    meterEl.classList.remove('in-tune');
    if (abs > CLOSE_CENTS && state.tuned[i]) {
      state.tuned[i] = false;
      renderHeadstock();
    }

    const dir = cents < 0 ? 'Tune up ↑ (too flat)' : 'Tune down ↓ (too sharp)';
    if (abs <= CLOSE_CENTS) {
      setNeedle(cents, 'close');
      setStatus('Almost — ' + dir.split(' (')[0].toLowerCase(), 'close');
    } else {
      setNeedle(cents, '');
      setStatus(dir, cents < 0 ? 'flat' : 'sharp');
    }
  }

  // ---------- Boot ----------
  load();
  buildGauge();
  buildHeadstock();
  renderAll();
  setNeedle(0, 'idle');
})();

/* Americano Padel Score App (4 players) */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const vibrate = pat => { if (navigator.vibrate) navigator.vibrate(pat); };

const stateKey = 'americano:v2'; // bump key for new mode

let model = {
  players: ["A","B","C","D"],
  pointsTo: 21,          // X
  mode: 'total',         // 'total' | 'first'
  winBy2: false,         // only used in 'first'
  matches: [],           // [{t1:[i,j], t2:[k,l], s1:0, s2:0, done:false, history:[]}]
  totals: [0,0,0,0],
  current: 0,
  createdAt: new Date().toISOString()
};

function makeSchedule() {
  // AB vs CD, AC vs BD, AD vs BC
  return [
    { t1:[0,1], t2:[2,3], s1:0, s2:0, done:false, history:[] },
    { t1:[0,2], t2:[1,3], s1:0, s2:0, done:false, history:[] },
    { t1:[0,3], t2:[1,2], s1:0, s2:0, done:false, history:[] }
  ];
}

function save() { localStorage.setItem(stateKey, JSON.stringify(model)); }
function load() {
  const raw = localStorage.getItem(stateKey);
  if (raw) {
    try {
      const m = JSON.parse(raw);
      if (Array.isArray(m.players) && m.matches?.length === 3) {
        model = m;
        return true;
      }
    } catch(e){}
  }
  return false;
}

function resetTournament() {
  model.matches = makeSchedule();
  model.totals = [0,0,0,0];
  model.current = 0;
  model.createdAt = new Date().toISOString();
}

function setView(id) {
  $$("#app .view").forEach(v => v.hidden = true);
  $(id).hidden = false;
}

function updateTotalsTable() {
  const tbody = $("#tableTotals tbody");
  tbody.innerHTML = "";
  model.players.forEach((name, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${name}</td><td>${model.totals[idx]}</td>`;
    tbody.appendChild(tr);
  });
}

function pairingText(m) {
  const n = model.players;
  return `${n[m.t1[0]]} + ${n[m.t1[1]]}  vs  ${n[m.t2[0]]} + ${n[m.t2[1]]}`;
}

function ruleText() {
  if (model.mode === 'total') {
    return `Total ${model.pointsTo} (summen av poeng)`;
  } else {
    return `Først til ${model.pointsTo}` + (model.winBy2 ? " (må vinne med 2)" : "");
  }
}

function renderMatch() {
  const m = model.matches[model.current];
  $("#matchNum").textContent = (model.current+1);
  $("#matchTotal").textContent = model.matches.length;
  $("#pairingTxt").textContent = pairingText(m);
  $("#ruleText").textContent = ruleText();
  $("#team1Names").textContent = `${model.players[m.t1[0]]} + ${model.players[m.t1[1]]}`;
  $("#team2Names").textContent = `${model.players[m.t2[0]]} + ${model.players[m.t2[1]]}`;
  $("#score1").textContent = m.s1;
  $("#score2").textContent = m.s2;
  $("#nextBtn").disabled = !m.done || (model.current === model.matches.length-1);
  updateTotalsTable();
}

function isWinCondition(s1, s2) {
  const target = model.pointsTo;
  if (model.mode === 'total') {
    return (s1 + s2) >= target;
  } else {
    if (model.winBy2) {
      return (s1 >= target || s2 >= target) && Math.abs(s1 - s2) >= 2;
    } else {
      return s1 >= target || s2 >= target;
    }
  }
}

function applyPoint(team, delta) {
  const m = model.matches[model.current];
  if (m.done && delta > 0) return; // don't add after done

  if (team === 1) {
    let next = m.s1 + delta;
    if (delta > 0 && model.mode === 'total') {
      const rem = model.pointsTo - (m.s1 + m.s2);
      if (rem <= 0) return;
      next = m.s1 + Math.min(delta, rem);
    }
    m.s1 = Math.max(0, next);
  } else {
    let next = m.s2 + delta;
    if (delta > 0 && model.mode === 'total') {
      const rem = model.pointsTo - (m.s1 + m.s2);
      if (rem <= 0) return;
      next = m.s2 + Math.min(delta, rem);
    }
    m.s2 = Math.max(0, next);
  }

  m.history.push({team, delta});
  if (delta > 0) vibrate(8);

  if (isWinCondition(m.s1, m.s2)) {
    $("#finishBtn").classList.add("pulse");
  } else {
    $("#finishBtn").classList.remove("pulse");
  }
  m.done = false;
  $("#nextBtn").disabled = true;
  renderMatch();
  save();
}

function undo() {
  const m = model.matches[model.current];
  const last = m.history.pop();
  if (!last) return;
  if (last.team === 1) m.s1 = Math.max(0, m.s1 - last.delta);
  else m.s2 = Math.max(0, m.s2 - last.delta);
  m.done = false;
  $("#finishBtn").classList.remove("pulse");
  vibrate([8,20,8]);
  renderMatch();
  save();
}

function finishMatch() {
  const m = model.matches[model.current];
  if (!isWinCondition(m.s1, m.s2)) {
    alert(model.mode === 'total'
      ? `Kampen er ikkje ferdig. Totalen må bli ${model.pointsTo}.`
      : `Kampen er ikkje ferdig. Spel til ${model.pointsTo}` + (model.winBy2 ? " og med 2 i differanse." : "."));
    return;
  }
  // Add points to each player's totals
  m.t1.forEach(i => model.totals[i] += m.s1);
  m.t2.forEach(i => model.totals[i] += m.s2);
  m.done = true;
  $("#nextBtn").disabled = (model.current === model.matches.length-1) ? true : false;
  $("#finishBtn").classList.remove("pulse");
  vibrate([12,30,12]);
  renderMatch();
  save();
  if (model.current === model.matches.length - 1) {
    toSummary();
  }
}

function nextMatch() {
  if (model.current < model.matches.length - 1) {
    model.current++;
    renderMatch();
    save();
  }
}

function resetCurrentMatch() {
  const m = model.matches[model.current];
  m.s1 = 0; m.s2 = 0; m.done = false; m.history = [];
  $("#finishBtn").classList.remove("pulse");
  renderMatch();
  save();
}

function startTournament(e) {
  e.preventDefault();
  const p = [
    $("#p0").value.trim() || "A",
    $("#p1").value.trim() || "B",
    $("#p2").value.trim() || "C",
    $("#p3").value.trim() || "D"
  ];
  const pts = Math.max(5, Math.min(99, parseInt($("#pointsTo").value || "21", 10)));
  const mode = $("#mode").value;
  const wb2 = $("#winBy2").checked;

  model.players = p;
  model.pointsTo = pts;
  model.mode = mode;
  model.winBy2 = mode === 'first' ? wb2 : false;
  resetTournament();
  save();
  toMatch();
}

function toMatch() {
  setView("#matchView");
  renderMatch();
}

function toSummary() {
  setView("#summaryView");
  const order = model.players.map((name, idx) => ({name, pts: model.totals[idx]}))
    .sort((a,b) => b.pts - a.pts);
  const ol = $("#leaderboard");
  ol.innerHTML = "";
  order.forEach((row, i) => {
    const li = document.createElement("li");
    li.textContent = `${i+1}. ${row.name} — ${row.pts}`;
    ol.appendChild(li);
  });
  const ml = $("#matchList");
  ml.innerHTML = "";
  model.matches.forEach((m, idx) => {
    const li = document.createElement("li");
    li.textContent = `Kamp ${idx+1}: ${pairingText(m)} — ${m.s1}–${m.s2}`;
    ml.appendChild(li);
  });
}

function shareResults() {
  const title = "Americano resultat";
  const lines = [];
  lines.push(`Turnering starta: ${new Date(model.createdAt).toLocaleString()}`);
  lines.push(`Regel: ${ruleText()}`);
  model.matches.forEach((m, idx) => {
    lines.push(`Kamp ${idx+1}: ${pairingText(m)} — ${m.s1}–${m.s2}`);
  });
  const totalStr = model.players
    .map((n,i) => `${n}: ${model.totals[i]}`)
    .join(", ");
  lines.push(`Totalt: ${totalStr}`);
  const text = lines.join("\n");

  if (navigator.share) {
    navigator.share({ title, text })
      .catch(()=>{});
  } else {
    navigator.clipboard.writeText(text).then(() => {
      alert("Resultat kopiert til utklippstavla.");
    });
  }
}

// Install prompt handling
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $("#installBtn").hidden = false;
});

$("#installBtn").addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  $("#installBtn").hidden = true;
  deferredPrompt = null;
});

// Bindings
$("#setupForm").addEventListener("submit", startTournament);
$("#mode").addEventListener("change", () => {
  const showWB2 = $("#mode").value === 'first';
  $("#winBy2Row").hidden = !showWB2;
});

$$(".scoreBtn").forEach(btn => btn.addEventListener("click", () => {
  const team = parseInt(btn.dataset.team, 10);
  const delta = parseInt(btn.dataset.delta, 10);
  applyPoint(team, delta);
}));
$("#undoBtn").addEventListener("click", undo);
$("#finishBtn").addEventListener("click", finishMatch);
$("#nextBtn").addEventListener("click", nextMatch);
$("#resetMatchBtn").addEventListener("click", resetCurrentMatch);
$("#shareBtn").addEventListener("click", shareResults);
$("#exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(model, null, 2)], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "americano-resultat.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 500);
});
$("#newBtn").addEventListener("click", () => {
  localStorage.removeItem(stateKey);
  location.reload();
});

// Boot
if (load()) {
  if (model.current >= model.matches.length) model.current = model.matches.length - 1;
  setView("#matchView");
  renderMatch();
} else {
  setView("#setupView");
  // Ensure correct initial visibility
  $("#winBy2Row").hidden = $("#mode").value !== 'first';
}

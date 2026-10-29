"use strict";
const $ = id => document.getElementById(id);
const E = {
  editor:$("editor"), prompt:$("prompt"), title:$("title"), script:$("script"),
  font:$("font"), width:$("width"), speed:$("speed"), saved:$("saved"),
  cur:$("current"), prev:$("prev"), next:$("next"), state:$("state"), net:$("net"),
  promptTitle:$("promptTitle"), pause:$("pause"), mic:$("mic"),
  fontVal:$("fontVal"), widthVal:$("widthVal"), speedVal:$("speedVal"),
  fontPreview:$("fontPreview"), widthPreview:$("widthPreview"), speedPreview:$("speedPreview")
};
const KEY = "prompterScripts", DRAFT = "prompterDraft";
const WORDS_PER_SEC = 2.5;   // vitesse de base (×1.0) : ~150 mots/minute
const MIN_SECONDS = 2;       // durée minimale d'un bloc

let cues = [], i = 0, running = false, timer = null;
let rec = null, voice = false, wakeLock = null, finished = false;

/* ---------- Script / réglages ---------- */
function split(t){ return t.split(/\n\s*\n+/).map(x => x.trim()).filter(Boolean); }
function speedValue(){ return Number(E.speed.value) / 10; }
function blockSeconds(text){
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(MIN_SECONDS, words / (WORDS_PER_SEC * speedValue()));
}
function applyVars(){
  const r = document.documentElement.style;
  r.setProperty("--fs", E.font.value + "px");
  r.setProperty("--w", E.width.value + "%");
}
function updatePreviews(){
  applyVars();
  E.fontVal.textContent = E.font.value + " px";
  E.fontPreview.style.fontSize = E.font.value + "px";
  E.widthVal.textContent = E.width.value + " %";
  E.widthPreview.style.width = E.width.value + "%";
  E.speedVal.textContent = speedValue().toFixed(1) + "×";
  const blocks = split(E.script.value);
  if (blocks.length){
    const avg = blocks.reduce((s,b) => s + blockSeconds(b), 0) / blocks.length;
    E.speedPreview.textContent = `Chaque phrase reste affichée environ ${avg.toFixed(1)} s (moyenne de ton script).`;
  } else {
    E.speedPreview.textContent = `Une phrase de 10 mots reste affichée environ ${blockSeconds("un deux trois quatre cinq six sept huit neuf dix").toFixed(1)} s.`;
  }
}

/* ---------- Téléprompteur ---------- */
function render(){
  E.prev.textContent = cues[i-1] || "";
  E.cur.textContent  = cues[i] || "";
  E.next.textContent = cues[i+1] || "";
  applyVars();
  E.pause.textContent = running ? "⏸" : "▶";
  E.pause.setAttribute("aria-label", running ? "Pause" : "Lecture");
  E.state.textContent = `${i+1} / ${cues.length}` + (finished ? "  •  fin du script" : running ? "" : "  •  pause");
}
function schedule(){
  clearTimeout(timer); timer = null;
  if (!running || !cues.length) return;
  timer = setTimeout(() => { next(true); }, blockSeconds(cues[i]) * 1000);
}
function next(auto){
  if (i < cues.length - 1){ i++; finished = false; render(); schedule(); }
  else { finished = true; running = false; clearTimeout(timer); render(); }
}
function back(){
  if (i > 0){ i--; finished = false; render(); schedule(); }
}
function play(){
  if (finished){ i = 0; finished = false; }
  running = true; render(); schedule(); lockScreen();
}
function pause(){ running = false; clearTimeout(timer); render(); }
function togglePause(){ running ? pause() : play(); }

function start(){
  cues = split(E.script.value);
  if (!cues.length){ alert("Ajoute un script (sépare les phrases par une ligne vide)."); return; }
  i = 0; finished = false;
  E.promptTitle.textContent = E.title.value.trim() || "Sans titre";
  E.editor.classList.add("hidden");
  E.prompt.classList.remove("hidden");
  window.scrollTo(0, 0);
  play();   // lecture active immédiatement
  try { const p = document.documentElement.requestFullscreen?.(); p && p.catch && p.catch(() => {}); } catch {}
}
function exit(){
  pause(); stopVoice(true); unlockScreen();
  E.prompt.classList.add("hidden");
  E.editor.classList.remove("hidden");
  try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch {}
}

/* ---------- Écran toujours allumé (si disponible) ---------- */
async function lockScreen(){
  try { if ("wakeLock" in navigator && !wakeLock) {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => { wakeLock = null; });
  } } catch {}
}
function unlockScreen(){ try { wakeLock?.release(); } catch {} wakeLock = null; }
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !E.prompt.classList.contains("hidden")) lockScreen();
});

/* ---------- Sauvegarde ---------- */
function getAll(){ try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }
function setAll(a){ try { localStorage.setItem(KEY, JSON.stringify(a.slice(0, 30))); } catch { alert("Impossible de sauvegarder (stockage plein ou bloqué)."); } }
function save(){
  const title = E.title.value.trim() || "Sans titre";
  const all = getAll().filter(x => x.title !== title);
  all.unshift({ title, script:E.script.value, font:E.font.value, width:E.width.value, speed:E.speed.value });
  setAll(all); drawSaved();
}
function drawSaved(){
  const all = getAll();
  E.saved.innerHTML = all.map((x,n) =>
    `<div class="item"><span>${esc(x.title)}</span><button data-load="${n}">Charger</button><button data-del="${n}" aria-label="Supprimer">🗑</button></div>`).join("");
  E.saved.querySelectorAll("[data-load]").forEach(b => b.onclick = () => {
    const x = all[+b.dataset.load];
    E.title.value = x.title; E.script.value = x.script;
    if (x.font) E.font.value = x.font;
    if (x.width) E.width.value = Math.min(95, Math.max(40, x.width));
    // anciennes sauvegardes : vitesse entre 20 et 120 → on remet 1.0×
    if (x.speed && Number(x.speed) <= 30) E.speed.value = x.speed; else E.speed.value = 10;
    updatePreviews(); saveDraft();
  });
  E.saved.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    const x = all[+b.dataset.del];
    if (confirm(`Supprimer « ${x.title} » ?`)){ all.splice(+b.dataset.del, 1); setAll(all); drawSaved(); }
  });
}
function esc(s){ return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }

/* brouillon automatique (pour ne rien perdre si l'app se ferme) */
function saveDraft(){
  try { localStorage.setItem(DRAFT, JSON.stringify({ title:E.title.value, script:E.script.value, font:E.font.value, width:E.width.value, speed:E.speed.value })); } catch {}
}
function loadDraft(){
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT) || "null"); if (!d) return;
    E.title.value = d.title || ""; E.script.value = d.script || "";
    if (d.font) E.font.value = d.font;
    if (d.width) E.width.value = d.width;
    if (d.speed && Number(d.speed) <= 30) E.speed.value = d.speed;
  } catch {}
}

/* ---------- Commandes vocales ---------- */
function norm(t){ return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function command(raw){
  const t = norm(raw);
  if (/reprendre|continue|reprends|lecture|play/.test(t)) play();
  else if (/pause|stop|arret/.test(t)) pause();
  else if (/precedente|precedent|retour|recule|reviens/.test(t)) { back(); if (running) schedule(); }
  else if (/suivante|suivant|avance/.test(t)) next();
}
function setMicState(on){ voice = on; E.mic.classList.toggle("on", on); }
function stopVoice(silent){
  const was = voice; setMicState(false);
  try { rec?.stop(); } catch {}
  rec = null;
  if (was && !silent) E.state.textContent = "Micro coupé";
}
function toggleVoice(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR){ E.state.textContent = "Reconnaissance vocale non disponible dans ce navigateur"; return; }
  if (voice){ stopVoice(); return; }
  try {
    rec = new SR(); rec.lang = "fr-FR"; rec.continuous = true; rec.interimResults = false;
    rec.onresult = e => { for (let j = e.resultIndex; j < e.results.length; j++) if (e.results[j].isFinal) command(e.results[j][0].transcript); };
    rec.onend = () => { if (voice) { try { rec.start(); } catch {} } };
    rec.onerror = e => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed"){ stopVoice(true); E.state.textContent = "Micro refusé : autorise-le dans les réglages"; }
      else if (e.error === "network"){ stopVoice(true); E.state.textContent = "Reconnaissance vocale : Internet requis"; }
      else if (e.error !== "no-speech" && e.error !== "aborted"){ E.state.textContent = "Micro : erreur (" + e.error + ")"; }
    };
    setMicState(true); rec.start();
    E.state.textContent = "🎙 Écoute des commandes";
  } catch { stopVoice(true); E.state.textContent = "Reconnaissance vocale indisponible"; }
}

/* ---------- Événements ---------- */
$("start").addEventListener("click", start);
$("save").addEventListener("click", save);
$("clear").addEventListener("click", () => { E.title.value = ""; E.script.value = ""; updatePreviews(); saveDraft(); });
$("exit").addEventListener("click", exit);
$("forward").addEventListener("click", () => { next(); if (cues.length && !finished) play(); });
$("back").addEventListener("click", () => { back(); play(); });
$("pause").addEventListener("click", togglePause);
$("mic").addEventListener("click", toggleVoice);
[E.font, E.width, E.speed].forEach(x => x.addEventListener("input", () => { updatePreviews(); saveDraft(); }));
[E.title, E.script].forEach(x => x.addEventListener("input", () => { saveDraft(); if (x === E.script) updatePreviews(); }));

function netState(){ const on = navigator.onLine; E.net.textContent = on ? "● en ligne" : "● hors ligne"; E.net.classList.toggle("off", !on); }
window.addEventListener("online", netState); window.addEventListener("offline", netState);

/* ---------- Init ---------- */
loadDraft(); drawSaved(); updatePreviews(); netState();
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));

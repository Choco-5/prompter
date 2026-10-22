const $=id=>document.getElementById(id);
const E={editor:$("editor"),prompt:$("prompt"),title:$("title"),script:$("script"),font:$("font"),width:$("width"),speed:$("speed"),saved:$("saved"),cur:$("current"),prev:$("prev"),next:$("next"),state:$("state"),net:$("net")};
let cues=[],i=0,running=false,timer=null,rec=null,voice=false;

function split(t){return t.split(/\n\s*\n+/).map(x=>x.trim()).filter(Boolean)}
function vars(){document.documentElement.style.setProperty("--fs",E.font.value+"px");document.documentElement.style.setProperty("--w",E.width.value+"%")}
function render(){E.prev.textContent=cues[i-1]||"";E.cur.textContent=cues[i]||"Fin du script";E.next.textContent=cues[i+1]||"";vars();E.state.textContent=`${Math.min(i+1,cues.length)} / ${cues.length}${running?"  •  lecture":""}`}
function next(){if(i<cues.length-1){i++;render()}else stop()}
function back(){if(i>0){i--;render()}}
function loop(){clearInterval(timer);timer=setInterval(()=>{if(running)next()},Math.max(3000,160000/Number(E.speed.value)))}
function start(){cues=split(E.script.value);if(!cues.length)return alert("Ajoute un script.");i=0;E.promptTitle.textContent=E.title.value||"Sans titre";E.editor.classList.add("hidden");E.prompt.classList.remove("hidden");running=false;render();loop();document.documentElement.requestFullscreen?.().catch(()=>{})}
function stop(){running=false;clearInterval(timer);render()}
function save(){let title=E.title.value.trim()||"Sans titre";let all=JSON.parse(localStorage.getItem("prompterScripts")||"[]");all=all.filter(x=>x.title!==title);all.unshift({title,script:E.script.value,font:E.font.value,width:E.width.value,speed:E.speed.value});localStorage.setItem("prompterScripts",JSON.stringify(all.slice(0,20)));drawSaved()}
function drawSaved(){let all=JSON.parse(localStorage.getItem("prompterScripts")||"[]");E.saved.innerHTML=all.map((x,n)=>`<div><span>${esc(x.title)}</span><button data-load="${n}">Charger</button></div>`).join("");E.saved.querySelectorAll("[data-load]").forEach(b=>b.onclick=()=>{let x=all[+b.dataset.load];E.title.value=x.title;E.script.value=x.script;E.font.value=x.font;E.width.value=x.width;E.speed.value=x.speed;vars()})}
function esc(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function command(t){t=t.toLowerCase();if(/phrase (suivante|suivante)|suivante|avance/.test(t))next();else if(/phrase précédente|phrase precedente|précédente|precedente|retour|recule/.test(t))back();else if(/pause|stop/.test(t)){running=false;render()}else if(/reprendre|continue/.test(t)){running=true;render()}}

$("start").onclick=start;$("save").onclick=save;$("clear").onclick=()=>{E.title.value="";E.script.value=""};
$("exit").onclick=()=>{stop();E.prompt.classList.add("hidden");E.editor.classList.remove("hidden");document.exitFullscreen?.().catch(()=>{})};
$("forward").onclick=()=>{next();running=true};$("back").onclick=()=>{back();running=true};
$("pause").onclick=()=>{running=!running;render()};[E.font,E.width,E.speed].forEach(x=>x.oninput=()=>{vars();if(x===E.speed)loop()});
$("mic").onclick=toggleVoice;
window.addEventListener("offline",()=>E.net.textContent="● hors ligne");
window.addEventListener("online",()=>E.net.textContent="● en ligne");
function toggleVoice(){
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR){E.state.textContent="Reconnaissance vocale indisponible dans ce navigateur";return}
 if(voice){rec?.stop();voice=false;E.state.textContent="Micro coupé";return}
 rec=new SR();rec.lang="fr-FR";rec.continuous=true;rec.interimResults=false;
 rec.onresult=e=>{for(let j=e.resultIndex;j<e.results.length;j++)if(e.results[j].isFinal)command(e.results[j][0].transcript)};
 rec.onend=()=>{if(voice)try{rec.start()}catch{}};
 rec.onerror=()=>{E.state.textContent="Micro : erreur / permission"};voice=true;rec.start();E.state.textContent="🎙 Écoute des commandes"; 
}
drawSaved();vars();
if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js");

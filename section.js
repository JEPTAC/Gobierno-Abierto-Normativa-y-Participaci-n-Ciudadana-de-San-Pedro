import { SITE_CONFIG, PUBLICATIONS, CONTROL_ENTITIES, AGENDA_CHANGES } from "./data/seed-data.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (v = "") => String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const norm = (v = "") => String(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const safe = (v = "") => { try { const u = new URL(v, location.href); return ["http:", "https:"].includes(u.protocol) ? u.href : "#"; } catch { return "#"; } };
const fmt = (v) => { if (!v) return "Sin fecha"; const d = new Date(`${v}T12:00:00`); return Number.isNaN(d.getTime()) ? v : new Intl.DateTimeFormat("es-CO", { year: "numeric", month: "short", day: "numeric" }).format(d); };
const category = document.body.dataset.category;
let items = PUBLICATIONS.filter((x) => (category === "sucop" ? ["agenda", "decision"].includes(x.category) : x.category === category) && x.published !== false).sort((a,b)=>(a.order??999)-(b.order??999));

const labels = {
  decision: { singular: "decisión", total: "Decisiones publicadas" },
  supervision: { singular: "mecanismo", total: "Mecanismos publicados" },
  cv: { singular: "proceso", total: "Procesos registrados" },
  gaceta: { singular: "registro", total: "Registros en la Gaceta" },
  agenda: { singular: "iniciativa", total: "Iniciativas regulatorias" }
};

function statusClass(status = "") {
  const s = norm(status);
  if (/vigente|activo|abierto|ejecucion|publicado/.test(s)) return "status-active";
  if (/finalizado|historico|cerrado|derogado/.test(s)) return "status-closed";
  if (/tramite|planeado|programado|pendiente|sin proceso/.test(s)) return "status-pending";
  return "status-neutral";
}

function link(url, text) { return url ? `<a href="${safe(url)}" target="_blank" rel="noopener noreferrer">${esc(text)} ↗</a>` : ""; }

function card(x) {
  return `<article class="record-card">
    <div class="record-topline"><span class="record-type">${esc(x.recordType || "Publicación")}</span><span class="status ${statusClass(x.status)}">${esc(x.status || "Publicado")}</span></div>
    <h3>${esc(x.title)}</h3><p>${esc(x.summary || "")}</p>
    <dl class="record-meta">${x.number ? `<div><dt>Referencia</dt><dd>${esc(x.number)}</dd></div>` : ""}${x.date ? `<div><dt>Fecha</dt><dd>${fmt(x.date)}</dd></div>` : ""}${x.responsible ? `<div><dt>Responsable</dt><dd>${esc(x.responsible)}</dd></div>` : ""}</dl>
    ${x.legalBasis ? `<div class="card-evidence"><strong>Fundamento:</strong> ${esc(x.legalBasis)}</div>` : ""}
    ${x.start || x.end ? `<div class="cv-period"><strong>Periodo de observaciones:</strong> ${x.start ? fmt(x.start) : "Por definir"} — ${x.end ? fmt(x.end) : "Abierto"}</div>` : ""}
    <div class="record-actions">${link(x.documentUrl, "Abrir documento o publicación")}${link(x.sourceUrl, "Repositorio de origen")}</div>
  </article>`;
}

function renderCards(filtered) {
  const target = $("#sectionResults");
  if (!target) return;
  if (category === "gaceta") return renderGaceta(filtered, target);
  if (category === "agenda") return renderAgenda(filtered, target);
  target.innerHTML = filtered.length ? filtered.map(card).join("") : `<div class="no-results">No se encontraron resultados con los filtros seleccionados.</div>`;
}

function renderGaceta(filtered, target) {
  target.innerHTML = `<div class="standalone-table-wrap"><table class="standalone-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Número</th><th>Acto / publicación</th><th>Estado</th><th>Acceso</th></tr></thead><tbody>${filtered.map(x=>`<tr><td>${x.date?fmt(x.date):esc(x.year)}</td><td>${esc(x.recordType)}</td><td><strong>${esc(x.number||"Sin número")}</strong></td><td><strong>${esc(x.title)}</strong><small>${esc(x.summary||"")}</small></td><td><span class="status ${statusClass(x.status)}">${esc(x.status)}</span></td><td>${link(x.documentUrl,"Abrir")}</td></tr>`).join("")}</tbody></table></div>`;
}

function renderAgenda(filtered, target) {
  const ordered = [...filtered].sort((a,b)=>String(a.date||a.start||"").localeCompare(String(b.date||b.start||"")));
  target.innerHTML = `<div class="standalone-timeline">${ordered.map(x=>`<article><div class="date-box"><strong>${x.date ? new Date(`${x.date}T12:00:00`).getDate() : "—"}</strong><span>${x.date ? new Intl.DateTimeFormat("es-CO",{month:"short"}).format(new Date(`${x.date}T12:00:00`)) : "Agenda"}</span></div>${card(x)}</article>`).join("")}</div>${AGENDA_CHANGES.length?`<div class="section-requirements"><h2>Historial de cambios</h2><ul>${AGENDA_CHANGES.map(c=>`<li><strong>${fmt(c.date)} · ${esc(c.type)}:</strong> ${esc(c.description)}</li>`).join("")}</ul></div>`:""}`;
}

function updateSummary(filtered) {
  $("#summaryTotal").textContent = String(filtered.length);
  $("#summaryCurrent").textContent = String(filtered.filter(x=>/vigente|activo|abierto|ejecucion|publicado/i.test(x.status||"")).length);
  $("#summaryYear").textContent = String(new Set(filtered.map(x=>x.year).filter(Boolean)).size);
}

function filter() {
  const q = norm($("#sectionSearch")?.value || "");
  const year = $("#sectionYear")?.value || "";
  const status = $("#sectionStatus")?.value || "";
  const filtered = items.filter(x => {
    const hay = norm([x.title,x.summary,x.number,x.responsible,x.legalBasis,x.impact,...(x.tags||[])].join(" "));
    return (!q || hay.includes(q)) && (!year || String(x.year)===year) && (!status || x.status===status);
  });
  renderCards(filtered); updateSummary(filtered);
}

function initFilters() {
  const years=[...new Set(items.map(x=>String(x.year||"")).filter(Boolean))].sort().reverse();
  const statuses=[...new Set(items.map(x=>x.status).filter(Boolean))].sort();
  $("#sectionYear").innerHTML=`<option value="">Todos</option>${years.map(x=>`<option>${esc(x)}</option>`).join("")}`;
  $("#sectionStatus").innerHTML=`<option value="">Todos</option>${statuses.map(x=>`<option>${esc(x)}</option>`).join("")}`;
  ["#sectionSearch","#sectionYear","#sectionStatus"].forEach(s=>$(s)?.addEventListener(s==="#sectionSearch"?"input":"change",filter));
  $("#sectionClear")?.addEventListener("click",()=>{ $("#sectionSearch").value=""; $("#sectionYear").value=""; $("#sectionStatus").value=""; filter(); });
}

function renderControlEntities() {
  const target=$("#controlEntityTable"); if(!target) return;
  target.innerHTML=`<div class="standalone-table-wrap"><table class="standalone-table"><thead><tr><th>Entidad</th><th>Tipo de control</th><th>Alcance</th><th>Canal</th><th>Enlace</th></tr></thead><tbody>${CONTROL_ENTITIES.map(x=>`<tr><td><strong>${esc(x.name)}</strong></td><td>${esc(x.controlType)}</td><td>${esc(x.scope)}</td><td>${esc(x.channel)}</td><td>${link(x.url,"Consultar")}</td></tr>`).join("")}</tbody></table></div>`;
}

function renderSucopPage() {
  const status=$("#sucopPageStatus"); if(!status) return;
  status.innerHTML=`<div class="sucop-status-full"><div class="status-orb">EN</div><p class="overline">Estado institucional</p><h2>Habilitación del usuario SUCOP en trámite</h2><p>${esc(SITE_CONFIG.sucopStatus)}</p><div class="record-actions">${link(SITE_CONFIG.sucopSearch,"Consultar buscador público de SUCOP")}${link(SITE_CONFIG.participa,"Menú Participa municipal")}</div></div><div class="participation-cta"><p class="overline">Canal complementario activo</p><h2>La participación normativa continúa habilitada</h2><p>Mientras se formaliza la habilitación del usuario institucional, la ciudadanía puede consultar proyectos y remitir observaciones mediante la micropágina y los canales de la sede electrónica.</p><a class="btn btn-primary" href="index.html#participar">Radicar una observación</a></div>`;
}

function init() {
  $("#lastUpdatedPage").textContent=fmt(SITE_CONFIG.lastUpdated);
  $("#sectionTotalLabel").textContent=labels[category]?.total||"Publicaciones";
  initFilters(); filter(); renderControlEntities(); renderSucopPage();
}
document.addEventListener("DOMContentLoaded",init);

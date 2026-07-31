import {
  SITE_CONFIG,
  PUBLICATIONS as SEED_PUBLICATIONS,
  AGENDA_CHANGES,
  CONTROL_ENTITIES,
  GLOSSARY,
  SOURCE_REGISTRY
} from "./data/seed-data.js";
import { FIREBASE_CONFIG, COLLECTIONS } from "./firebase-config.js";

const state = {
  publications: [...SEED_PUBLICATIONS],
  config: { ...SITE_CONFIG },
  firebase: null,
  user: null,
  admin: null,
  adminView: "dashboard",
  currentRecord: null
};

const CATEGORY_LABELS = Object.freeze({
  decision: "Decisión de impacto",
  supervision: "Mecanismo de supervisión",
  cv: "Hoja de vida / convocatoria",
  gaceta: "Gaceta Oficial",
  agenda: "Agenda regulatoria"
});

const CATEGORY_COLORS = Object.freeze({
  decision: "blue",
  supervision: "green",
  cv: "gold",
  gaceta: "violet",
  agenda: "cyan"
});

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const storage = {
  get(key, fallback = null) {
    try { return window.localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { window.localStorage.setItem(key, value); return true; } catch { return false; }
  }
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value = "") {
  try {
    const url = new URL(value, window.location.href);
    if (!["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) return "#";
    return url.href;
  } catch {
    return "#";
  }
}

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatDate(value, options = {}) {
  if (!value) return "No registrada";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return new Intl.DateTimeFormat("es-CO", {
    year: "numeric",
    month: options.short ? "short" : "long",
    day: "numeric"
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return "Sin fecha";
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function getPublished(category) {
  return state.publications
    .filter((item) => item.published !== false && (!category || item.category === category))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || String(b.date || "").localeCompare(String(a.date || "")));
}

function statusClass(status = "") {
  const normalized = normalizeText(status);
  if (/vigente|activo|abierto|ejecucion|publicado/.test(normalized)) return "status-active";
  if (/finalizado|historico|cerrado|derogado|incorporado/.test(normalized)) return "status-closed";
  if (/tramite|planeado|programado|pendiente|sin proceso/.test(normalized)) return "status-pending";
  return "status-neutral";
}

function externalLink(url, label = "Abrir fuente oficial", className = "") {
  if (!url) return "";
  return `<a class="${escapeHtml(className)}" href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} <svg aria-hidden="true"><use href="#i-external"/></svg></a>`;
}

function renderKpis() {
  const counts = {
    decision: getPublished("decision").length,
    supervision: getPublished("supervision").length,
    cv: getPublished("cv").length,
    gaceta: getPublished("gaceta").length,
    agenda: getPublished("agenda").length
  };
  const items = [
    ["decision", counts.decision, "Decisiones publicadas", "Fundamentos e impacto"],
    ["supervision", counts.supervision, "Mecanismos de control", "Responsables y procedimientos"],
    ["cv", counts.cv, "Procesos de hojas de vida", "Activos e históricos"],
    ["gaceta", counts.gaceta, "Registros de Gaceta", "Actos y notificaciones"],
    ["agenda", counts.agenda, "Iniciativas regulatorias", `Agenda ${state.config.agendaPeriod || "2026"}`]
  ];
  const target = $("#kpiGrid");
  if (!target) return;
  target.innerHTML = items.map(([cat, count, title, detail]) => `
    <article class="kpi kpi-${CATEGORY_COLORS[cat]}">
      <strong>${count}</strong><div><span>${escapeHtml(title)}</span><small>${escapeHtml(detail)}</small></div>
    </article>`).join("");
}

function recordCard(item, compact = false) {
  const dateLine = item.date ? formatDate(item.date, { short: true }) : item.year || "";
  const tags = (item.tags || []).slice(0, 4).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  return `<article class="record-card ${compact ? "record-card-compact" : ""}" data-category="${escapeHtml(item.category)}">
    <div class="record-topline"><span class="record-type">${escapeHtml(item.recordType || CATEGORY_LABELS[item.category])}</span><span class="status ${statusClass(item.status)}">${escapeHtml(item.status || "Publicado")}</span></div>
    <h3>${escapeHtml(item.title)}</h3>
    <p>${escapeHtml(item.summary || "")}</p>
    <dl class="record-meta">
      ${item.number ? `<div><dt>Referencia</dt><dd>${escapeHtml(item.number)}</dd></div>` : ""}
      ${dateLine ? `<div><dt>Fecha</dt><dd>${dateLine}</dd></div>` : ""}
      ${item.responsible ? `<div><dt>Responsable</dt><dd>${escapeHtml(item.responsible)}</dd></div>` : ""}
    </dl>
    ${tags ? `<div class="tag-list">${tags}</div>` : ""}
    <div class="record-actions">
      <button type="button" class="text-link" data-open-record="${escapeHtml(item.id)}">Ver ficha completa <svg><use href="#i-arrow"/></svg></button>
      ${externalLink(item.documentUrl, "Documento / fuente")}
    </div>
  </article>`;
}

function populateSelect(select, values, allLabel = "Todos") {
  if (!select) return;
  const current = select.value;
  select.innerHTML = `<option value="">${escapeHtml(allLabel)}</option>${values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("")}`;
  select.value = values.includes(current) ? current : "";
}

function renderDecisions() {
  const all = getPublished("decision");
  populateSelect($("#decisionYear"), [...new Set(all.map((x) => String(x.year || "")).filter(Boolean))].sort().reverse());
  populateSelect($("#decisionStatus"), [...new Set(all.map((x) => x.status).filter(Boolean))].sort());
  const query = normalizeText($("#decisionSearch")?.value || "");
  const year = $("#decisionYear")?.value || "";
  const status = $("#decisionStatus")?.value || "";
  const filtered = all.filter((item) => {
    const haystack = normalizeText([item.title, item.summary, item.number, item.responsible, item.legalBasis, ...(item.tags || [])].join(" "));
    return (!query || haystack.includes(query)) && (!year || String(item.year) === year) && (!status || item.status === status);
  });
  const target = $("#decisionList");
  if (!target) return;
  target.innerHTML = filtered.length ? filtered.map((item) => recordCard(item)).join("") : emptyState("No se encontraron decisiones con los filtros seleccionados.");
}

function renderSupervision() {
  const target = $("#supervisionList");
  if (target) target.innerHTML = getPublished("supervision").map((item) => recordCard(item, true)).join("");
  const tbody = $("#controlEntitiesBody");
  if (tbody) tbody.innerHTML = CONTROL_ENTITIES.map((entity) => `<tr>
    <td><strong>${escapeHtml(entity.name)}</strong></td>
    <td>${escapeHtml(entity.controlType)}</td>
    <td>${escapeHtml(entity.scope)}</td>
    <td>${escapeHtml(entity.channel)}</td>
    <td>${externalLink(entity.url, "Consultar")}</td>
  </tr>`).join("");
}

function renderCvs() {
  const target = $("#cvList");
  if (!target) return;
  const items = getPublished("cv");
  target.innerHTML = items.map((item) => {
    const period = item.start || item.end
      ? `${item.start ? formatDate(item.start, { short: true }) : "Sin fecha inicial"} — ${item.end ? formatDate(item.end, { short: true }) : "Abierto"}`
      : "No hay periodo activo en la fecha de corte";
    return `<article class="cv-card">
      <div class="cv-icon" aria-hidden="true">HV</div>
      <div class="cv-content">
        <div class="record-topline"><span class="record-type">${escapeHtml(item.recordType)}</span><span class="status ${statusClass(item.status)}">${escapeHtml(item.status)}</span></div>
        <h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p>
        <div class="cv-period"><strong>Periodo de observaciones:</strong> ${escapeHtml(period)}</div>
        <div class="record-actions"><button type="button" class="text-link" data-open-record="${escapeHtml(item.id)}">Ver proceso <svg><use href="#i-arrow"/></svg></button>${externalLink(item.documentUrl, "Fuente pública")}</div>
      </div>
    </article>`;
  }).join("");
}

function renderGaceta() {
  const all = getPublished("gaceta");
  populateSelect($("#gacetaYear"), [...new Set(all.map((x) => String(x.year || "")).filter(Boolean))].sort().reverse());
  populateSelect($("#gacetaType"), [...new Set(all.map((x) => x.recordType).filter(Boolean))].sort());
  const query = normalizeText($("#gacetaSearch")?.value || "");
  const year = $("#gacetaYear")?.value || "";
  const type = $("#gacetaType")?.value || "";
  const filtered = all.filter((item) => {
    const haystack = normalizeText([item.title, item.number, item.summary, item.responsible, ...(item.tags || [])].join(" "));
    return (!query || haystack.includes(query)) && (!year || String(item.year) === year) && (!type || item.recordType === type);
  });
  const tbody = $("#gacetaBody");
  if (!tbody) return;
  tbody.innerHTML = filtered.length ? filtered.map((item) => `<tr>
    <td>${item.date ? formatDate(item.date, { short: true }) : escapeHtml(String(item.year || ""))}</td>
    <td><span class="record-type">${escapeHtml(item.recordType)}</span></td>
    <td><strong>${escapeHtml(item.number || "Sin número")}</strong></td>
    <td><button type="button" class="table-title" data-open-record="${escapeHtml(item.id)}">${escapeHtml(item.title)}</button><small>${escapeHtml(item.summary || "")}</small></td>
    <td><span class="status ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td>
    <td>${externalLink(item.documentUrl, "Abrir")}</td>
  </tr>`).join("") : `<tr><td colspan="6">${emptyState("No hay registros que coincidan con la búsqueda.")}</td></tr>`;
}

function renderAgenda() {
  const items = getPublished("agenda").sort((a, b) => String(a.date || a.start || "").localeCompare(String(b.date || b.start || "")));
  const target = $("#agendaList");
  if (target) target.innerHTML = items.map((item, index) => `<article class="timeline-item">
    <div class="timeline-marker"><span>${String(index + 1).padStart(2, "0")}</span></div>
    <div class="timeline-card">
      <div class="record-topline"><span class="record-type">${escapeHtml(item.number || item.recordType)}</span><span class="status ${statusClass(item.status)}">${escapeHtml(item.status)}</span></div>
      <h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p>
      <dl class="agenda-meta">
        <div><dt>Responsable</dt><dd>${escapeHtml(item.responsible || "No indicado")}</dd></div>
        <div><dt>Consulta</dt><dd>${item.start || item.end ? `${item.start ? formatDate(item.start, { short: true }) : "Por definir"} — ${item.end ? formatDate(item.end, { short: true }) : "Abierta"}` : "Programación institucional"}</dd></div>
        <div><dt>Impacto</dt><dd>${escapeHtml(item.impact || "Consultar ficha")}</dd></div>
      </dl>
      <div class="record-actions"><button type="button" class="text-link" data-open-record="${escapeHtml(item.id)}">Ficha regulatoria <svg><use href="#i-arrow"/></svg></button>${externalLink(item.documentUrl, "Expediente / publicación")}</div>
    </div>
  </article>`).join("");
  if ($("#agendaVersion")) $("#agendaVersion").textContent = state.config.agendaVersion || "1.0";
  if ($("#agendaDate")) $("#agendaDate").textContent = formatDate(state.config.agendaApprovalDate || state.config.lastUpdated);
  if ($("#agendaCount")) $("#agendaCount").textContent = String(items.length);
  const changes = $("#agendaChanges");
  if (changes) changes.innerHTML = `<ul>${AGENDA_CHANGES.map((change) => `<li><time datetime="${escapeHtml(change.date)}">${formatDate(change.date)}</time><div><strong>${escapeHtml(change.type)}</strong><p>${escapeHtml(change.description)}</p></div></li>`).join("")}</ul>`;
}

function renderSucop() {
  const entityLink = $("#sucopEntityLink");
  const hasEntity = Boolean(state.config.sucopEntityUrl);
  if ($("#sucopStatusLabel")) $("#sucopStatusLabel").textContent = hasEntity ? "Perfil institucional habilitado" : "Habilitación institucional en trámite";
  if ($("#sucopStatusText")) $("#sucopStatusText").textContent = state.config.sucopStatus || "Estado no informado";
  if (entityLink) {
    entityLink.hidden = false;
    entityLink.href = hasEntity ? safeUrl(state.config.sucopEntityUrl) : safeUrl(state.config.sucopSearch);
    entityLink.innerHTML = hasEntity ? "Abrir perfil institucional en SUCOP <svg><use href=\"#i-external\"/></svg>" : "Consultar proyectos en el buscador SUCOP <svg><use href=\"#i-external\"/></svg>";
  }
  const select = $("#relatedPublication");
  if (select) {
    const current = select.value;
    const eligible = state.publications.filter((item) => item.published !== false && ["agenda", "decision", "cv"].includes(item.category));
    select.innerHTML = `<option value="">Seleccione una publicación</option>${eligible.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.title)}</option>`).join("")}`;
    select.value = eligible.some((x) => x.id === current) ? current : "";
  }
}

function renderGlossary() {
  const query = normalizeText($("#glossarySearch")?.value || "");
  const items = GLOSSARY.filter((item) => normalizeText(`${item.term} ${item.definition}`).includes(query));
  const target = $("#glossaryList");
  if (target) target.innerHTML = items.length ? items.map((item) => `<article><h3>${escapeHtml(item.term)}</h3><p>${escapeHtml(item.definition)}</p></article>`).join("") : emptyState("No se encontraron términos.");
}

function renderSources() {
  const target = $("#sourceList");
  if (!target) return;
  target.innerHTML = SOURCE_REGISTRY.map((source) => `<article class="source-card">
    <div><strong>${escapeHtml(source.name)}</strong><p>${escapeHtml(source.purpose)}</p><small>Verificada: ${formatDate(source.verified, { short: true })}</small></div>
    ${externalLink(source.url, "Abrir fuente")}
  </article>`).join("");
}

function renderAll() {
  renderKpis();
  renderDecisions();
  renderSupervision();
  renderCvs();
  renderGaceta();
  renderAgenda();
  renderSucop();
  renderGlossary();
  renderSources();
  if ($("#lastUpdatedText")) $("#lastUpdatedText").textContent = formatDate(state.config.lastUpdated);
  bindRecordButtons();
}

function emptyState(message) {
  return `<div class="empty-state"><svg aria-hidden="true"><use href="#i-info"/></svg><p>${escapeHtml(message)}</p></div>`;
}

function bindRecordButtons() {
  $$('[data-open-record]').forEach((button) => {
    button.onclick = () => openRecord(button.dataset.openRecord);
  });
}

function detailRow(label, value) {
  if (!value || (Array.isArray(value) && !value.length)) return "";
  const content = Array.isArray(value)
    ? `<ol>${value.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`
    : `<p>${escapeHtml(value)}</p>`;
  return `<section class="modal-detail"><h3>${escapeHtml(label)}</h3>${content}</section>`;
}

function openRecord(id) {
  const item = state.publications.find((record) => record.id === id);
  if (!item) return;
  state.currentRecord = item;
  const modal = $("#recordModal");
  const target = $("#recordModalContent");
  if (!modal || !target) return;
  target.innerHTML = `
    <div class="modal-kicker">${escapeHtml(CATEGORY_LABELS[item.category] || item.recordType)}</div>
    <h2 id="recordModalTitle">${escapeHtml(item.title)}</h2>
    <div class="modal-summary"><span class="status ${statusClass(item.status)}">${escapeHtml(item.status || "Publicado")}</span>${item.number ? `<strong>${escapeHtml(item.number)}</strong>` : ""}${item.date ? `<time datetime="${escapeHtml(item.date)}">${formatDate(item.date)}</time>` : ""}</div>
    <p class="modal-lead">${escapeHtml(item.summary || "")}</p>
    <div class="modal-grid">
      ${detailRow("Dependencia responsable", item.responsible)}
      ${detailRow("Fundamento jurídico y técnico", item.legalBasis)}
      ${detailRow("Impacto ciudadano", item.impact)}
      ${detailRow("Población o grupos interesados", item.population)}
      ${detailRow("Procedimiento", item.procedure)}
      ${detailRow("Canales institucionales", item.channels)}
      ${detailRow("Frecuencia", item.frequency)}
      ${detailRow("Periodo de observaciones", item.start || item.end ? `${item.start ? formatDate(item.start) : "Sin fecha inicial"} a ${item.end ? formatDate(item.end) : "abierto"}` : "No aplica o no existe periodo activo")}
    </div>
    <div class="modal-links">
      ${externalLink(item.documentUrl, "Abrir documento o publicación", "btn btn-primary")}
      ${externalLink(item.sourceUrl, "Consultar repositorio de origen", "btn btn-outline")}
      ${externalLink(item.relatedUrl, "Ver información relacionada", "btn btn-outline")}
    </div>
    <div class="verification-note"><svg><use href="#i-shield"/></svg><p><strong>Trazabilidad:</strong> fuente verificada el ${formatDate(item.verificationDate || state.config.lastUpdated)}. La validez jurídica corresponde al documento oficial enlazado.</p></div>`;
  modal.showModal();
}

function closeDialogOnBackdrop(dialog) {
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

function setupNavigation() {
  const toggle = $("#menuToggle");
  const nav = $("#mainNav");
  toggle?.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    nav?.classList.toggle("is-open", !open);
  });
  $$("#mainNav a").forEach((link) => link.addEventListener("click", () => {
    toggle?.setAttribute("aria-expanded", "false");
    nav?.classList.remove("is-open");
  }));
}

function setupAccessibility() {
  let scale = Number(storage.get("ga-font-scale") || 1);
  const applyScale = () => {
    document.documentElement.style.setProperty("--font-scale", String(scale));
    storage.set("ga-font-scale", String(scale));
  };
  applyScale();
  $("#increaseFont")?.addEventListener("click", () => { scale = Math.min(1.25, +(scale + 0.05).toFixed(2)); applyScale(); });
  $("#decreaseFont")?.addEventListener("click", () => { scale = Math.max(0.9, +(scale - 0.05).toFixed(2)); applyScale(); });
  $("#resetFont")?.addEventListener("click", () => { scale = 1; applyScale(); });
  const contrast = storage.get("ga-high-contrast") === "true";
  document.body.classList.toggle("high-contrast", contrast);
  $("#toggleContrast")?.setAttribute("aria-pressed", String(contrast));
  $("#toggleContrast")?.addEventListener("click", (event) => {
    const active = !document.body.classList.contains("high-contrast");
    document.body.classList.toggle("high-contrast", active);
    event.currentTarget.setAttribute("aria-pressed", String(active));
    storage.set("ga-high-contrast", String(active));
  });
  const readable = storage.get("ga-readable") === "true";
  document.body.classList.toggle("readable", readable);
  $("#toggleReadable")?.setAttribute("aria-pressed", String(readable));
  $("#toggleReadable")?.addEventListener("click", (event) => {
    const active = !document.body.classList.contains("readable");
    document.body.classList.toggle("readable", active);
    event.currentTarget.setAttribute("aria-pressed", String(active));
    storage.set("ga-readable", String(active));
  });
}

function setupFilters() {
  $("#decisionSearch")?.addEventListener("input", renderDecisions);
  $("#decisionYear")?.addEventListener("change", renderDecisions);
  $("#decisionStatus")?.addEventListener("change", renderDecisions);
  $("#clearDecisionFilters")?.addEventListener("click", () => {
    if ($("#decisionSearch")) $("#decisionSearch").value = "";
    if ($("#decisionYear")) $("#decisionYear").value = "";
    if ($("#decisionStatus")) $("#decisionStatus").value = "";
    renderDecisions();
  });
  $("#gacetaSearch")?.addEventListener("input", renderGaceta);
  $("#gacetaYear")?.addEventListener("change", renderGaceta);
  $("#gacetaType")?.addEventListener("change", renderGaceta);
  $("#glossarySearch")?.addEventListener("input", renderGlossary);
  $("#printAgenda")?.addEventListener("click", () => window.print());
  $("#exportGaceta")?.addEventListener("click", exportGacetaCsv);
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function exportGacetaCsv() {
  const rows = getPublished("gaceta").map((item) => [item.date, item.recordType, item.number, item.title, item.status, item.responsible, item.documentUrl]);
  const csv = [["Fecha", "Tipo", "Número", "Título", "Estado", "Responsable", "Enlace"], ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
  downloadText(`gaceta-oficial-san-pedro-${new Date().toISOString().slice(0, 10)}.csv`, `\uFEFF${csv}`, "text/csv;charset=utf-8");
}

function downloadText(filename, content, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function ticketCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const code = [...bytes].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 6).toUpperCase();
  return `SP-NOR-${new Date().getFullYear()}-${code}`;
}

function showMessage(target, message, type = "info") {
  if (!target) return;
  target.className = `form-message is-visible message-${type}`;
  target.textContent = message;
}

function setupParticipation() {
  const textarea = $("#observationText");
  textarea?.addEventListener("input", () => { if ($("#charCount")) $("#charCount").textContent = String(textarea.value.length); });
  $("#observationForm")?.addEventListener("submit", submitObservation);
  $("#searchTracking")?.addEventListener("click", searchTracking);
}

async function submitObservation(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $("#formMessage");
  if ($("#websiteField")?.value) return;
  if (!form.reportValidity()) {
    showMessage(message, "Revise los campos obligatorios antes de continuar.", "error");
    return;
  }
  const lastSent = Number(storage.get("ga-last-observation") || 0);
  if (Date.now() - lastSent < 45000) {
    showMessage(message, "Espere unos segundos antes de realizar una nueva radicación.", "error");
    return;
  }
  const ticket = ticketCode();
  const payload = {
    ticket,
    publicationId: $("#relatedPublication").value,
    publicationTitle: state.publications.find((item) => item.id === $("#relatedPublication").value)?.title || "Publicación no identificada",
    citizenName: $("#citizenName").value.trim(),
    citizenEmail: $("#citizenEmail").value.trim().toLowerCase(),
    type: $("#observationType").value,
    articleReference: $("#articleReference").value.trim(),
    text: $("#observationText").value.trim(),
    consent: $("#consent").checked,
    status: "Radicada",
    source: "Micropágina Gobierno Abierto y Normativa",
    createdAtIso: new Date().toISOString(),
    userAgent: navigator.userAgent.slice(0, 240)
  };
  const button = $("#submitObservation");
  if (button) { button.disabled = true; button.textContent = "Radicando…"; }
  try {
    if (state.firebase?.db) {
      const { addDoc, collection, serverTimestamp } = state.firebase.firestore;
      await addDoc(collection(state.firebase.db, COLLECTIONS.observations), { ...payload, createdAt: serverTimestamp() });
    } else {
      const local = JSON.parse(storage.get("ga-observations") || "[]");
      local.push(payload);
      storage.set("ga-observations", JSON.stringify(local.slice(-25)));
    }
    storage.set("ga-last-observation", String(Date.now()));
    form.reset();
    if ($("#charCount")) $("#charCount").textContent = "0";
    showMessage(message, `Observación radicada correctamente. Código de seguimiento: ${ticket}. Conserve este código.`, "success");
  } catch (error) {
    console.error(error);
    showMessage(message, "No fue posible registrar la observación en este momento. Use el canal PQRSD institucional enlazado en esta sección.", "error");
  } finally {
    if (button) { button.disabled = false; button.textContent = "Radicar observación"; }
  }
}

async function searchTracking() {
  const code = $("#trackingCode")?.value.trim().toUpperCase();
  const target = $("#trackingResult");
  if (!code || !/^SP-NOR-\d{4}-[A-Z0-9]{6}$/.test(code)) {
    if (target) target.innerHTML = `<p class="message-error">Ingrese un código válido, por ejemplo SP-NOR-2026-ABC123.</p>`;
    return;
  }
  if (target) target.innerHTML = "<p>Consultando…</p>";
  try {
    let response = null;
    if (state.firebase?.db) {
      const { collection, getDocs, limit, query, where } = state.firebase.firestore;
      const snapshot = await getDocs(query(collection(state.firebase.db, COLLECTIONS.publicResponses), where("ticket", "==", code), limit(1)));
      response = snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    } else {
      const locals = JSON.parse(storage.get("ga-public-responses") || "[]");
      response = locals.find((item) => item.ticket === code) || null;
    }
    if (!response) {
      target.innerHTML = `<div class="tracking-empty"><strong>Sin respuesta pública registrada</strong><p>La radicación puede encontrarse en revisión. La publicación de una respuesta no revela datos personales.</p></div>`;
      return;
    }
    target.innerHTML = `<div class="tracking-found"><span class="status ${statusClass(response.status)}">${escapeHtml(response.status || "Respondida")}</span><h4>${escapeHtml(response.publicationTitle || "Participación normativa")}</h4><p>${escapeHtml(response.publicResponse || response.response || "Respuesta publicada sin texto adicional.")}</p><small>Actualización: ${escapeHtml(formatDateTime(response.respondedAt || response.updatedAt || response.createdAtIso))}</small></div>`;
  } catch (error) {
    console.error(error);
    target.innerHTML = `<p class="message-error">No fue posible consultar el estado. Intente nuevamente o use el canal PQRSD.</p>`;
  }
}

async function initFirebase() {
  try {
    const [appModule, firestoreModule, authModule] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js")
    ]);
    const app = appModule.initializeApp(FIREBASE_CONFIG);
    const db = firestoreModule.getFirestore(app);
    const auth = authModule.getAuth(app);
    state.firebase = { app, db, auth, firestore: firestoreModule, authApi: authModule };
    authModule.onAuthStateChanged(auth, handleAuthState);
    await loadRemotePublicData();
  } catch (error) {
    console.warn("Firebase no disponible; se muestran datos institucionales precargados.", error);
  }
}

async function loadRemotePublicData() {
  if (!state.firebase?.db) return;
  const { collection, getDocs, query, where, doc, getDoc } = state.firebase.firestore;
  try {
    const snap = await getDocs(query(collection(state.firebase.db, COLLECTIONS.publications), where("published", "==", true)));
    if (!snap.empty) {
      const remote = snap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
      const map = new Map(SEED_PUBLICATIONS.map((item) => [item.id, item]));
      remote.forEach((item) => map.set(item.id, item));
      state.publications = [...map.values()];
    }
    const configSnap = await getDoc(doc(state.firebase.db, COLLECTIONS.config, "public"));
    if (configSnap.exists()) state.config = { ...state.config, ...configSnap.data() };
    renderAll();
  } catch (error) {
    console.warn("No se pudo cargar la actualización remota; se conserva la versión precargada.", error);
  }
}

function setupDialogs() {
  $("#recordModal")?.querySelector("[data-close-modal]")?.addEventListener("click", () => $("#recordModal").close());
  closeDialogOnBackdrop($("#recordModal"));
  $("#openAdmin")?.addEventListener("click", () => $("#adminDialog")?.showModal());
  $("#closeAdmin")?.addEventListener("click", () => $("#adminDialog")?.close());
  closeDialogOnBackdrop($("#adminDialog"));
  $("#adminLogin")?.addEventListener("click", adminLogin);
  $("#adminLogout")?.addEventListener("click", adminLogout);
  $$("[data-admin-view]").forEach((button) => button.addEventListener("click", () => {
    state.adminView = button.dataset.adminView;
    $$("[data-admin-view]").forEach((b) => b.classList.toggle("is-active", b === button));
    renderAdminView();
  }));
}

async function adminLogin() {
  const message = $("#adminLoginMessage");
  if (!state.firebase?.auth) {
    showMessage(message, "Firebase no está disponible. Verifique conexión, dominios autorizados y configuración del proyecto.", "error");
    return;
  }
  try {
    const provider = new state.firebase.authApi.GoogleAuthProvider();
    await state.firebase.authApi.signInWithPopup(state.firebase.auth, provider);
  } catch (error) {
    console.error(error);
    showMessage(message, "No fue posible iniciar sesión. Verifique que Google esté habilitado en Firebase Authentication.", "error");
  }
}

async function handleAuthState(user) {
  state.user = user;
  state.admin = null;
  if (!user || !state.firebase?.db) {
    toggleAdminPanel(false);
    return;
  }
  try {
    const { doc, getDoc } = state.firebase.firestore;
    const snap = await getDoc(doc(state.firebase.db, COLLECTIONS.admins, user.uid));
    if (!snap.exists() || snap.data().active === false) {
      showMessage($("#adminLoginMessage"), "Su cuenta se autenticó, pero no está autorizada como administradora de esta micropágina.", "error");
      await state.firebase.authApi.signOut(state.firebase.auth);
      return;
    }
    state.admin = { uid: user.uid, ...snap.data() };
    toggleAdminPanel(true);
    renderAdminView();
  } catch (error) {
    console.error(error);
    showMessage($("#adminLoginMessage"), "No fue posible verificar el rol administrativo.", "error");
  }
}

function toggleAdminPanel(authorized) {
  $("#adminLoginView")?.classList.toggle("hidden", authorized);
  $("#adminPanelView")?.classList.toggle("hidden", !authorized);
  if (authorized && state.user) {
    if ($("#adminUserName")) $("#adminUserName").textContent = state.admin?.name || state.user.displayName || "Administrador";
    if ($("#adminUserEmail")) $("#adminUserEmail").textContent = state.user.email || "";
  }
}

async function adminLogout() {
  if (state.firebase?.auth) await state.firebase.authApi.signOut(state.firebase.auth);
  toggleAdminPanel(false);
}

function renderAdminView() {
  const target = $("#adminContent");
  if (!target || !state.admin) return;
  if (state.adminView === "publications") renderAdminPublications(target);
  else if (state.adminView === "observations") renderAdminObservations(target);
  else if (state.adminView === "configuration") renderAdminConfiguration(target);
  else if (state.adminView === "audit") renderAdminAudit(target);
  else renderAdminDashboard(target);
}

function renderAdminDashboard(target) {
  const counts = Object.fromEntries(Object.keys(CATEGORY_LABELS).map((cat) => [cat, state.publications.filter((x) => x.category === cat).length]));
  target.innerHTML = `<div class="admin-view-head"><div><p class="overline">Panel general</p><h3>Resumen de contenidos</h3></div><button class="btn btn-outline" id="adminSeed">Cargar datos iniciales en Firestore</button></div>
    <div class="admin-stats">${Object.entries(counts).map(([cat, count]) => `<article><strong>${count}</strong><span>${escapeHtml(CATEGORY_LABELS[cat])}</span></article>`).join("")}</div>
    <div class="admin-notice"><h4>Publicación segura</h4><p>Las observaciones ciudadanas se almacenan en una colección privada. Solo las respuestas anonimizadas que el administrador publique pasan a la colección de respuestas públicas.</p></div>`;
  $("#adminSeed")?.addEventListener("click", seedFirestore);
}

function renderAdminPublications(target) {
  target.innerHTML = `<div class="admin-view-head"><div><p class="overline">Contenido</p><h3>Publicaciones</h3></div><button class="btn btn-primary" id="newPublication">Nueva publicación</button></div>
    <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Categoría</th><th>Título</th><th>Estado</th><th>Publicado</th><th>Acciones</th></tr></thead><tbody>${state.publications.map((item) => `<tr><td>${escapeHtml(CATEGORY_LABELS[item.category] || item.category)}</td><td><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.number || "")}</small></td><td>${escapeHtml(item.status || "")}</td><td>${item.published !== false ? "Sí" : "No"}</td><td><button class="admin-action" data-admin-edit="${escapeHtml(item.id)}">Editar</button></td></tr>`).join("")}</tbody></table></div>`;
  $("#newPublication")?.addEventListener("click", () => renderPublicationEditor(target, null));
  $$('[data-admin-edit]', target).forEach((button) => button.addEventListener("click", () => renderPublicationEditor(target, state.publications.find((item) => item.id === button.dataset.adminEdit))));
}

function renderPublicationEditor(target, existing) {
  const item = existing || { id: `pub-${Date.now()}`, category: "decision", published: false, year: 2026, order: 100 };
  target.innerHTML = `<div class="admin-view-head"><div><p class="overline">${existing ? "Editar" : "Crear"}</p><h3>Ficha de publicación</h3></div><button class="btn btn-outline" id="backPublications">Volver</button></div>
    <form id="publicationEditor" class="admin-form">
      <label><span>Categoría</span><select name="category" required>${Object.entries(CATEGORY_LABELS).map(([value, label]) => `<option value="${value}" ${item.category === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select></label>
      <label class="wide"><span>Título</span><input name="title" value="${escapeHtml(item.title || "")}" required maxlength="220"></label>
      <label><span>Tipo de registro</span><input name="recordType" value="${escapeHtml(item.recordType || "")}" maxlength="120"></label>
      <label><span>Número / referencia</span><input name="number" value="${escapeHtml(item.number || "")}" maxlength="160"></label>
      <label><span>Fecha</span><input name="date" type="date" value="${escapeHtml(item.date || "")}"></label>
      <label><span>Año</span><input name="year" type="number" min="1900" max="2100" value="${escapeHtml(item.year || 2026)}"></label>
      <label><span>Estado</span><input name="status" value="${escapeHtml(item.status || "")}" maxlength="80"></label>
      <label><span>Responsable</span><input name="responsible" value="${escapeHtml(item.responsible || "")}" maxlength="220"></label>
      <label class="wide"><span>Resumen</span><textarea name="summary" rows="4" required maxlength="2000">${escapeHtml(item.summary || "")}</textarea></label>
      <label class="wide"><span>Fundamento jurídico</span><textarea name="legalBasis" rows="3" maxlength="2000">${escapeHtml(item.legalBasis || "")}</textarea></label>
      <label class="wide"><span>Impacto ciudadano</span><textarea name="impact" rows="3" maxlength="2000">${escapeHtml(item.impact || "")}</textarea></label>
      <label class="wide"><span>Población interesada</span><textarea name="population" rows="2" maxlength="1200">${escapeHtml(item.population || "")}</textarea></label>
      <label class="wide"><span>Procedimiento (una etapa por línea)</span><textarea name="procedure" rows="5">${escapeHtml((item.procedure || []).join("\n"))}</textarea></label>
      <label class="wide"><span>Canales (uno por línea)</span><textarea name="channels" rows="4">${escapeHtml((item.channels || []).join("\n"))}</textarea></label>
      <label><span>Inicio de observaciones</span><input name="start" type="date" value="${escapeHtml(item.start || "")}"></label>
      <label><span>Fin de observaciones</span><input name="end" type="date" value="${escapeHtml(item.end || "")}"></label>
      <label class="wide"><span>URL de documento o publicación</span><input name="documentUrl" type="url" value="${escapeHtml(item.documentUrl || "")}"></label>
      <label class="wide"><span>URL de repositorio de origen</span><input name="sourceUrl" type="url" value="${escapeHtml(item.sourceUrl || "")}"></label>
      <label class="wide"><span>Etiquetas separadas por coma</span><input name="tags" value="${escapeHtml((item.tags || []).join(", "))}"></label>
      <label><span>Orden</span><input name="order" type="number" value="${escapeHtml(item.order || 100)}"></label>
      <label class="checkbox"><input name="published" type="checkbox" ${item.published !== false ? "checked" : ""}><span>Publicar en la consulta ciudadana</span></label>
      <div class="admin-form-actions wide"><button class="btn btn-primary" type="submit">Guardar publicación</button>${existing ? `<button class="btn btn-danger" type="button" id="deletePublication">Eliminar</button>` : ""}</div>
    </form>`;
  $("#backPublications")?.addEventListener("click", () => renderAdminPublications(target));
  $("#publicationEditor")?.addEventListener("submit", (event) => savePublication(event, item.id));
  $("#deletePublication")?.addEventListener("click", () => deletePublication(item.id));
}

async function savePublication(event, id) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = {
    id,
    category: form.get("category"),
    title: String(form.get("title") || "").trim(),
    recordType: String(form.get("recordType") || "").trim(),
    number: String(form.get("number") || "").trim(),
    date: String(form.get("date") || ""),
    year: Number(form.get("year") || new Date().getFullYear()),
    status: String(form.get("status") || "").trim(),
    responsible: String(form.get("responsible") || "").trim(),
    summary: String(form.get("summary") || "").trim(),
    legalBasis: String(form.get("legalBasis") || "").trim(),
    impact: String(form.get("impact") || "").trim(),
    population: String(form.get("population") || "").trim(),
    procedure: String(form.get("procedure") || "").split("\n").map((x) => x.trim()).filter(Boolean),
    channels: String(form.get("channels") || "").split("\n").map((x) => x.trim()).filter(Boolean),
    start: String(form.get("start") || ""),
    end: String(form.get("end") || ""),
    documentUrl: String(form.get("documentUrl") || "").trim(),
    sourceUrl: String(form.get("sourceUrl") || "").trim(),
    tags: String(form.get("tags") || "").split(",").map((x) => x.trim()).filter(Boolean),
    order: Number(form.get("order") || 100),
    published: form.get("published") === "on",
    verificationDate: new Date().toISOString().slice(0, 10),
    updatedBy: state.user?.email || "",
    updatedAtIso: new Date().toISOString()
  };
  try {
    const { doc, setDoc, serverTimestamp } = state.firebase.firestore;
    await setDoc(doc(state.firebase.db, COLLECTIONS.publications, id), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
    const index = state.publications.findIndex((item) => item.id === id);
    if (index >= 0) state.publications[index] = payload; else state.publications.push(payload);
    await writeAudit("Guardar publicación", id, payload.title);
    renderAll();
    renderAdminPublications($("#adminContent"));
  } catch (error) {
    console.error(error);
    alert("No fue posible guardar la publicación. Revise permisos de Firestore.");
  }
}

async function deletePublication(id) {
  if (!confirm("¿Eliminar esta publicación de la base de datos? La operación quedará registrada en auditoría.")) return;
  try {
    const { deleteDoc, doc } = state.firebase.firestore;
    const item = state.publications.find((x) => x.id === id);
    await deleteDoc(doc(state.firebase.db, COLLECTIONS.publications, id));
    state.publications = state.publications.filter((x) => x.id !== id);
    await writeAudit("Eliminar publicación", id, item?.title || "");
    renderAll();
    renderAdminPublications($("#adminContent"));
  } catch (error) {
    console.error(error);
    alert("No fue posible eliminar la publicación.");
  }
}

async function renderAdminObservations(target) {
  target.innerHTML = `<div class="admin-view-head"><div><p class="overline">Participación</p><h3>Observaciones ciudadanas</h3></div><button class="btn btn-outline" id="refreshObservations">Actualizar</button></div><div id="adminObservationList">Cargando…</div>`;
  $("#refreshObservations")?.addEventListener("click", () => renderAdminObservations(target));
  try {
    const { collection, getDocs, limit, orderBy, query } = state.firebase.firestore;
    const snap = await getDocs(query(collection(state.firebase.db, COLLECTIONS.observations), orderBy("createdAt", "desc"), limit(100)));
    const items = snap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    const list = $("#adminObservationList");
    list.innerHTML = items.length ? `<div class="observation-admin-list">${items.map((item) => `<article><div class="record-topline"><strong>${escapeHtml(item.ticket)}</strong><span class="status ${statusClass(item.status)}">${escapeHtml(item.status || "Radicada")}</span></div><h4>${escapeHtml(item.publicationTitle)}</h4><p>${escapeHtml(item.text)}</p><dl><div><dt>Tipo</dt><dd>${escapeHtml(item.type)}</dd></div><div><dt>Contacto privado</dt><dd>${escapeHtml(item.citizenName)} · ${escapeHtml(item.citizenEmail)}</dd></div><div><dt>Fecha</dt><dd>${escapeHtml(formatDateTime(item.createdAt || item.createdAtIso))}</dd></div></dl><button class="btn btn-outline" data-respond-observation="${escapeHtml(item.id)}">Gestionar y publicar respuesta</button></article>`).join("")}</div>` : emptyState("No existen observaciones registradas.");
    $$('[data-respond-observation]', list).forEach((button) => button.addEventListener("click", () => renderObservationResponse(target, items.find((item) => item.id === button.dataset.respondObservation))));
  } catch (error) {
    console.error(error);
    $("#adminObservationList").innerHTML = emptyState("No fue posible consultar observaciones. Revise índices y permisos.");
  }
}

function renderObservationResponse(target, item) {
  target.innerHTML = `<div class="admin-view-head"><div><p class="overline">Respuesta</p><h3>${escapeHtml(item.ticket)}</h3></div><button class="btn btn-outline" id="backObservations">Volver</button></div>
    <article class="admin-observation-detail"><h4>${escapeHtml(item.publicationTitle)}</h4><p>${escapeHtml(item.text)}</p><small>Dato de contacto privado: ${escapeHtml(item.citizenName)} · ${escapeHtml(item.citizenEmail)}</small></article>
    <form id="responseEditor" class="admin-form">
      <label><span>Estado</span><select name="status"><option>En revisión</option><option>Trasladada</option><option>Respondida</option><option>Cerrada</option></select></label>
      <label class="wide"><span>Respuesta pública anonimizada</span><textarea name="publicResponse" rows="8" required maxlength="6000"></textarea><small>No incluya nombres, correos, documentos de identidad ni otros datos personales.</small></label>
      <label class="wide"><span>Enlace a documento de respuesta, si existe</span><input name="responseUrl" type="url"></label>
      <div class="admin-form-actions wide"><button class="btn btn-primary" type="submit">Publicar respuesta</button></div>
    </form>`;
  $("#backObservations")?.addEventListener("click", () => renderAdminObservations(target));
  $("#responseEditor")?.addEventListener("submit", (event) => publishObservationResponse(event, item));
}

async function publishObservationResponse(event, item) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = {
    ticket: item.ticket,
    observationId: item.id,
    publicationId: item.publicationId,
    publicationTitle: item.publicationTitle,
    status: form.get("status"),
    publicResponse: String(form.get("publicResponse") || "").trim(),
    responseUrl: String(form.get("responseUrl") || "").trim(),
    respondedBy: state.user?.email || "",
    respondedAtIso: new Date().toISOString(),
    published: true
  };
  try {
    const { doc, setDoc, updateDoc, serverTimestamp } = state.firebase.firestore;
    await setDoc(doc(state.firebase.db, COLLECTIONS.publicResponses, item.ticket), { ...payload, respondedAt: serverTimestamp() }, { merge: true });
    await updateDoc(doc(state.firebase.db, COLLECTIONS.observations, item.id), { status: payload.status, respondedAt: serverTimestamp(), respondedBy: payload.respondedBy });
    await writeAudit("Publicar respuesta ciudadana", item.ticket, item.publicationTitle);
    renderAdminObservations($("#adminContent"));
  } catch (error) {
    console.error(error);
    alert("No fue posible publicar la respuesta.");
  }
}

function renderAdminConfiguration(target) {
  target.innerHTML = `<div class="admin-view-head"><div><p class="overline">Configuración pública</p><h3>SUCOP y Agenda Regulatoria</h3></div></div>
    <form id="configEditor" class="admin-form">
      <label class="wide"><span>URL directa del perfil o proceso institucional en SUCOP</span><input name="sucopEntityUrl" type="url" value="${escapeHtml(state.config.sucopEntityUrl || "")}" placeholder="https://www.sucop.gov.co/..."><small>Deje vacío hasta que el DNP entregue o habilite el enlace institucional.</small></label>
      <label class="wide"><span>Estado público de habilitación</span><textarea name="sucopStatus" rows="5" required>${escapeHtml(state.config.sucopStatus || "")}</textarea></label>
      <label><span>Versión Agenda</span><input name="agendaVersion" value="${escapeHtml(state.config.agendaVersion || "1.0")}" required></label>
      <label><span>Fecha de aprobación/actualización</span><input name="agendaApprovalDate" type="date" value="${escapeHtml(state.config.agendaApprovalDate || "")}" required></label>
      <label><span>Vigencia</span><input name="agendaPeriod" value="${escapeHtml(state.config.agendaPeriod || "2026")}" required></label>
      <div class="admin-form-actions wide"><button class="btn btn-primary" type="submit">Guardar configuración</button></div>
    </form>`;
  $("#configEditor")?.addEventListener("submit", saveConfiguration);
}

async function saveConfiguration(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = {
    sucopEntityUrl: String(form.get("sucopEntityUrl") || "").trim(),
    sucopStatus: String(form.get("sucopStatus") || "").trim(),
    agendaVersion: String(form.get("agendaVersion") || "1.0").trim(),
    agendaApprovalDate: String(form.get("agendaApprovalDate") || ""),
    agendaPeriod: String(form.get("agendaPeriod") || "2026").trim(),
    lastUpdated: new Date().toISOString().slice(0, 10),
    updatedBy: state.user?.email || "",
    updatedAtIso: new Date().toISOString()
  };
  try {
    const { doc, setDoc, serverTimestamp } = state.firebase.firestore;
    await setDoc(doc(state.firebase.db, COLLECTIONS.config, "public"), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
    state.config = { ...state.config, ...payload };
    await writeAudit("Actualizar configuración", "public", "SUCOP y Agenda Regulatoria");
    renderAll();
    alert("Configuración guardada.");
  } catch (error) {
    console.error(error);
    alert("No fue posible guardar la configuración.");
  }
}

async function renderAdminAudit(target) {
  target.innerHTML = `<div class="admin-view-head"><div><p class="overline">Trazabilidad</p><h3>Registro de auditoría</h3></div></div><div id="auditList">Cargando…</div>`;
  try {
    const { collection, getDocs, limit, orderBy, query } = state.firebase.firestore;
    const snap = await getDocs(query(collection(state.firebase.db, COLLECTIONS.audit), orderBy("createdAt", "desc"), limit(100)));
    const entries = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    $("#auditList").innerHTML = entries.length ? `<div class="audit-list">${entries.map((entry) => `<article><time>${escapeHtml(formatDateTime(entry.createdAt || entry.createdAtIso))}</time><div><strong>${escapeHtml(entry.action)}</strong><p>${escapeHtml(entry.targetTitle || entry.targetId || "")}</p><small>${escapeHtml(entry.userEmail || "Usuario institucional")}</small></div></article>`).join("")}</div>` : emptyState("No hay eventos de auditoría registrados.");
  } catch (error) {
    console.error(error);
    $("#auditList").innerHTML = emptyState("No fue posible consultar el registro de auditoría.");
  }
}

async function seedFirestore() {
  if (!confirm("¿Cargar o actualizar los registros iniciales en Firestore? Los documentos con el mismo ID se actualizarán sin eliminar campos adicionales.")) return;
  const button = $("#adminSeed");
  if (button) { button.disabled = true; button.textContent = "Cargando…"; }
  try {
    const { doc, setDoc, serverTimestamp } = state.firebase.firestore;
    for (const item of SEED_PUBLICATIONS) {
      await setDoc(doc(state.firebase.db, COLLECTIONS.publications, item.id), { ...item, updatedAt: serverTimestamp(), seeded: true }, { merge: true });
    }
    await setDoc(doc(state.firebase.db, COLLECTIONS.config, "public"), { ...SITE_CONFIG, updatedAt: serverTimestamp(), seeded: true }, { merge: true });
    await writeAudit("Carga de datos iniciales", "seed", `${SEED_PUBLICATIONS.length} publicaciones`);
    alert("Datos iniciales cargados correctamente.");
    await loadRemotePublicData();
    renderAdminDashboard($("#adminContent"));
  } catch (error) {
    console.error(error);
    alert("No fue posible cargar los datos. Verifique reglas, permisos y conexión.");
  } finally {
    if (button) { button.disabled = false; button.textContent = "Cargar datos iniciales en Firestore"; }
  }
}

async function writeAudit(action, targetId, targetTitle) {
  if (!state.firebase?.db || !state.user) return;
  const { addDoc, collection, serverTimestamp } = state.firebase.firestore;
  await addDoc(collection(state.firebase.db, COLLECTIONS.audit), {
    action,
    targetId,
    targetTitle,
    userUid: state.user.uid,
    userEmail: state.user.email || "",
    createdAt: serverTimestamp(),
    createdAtIso: new Date().toISOString()
  });
}

function setupTabs() {
  $$('[data-cv-filter]').forEach((button) => button.addEventListener("click", () => {
    const mode = button.dataset.cvFilter;
    $$('[data-cv-filter]').forEach((b) => {
      b.classList.toggle("is-active", b === button);
      b.setAttribute("aria-selected", String(b === button));
    });
    const items = getPublished("cv").filter((item) => mode === "active" ? /abierto|activo/i.test(item.status) : !/abierto|activo/i.test(item.status));
    const target = $("#cvList");
    if (target) target.innerHTML = items.length ? items.map((item) => recordCard(item, true)).join("") : emptyState(mode === "active" ? "No existe un proceso activo reportado en la fecha de corte. La sección permanece habilitada para publicación inmediata." : "No hay procesos históricos registrados.");
    bindRecordButtons();
  }));
}

function init() {
  setupNavigation();
  setupAccessibility();
  setupFilters();
  setupParticipation();
  setupDialogs();
  setupTabs();
  renderAll();
  if (!new URLSearchParams(window.location.search).has("offline")) initFirebase();
}

document.addEventListener("DOMContentLoaded", init);

import { FIREBASE_CONFIG, COLLECTIONS } from "./firebase-config.js";

const state = {
  officials: [],
  processes: [],
  metadata: null,
  view: "grid",
  firebase: null
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function esc(value = "") {
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
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? url.href : "#";
  } catch {
    return "#";
  }
}

function normalize(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "S") + (parts[1]?.[0] || parts.at(-1)?.[0] || "P");
}

function formatDate(value) {
  if (!value) return "No registrada";
  const parsed = value.includes("T") ? new Date(value) : new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("es-CO", { year: "numeric", month: "long", day: "numeric" }).format(parsed);
}

function ticketCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const code = [...bytes].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 6).toUpperCase();
  return `SP-NOR-${new Date().getFullYear()}-${code}`;
}

function setMessage(target, message, type = "") {
  if (!target) return;
  target.className = `talent-form-message is-visible ${type}`.trim();
  target.textContent = message;
}

async function loadLocalData() {
  const response = await fetch("data/funcionarios.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`No se pudo cargar el directorio (${response.status}).`);
  const data = await response.json();
  state.officials = Array.isArray(data.officials) ? data.officials : [];
  state.processes = Array.isArray(data.considerationProcesses) ? data.considerationProcesses : [];
  state.metadata = data;
}

function officialCard(person) {
  const email = person.email ? `<a href="mailto:${esc(person.email)}"><b aria-hidden="true">@</b><span>${esc(person.email)}</span></a>` : "";
  const phoneHref = person.phone ? person.phone.replace(/[^+\d]/g, "") : "";
  const phone = person.phone ? `<a href="tel:${esc(phoneHref)}"><b aria-hidden="true">☎</b><span>${esc(person.phone)}</span></a>` : "";
  return `<article class="official-card" data-id="${esc(person.id)}">
    <div class="official-card-top"><div class="official-avatar" aria-hidden="true">${esc(initials(person.name))}</div><span class="official-status">${esc(person.status || "Activo")}</span></div>
    <div class="official-card-body">
      <h3>${esc(person.name)}</h3>
      <p class="official-position">${esc(person.position || "Cargo no especificado")}</p>
      <p class="official-department">${esc(person.department || "Dependencia por verificar")}</p>
      <div class="official-details">${email}${phone}</div>
      <div class="official-card-actions">
        <button class="official-primary" type="button" data-profile="${esc(person.id)}">Ver perfil</button>
        <a href="${safeUrl(person.cvUrl || person.profileUrl)}" target="_blank" rel="noopener noreferrer">Hoja de vida ↗</a>
        <button type="button" data-comment="${esc(person.id)}">Comentar</button>
      </div>
    </div>
    <div class="official-card-meta"><span>Verificado: ${esc(formatDate(person.sourceUpdatedAt))}</span><span>${esc(person.sourceStatus || "Fuente oficial")}</span></div>
  </article>`;
}

function renderOfficials() {
  const query = normalize($("#officialSearch")?.value || "");
  const department = $("#departmentFilter")?.value || "";
  const status = $("#statusFilter")?.value || "";
  const filtered = state.officials.filter((person) => {
    const haystack = normalize([person.name, person.position, person.department, person.email, ...(person.tags || [])].join(" "));
    return (!query || haystack.includes(query))
      && (!department || person.department === department)
      && (!status || person.status === status);
  });
  const target = $("#officialGrid");
  target.classList.toggle("is-list", state.view === "list");
  target.innerHTML = filtered.length
    ? filtered.map(officialCard).join("")
    : `<div class="official-empty"><strong>No se encontraron perfiles.</strong><p>Prueba con otro nombre, cargo o dependencia.</p></div>`;
  $("#resultSummary").textContent = `${filtered.length} de ${state.officials.length} perfiles visibles`;
  bindOfficialActions();
}

function processCard(process) {
  const active = normalize(process.status).includes("abiert") || normalize(process.status).includes("activo");
  return `<article class="consideration-card">
    <div class="consideration-top"><span>${esc(process.status || "Publicado")}</span><span>${active ? "Observaciones habilitadas" : "Archivo verificable"}</span></div>
    <h3>${esc(process.title)}</h3>
    <p>${esc(process.summary || "")}</p>
    <div class="consideration-period">
      <div><small>Inicio</small><strong>${esc(formatDate(process.startDate))}</strong></div>
      <div><small>Cierre</small><strong>${esc(formatDate(process.endDate))}</strong></div>
    </div>
    <div class="consideration-actions">
      <a href="${safeUrl(process.documentUrl)}" target="_blank" rel="noopener noreferrer">Abrir publicación ↗</a>
      ${active || process.commentsEnabled ? `<button type="button" data-process-comment="${esc(process.id)}">Presentar observación</button>` : ""}
    </div>
  </article>`;
}

function renderProcesses() {
  const target = $("#considerationGrid");
  const active = state.processes.filter((item) => /activo|abierto|consulta/i.test(item.status || ""));
  const notice = active.length ? "" : `<article class="consideration-card"><div class="consideration-top"><span>Estado actual</span><span>Sin proceso activo identificado</span></div><h3>Sección permanente habilitada</h3><p>No se identificó en la fuente institucional un periodo vigente de observaciones al corte publicado. Cuando Talento Humano publique un nuevo proceso, la sincronización lo incorporará y habilitará el formulario asociado.</p><div class="consideration-actions"><a href="https://www.sanpedro-valle.gov.co/tema/ofertas-de-empleo" target="_blank" rel="noopener noreferrer">Revisar ofertas de empleo ↗</a><a href="https://www.sanpedro-valle.gov.co/buscar?q=hoja%20de%20vida" target="_blank" rel="noopener noreferrer">Buscar hojas de vida ↗</a></div></article>`;
  target.innerHTML = notice + state.processes.map(processCard).join("");
  $$('[data-process-comment]').forEach((button) => button.addEventListener("click", () => {
    selectObservationTarget(`process:${button.dataset.processComment}`);
  }));
}

function fillFilters() {
  const departments = [...new Set(state.officials.map((person) => person.department).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  $("#departmentFilter").innerHTML = `<option value="">Todas las dependencias</option>${departments.map((name) => `<option>${esc(name)}</option>`).join("")}`;
}

function fillObservationTargets() {
  const officialOptions = state.officials.map((person) => `<option value="official:${esc(person.id)}">${esc(person.name)} · ${esc(person.position)}</option>`).join("");
  const processOptions = state.processes.map((process) => `<option value="process:${esc(process.id)}">${esc(process.title)}</option>`).join("");
  $("#observationTarget").innerHTML = `<option value="">Selecciona una opción</option><optgroup label="Funcionarios y servidores">${officialOptions}</optgroup><optgroup label="Procesos de consideración">${processOptions}</optgroup>`;
}

function updateStats() {
  $("#statOfficials").textContent = String(state.officials.length);
  $("#statDepartments").textContent = String(new Set(state.officials.map((person) => person.department).filter(Boolean)).size);
  $("#statCvLinks").textContent = String(state.officials.filter((person) => person.cvUrl || person.sigepUrl || person.profileUrl).length);
  $("#statProcesses").textContent = String(state.processes.length);
  const updated = state.metadata?.generatedAt || state.officials[0]?.sourceUpdatedAt;
  if (updated) {
    $("#syncDate").textContent = formatDate(updated);
    $("#footerSyncDate").textContent = formatDate(updated);
  }
}

function openProfile(person) {
  const dialog = $("#profileDialog");
  const tags = (person.tags || []).map((tag) => `<span>${esc(tag)}</span>`).join(" · ");
  $("#profileDialogBody").innerHTML = `<div class="talent-profile-head"><div class="official-avatar" aria-hidden="true">${esc(initials(person.name))}</div><h2 id="profileDialogTitle">${esc(person.name)}</h2><p>${esc(person.position)} · ${esc(person.department)}</p></div><div class="talent-profile-content"><div class="talent-profile-facts"><div><small>Correo institucional</small><a href="mailto:${esc(person.email || "")}">${esc(person.email || "No publicado")}</a></div><div><small>Teléfono</small><strong>${esc(person.phone || "No publicado")}</strong></div><div><small>Estado</small><strong>${esc(person.status || "Activo")}</strong></div><div><small>Última verificación</small><strong>${esc(formatDate(person.sourceUpdatedAt))}</strong></div></div><p>${esc(person.sourceStatus || "Información tomada de la fuente institucional.")}</p>${tags ? `<p><strong>Áreas relacionadas:</strong> ${tags}</p>` : ""}<div class="talent-profile-actions"><a class="talent-btn talent-btn-blue" href="${safeUrl(person.profileUrl)}" target="_blank" rel="noopener noreferrer">Perfil institucional ↗</a><a class="talent-btn talent-btn-gold" href="${safeUrl(person.sigepUrl)}" target="_blank" rel="noopener noreferrer">Consultar SIGEP II ↗</a><button class="talent-btn talent-btn-glass" style="color:#0a3f91;border-color:#cbd9e9" type="button" data-modal-comment="${esc(person.id)}">Presentar observación</button></div></div>`;
  dialog.showModal();
  $("[data-modal-comment]", dialog)?.addEventListener("click", () => {
    dialog.close();
    selectObservationTarget(`official:${person.id}`);
  });
}

function selectObservationTarget(value) {
  $("#observationTarget").value = value;
  document.querySelector("#participar").scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => $("#observationTarget").focus(), 450);
}

function bindOfficialActions() {
  $$('[data-profile]').forEach((button) => button.addEventListener("click", () => {
    const person = state.officials.find((item) => item.id === button.dataset.profile);
    if (person) openProfile(person);
  }));
  $$('[data-comment]').forEach((button) => button.addEventListener("click", () => selectObservationTarget(`official:${button.dataset.comment}`)));
}

function targetMetadata(value) {
  const [kind, id] = value.split(":");
  if (kind === "official") {
    const person = state.officials.find((item) => item.id === id);
    return person ? { id: `funcionario-${person.id}`, title: `${person.name} · ${person.position}` } : null;
  }
  const process = state.processes.find((item) => item.id === id);
  return process ? { id: `proceso-${process.id}`, title: process.title } : null;
}

async function initFirebase() {
  try {
    const [appModule, firestoreModule] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js")
    ]);
    const app = appModule.initializeApp(FIREBASE_CONFIG, "talento-publico");
    state.firebase = { app, db: firestoreModule.getFirestore(app), firestore: firestoreModule };
    await loadRemoteProcesses();
  } catch (error) {
    console.warn("Firebase no disponible; la consulta pública permanece visible, pero la radicación se bloqueará para evitar registros no oficiales.", error);
  }
}

async function loadRemoteProcesses() {
  if (!state.firebase) return;
  const { collection, getDocs, query, where } = state.firebase.firestore;
  try {
    const snapshot = await getDocs(query(collection(state.firebase.db, COLLECTIONS.publications), where("published", "==", true), where("category", "==", "cv")));
    if (!snapshot.empty) {
      const map = new Map(state.processes.map((item) => [item.id, item]));
      snapshot.docs.forEach((entry) => {
        const item = entry.data();
        map.set(entry.id, {
          id: entry.id,
          title: item.title,
          position: item.position || item.number || "Cargo publicado",
          status: item.status || "Publicado",
          startDate: item.start || "",
          endDate: item.end || "",
          responsible: item.responsible || "Talento Humano",
          summary: item.summary || "Proceso publicado en la micropágina institucional.",
          documentUrl: item.documentUrl || item.sourceUrl || "",
          commentsEnabled: true
        });
      });
      state.processes = [...map.values()];
      renderProcesses();
      fillObservationTargets();
      updateStats();
    }
  } catch (error) {
    console.warn("No fue posible cargar procesos remotos.", error);
  }
}

async function submitObservation(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $("#officialFormMessage");
  if ($("#officialWebsiteField").value) return;
  if (!form.reportValidity()) {
    setMessage(message, "Revisa los campos obligatorios antes de continuar.", "error");
    return;
  }
  const target = targetMetadata($("#observationTarget").value);
  if (!target) {
    setMessage(message, "Selecciona un funcionario o proceso válido.", "error");
    return;
  }
  const lastSent = Number(localStorage.getItem("ga-last-observation") || 0);
  if (Date.now() - lastSent < 45000) {
    setMessage(message, "Espera unos segundos antes de realizar una nueva radicación.", "error");
    return;
  }
  const ticket = ticketCode();
  const payload = {
    ticket,
    publicationId: target.id,
    publicationTitle: target.title,
    citizenName: $("#observationName").value.trim(),
    citizenEmail: $("#observationEmail").value.trim().toLowerCase(),
    type: $("#observationType").value,
    articleReference: "Directorio y hojas de vida",
    text: $("#observationText").value.trim(),
    consent: $("#observationConsent").checked,
    status: "Radicada",
    source: "Micropágina Gobierno Abierto y Normativa",
    createdAtIso: new Date().toISOString(),
    userAgent: navigator.userAgent.slice(0, 240)
  };
  const button = $("#submitOfficialObservation");
  button.disabled = true;
  button.textContent = "Radicando…";
  try {
    if (!state.firebase) throw new Error("Firebase no está disponible para una radicación oficial.");
    const { addDoc, collection, serverTimestamp } = state.firebase.firestore;
    await addDoc(collection(state.firebase.db, COLLECTIONS.observations), { ...payload, createdAt: serverTimestamp() });
    localStorage.setItem("ga-last-observation", String(Date.now()));
    form.reset();
    $("#observationCount").textContent = "0";
    setMessage(message, `Observación radicada correctamente. Código de seguimiento: ${ticket}. Consérvalo para consultar la respuesta.`, "success");
  } catch (error) {
    console.error(error);
    setMessage(message, "No fue posible radicar en este momento. Utiliza el canal PQRSD institucional.", "error");
  } finally {
    button.disabled = false;
    button.textContent = "Radicar observación";
  }
}

async function searchTracking() {
  const code = $("#officialTrackingCode").value.trim().toUpperCase();
  const target = $("#officialTrackingResult");
  if (!/^SP-NOR-\d{4}-[A-Z0-9]{6}$/.test(code)) {
    target.innerHTML = `<article><h3>Código no válido</h3><p>Usa el formato SP-NOR-2026-ABC123.</p></article>`;
    return;
  }
  target.innerHTML = `<article><p>Consultando respuesta institucional…</p></article>`;
  if (!state.firebase) {
    target.innerHTML = `<article><h3>Consulta no disponible sin conexión</h3><p>Conserva el código y vuelve a intentarlo cuando el servicio esté disponible.</p></article>`;
    return;
  }
  try {
    const { collection, getDocs, limit, query, where } = state.firebase.firestore;
    const snapshot = await getDocs(query(collection(state.firebase.db, COLLECTIONS.publicResponses), where("ticket", "==", code), where("published", "==", true), limit(1)));
    if (snapshot.empty) {
      target.innerHTML = `<article><h3>Observación recibida o en gestión</h3><p>Aún no existe una respuesta pública asociada al código. La información de contacto permanece privada.</p></article>`;
      return;
    }
    const response = snapshot.docs[0].data();
    target.innerHTML = `<article><h3>${esc(response.publicationTitle || "Respuesta institucional")}</h3><p><strong>Estado:</strong> ${esc(response.status || "Respondida")}</p><p>${esc(response.responseText || "La respuesta se encuentra publicada.")}</p><p><small>Fecha: ${esc(formatDate(response.publishedAtIso || response.createdAtIso))}</small></p></article>`;
  } catch (error) {
    console.error(error);
    target.innerHTML = `<article><h3>No fue posible consultar</h3><p>Verifica el código o intenta nuevamente más tarde.</p></article>`;
  }
}

function bindUi() {
  ["#officialSearch", "#departmentFilter", "#statusFilter"].forEach((selector) => {
    const element = $(selector);
    element.addEventListener(selector === "#officialSearch" ? "input" : "change", renderOfficials);
  });
  $("#clearOfficialFilters").addEventListener("click", () => {
    $("#officialSearch").value = "";
    $("#departmentFilter").value = "";
    $("#statusFilter").value = "";
    renderOfficials();
  });
  $$('[data-view]').forEach((button) => button.addEventListener("click", () => {
    state.view = button.dataset.view;
    $$('[data-view]').forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    renderOfficials();
  }));
  $("#closeProfileDialog").addEventListener("click", () => $("#profileDialog").close());
  $("#profileDialog").addEventListener("click", (event) => { if (event.target === event.currentTarget) event.currentTarget.close(); });
  $("#officialObservationForm").addEventListener("submit", submitObservation);
  $("#observationText").addEventListener("input", (event) => { $("#observationCount").textContent = String(event.target.value.length); });
  $("#searchOfficialTracking").addEventListener("click", searchTracking);
  $("#officialTrackingCode").addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); searchTracking(); } });
}

async function init() {
  bindUi();
  try {
    await loadLocalData();
    fillFilters();
    fillObservationTargets();
    renderOfficials();
    renderProcesses();
    updateStats();
  } catch (error) {
    console.error(error);
    $("#officialGrid").innerHTML = `<div class="official-empty"><strong>No fue posible cargar el directorio.</strong><p>Consulta temporalmente la fuente institucional enlazada en esta página.</p></div>`;
  }
  await initFirebase();
}

document.addEventListener("DOMContentLoaded", init);

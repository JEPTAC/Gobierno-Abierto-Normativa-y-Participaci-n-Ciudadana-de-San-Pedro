import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { load } from "cheerio";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_FILE = path.join(ROOT, "data", "funcionarios.json");
const REPORT_FILE = path.join(ROOT, "docs", "ultimo-reporte-sincronizacion.json");
const CSV_FILE = path.join(ROOT, "docs", "directorio-funcionarios-verificados.csv");
const BASE = "https://www.sanpedro-valle.gov.co";
const SOURCES = [
  `${BASE}/tema/directorio-de-funcionarios`,
  `${BASE}/directorio-de-funcionarios/directorio-de-funcionarios-269806`,
  `${BASE}/buscar?q=hoja%20de%20vida`,
  `${BASE}/tema/ofertas-de-empleo`,
  `${BASE}/tema/convocatorias`
];
const USER_AGENT = "Mozilla/5.0 (compatible; SanPedroTransparenciaBot/1.0; +https://www.sanpedro-valle.gov.co/)";

function clean(value = "") {
  return String(value).replace(/\s+/g, " ").replace(/^[\s:–—-]+|[\s:–—-]+$/g, "").trim();
}

function slugify(value = "") {
  return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
}

function absolute(href, base = BASE) {
  try {
    const url = new URL(href, base);
    if (url.hostname !== "www.sanpedro-valle.gov.co" && url.hostname !== "sanpedro-valle.gov.co" && !url.hostname.endsWith("funcionpublica.gov.co")) return "";
    url.hash = "";
    return url.href;
  } catch {
    return "";
  }
}

async function fetchText(url, attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);
      const response = await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" }, signal: controller.signal, redirect: "follow" });
      clearTimeout(timer);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw lastError;
}

function textAfterLabel(text, labels) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = text.match(new RegExp(`${escaped}\\s*:?\\s*([^|\\n]{2,180})`, "i"));
    if (match) return clean(match[1].split(/Correo|Tel[eé]fono|Enlace|Dependencia|Cargo/i)[0]);
  }
  return "";
}

function inferDepartment(position = "") {
  const p = position.toLowerCase();
  if (p.includes("alcalde")) return "Despacho del Alcalde";
  if (p.includes("control interno")) return "Oficina de Control Interno";
  if (p.includes("comis")) return "Comisaría de Familia";
  if (p.includes("gobierno") || p.includes("convivencia") || p.includes("seguridad")) return "Secretaría de Gobierno, Convivencia y Seguridad Ciudadana";
  if (p.includes("hacienda") || p.includes("tesorer")) return "Secretaría de Hacienda";
  if (p.includes("planeaci")) return "Secretaría de Planeación";
  if (p.includes("educaci") || p.includes("cultura") || p.includes("deporte")) return "Educación, Cultura y Deporte";
  if (p.includes("general") || p.includes("administrativ")) return "Secretaría General y Desarrollo Institucional";
  return "Dependencia por verificar";
}

function parseProfile(html, profileUrl) {
  const $ = load(html);
  $("script,style,noscript,svg").remove();
  const pageText = clean($("body").text());
  const rawTitle = clean($("h1").first().text() || $("meta[property='og:title']").attr("content") || $("title").text());
  const name = clean(rawTitle.replace(/\s*[-|].*Alcald[ií]a.*$/i, "").replace(/^Directorio de funcionarios\s*/i, ""));
  const position = textAfterLabel(pageText, ["Cargo", "Empleo", "Denominación del empleo"]);
  const department = textAfterLabel(pageText, ["Dependencia", "Área", "Secretaría"]) || inferDepartment(position);
  const emailMatch = pageText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phone = textAfterLabel(pageText, ["Teléfono", "Telefono", "PBX"]);
  let sigepUrl = "";
  let cvUrl = "";
  let photoUrl = "";
  $("a[href]").each((_, node) => {
    const href = absolute($(node).attr("href"), profileUrl);
    const label = clean($(node).text()).toLowerCase();
    if (!href) return;
    if (!sigepUrl && (/sigep|funcionpublica/.test(href.toLowerCase()) || /sigep|hoja de vida/.test(label))) sigepUrl = href;
    if (!cvUrl && (/\.pdf(?:$|\?)/i.test(href) || /hoja de vida|curr[ií]cul/.test(label))) cvUrl = href;
  });
  $("main img, article img, .field img, .contenido img").each((_, node) => {
    if (photoUrl) return;
    const src = absolute($(node).attr("src"), profileUrl);
    const alt = clean($(node).attr("alt")).toLowerCase();
    if (src && !/logo|escudo|gov\.co/.test(`${src} ${alt}`.toLowerCase())) photoUrl = src;
  });
  if (!name || name.length < 4 || /directorio de funcionarios/i.test(name) || !position) return null;
  return {
    id: slugify(name),
    name,
    position,
    department,
    email: emailMatch?.[0] || "",
    phone,
    profileUrl,
    sigepUrl: sigepUrl || "https://www.funcionpublica.gov.co/sigep2/directorio",
    cvUrl: cvUrl || sigepUrl || profileUrl,
    status: "Activo",
    sourceStatus: "Sincronizado desde el directorio institucional",
    sourceUpdatedAt: new Date().toISOString().slice(0, 10),
    photoUrl,
    tags: [...new Set([department, ...position.split(/[,&/]/)].map(clean).filter(Boolean))].slice(0, 6)
  };
}

function discoverProfileLinks(html, sourceUrl) {
  const $ = load(html);
  const links = new Set();
  $("a[href]").each((_, node) => {
    const href = absolute($(node).attr("href"), sourceUrl);
    if (!href) return;
    const url = new URL(href);
    if (/^\/directorio-de-funcionarios\/[a-z0-9-]+\/?$/i.test(url.pathname)
      && !/directorio-de-funcionarios-\d+/.test(url.pathname)) links.add(href);
  });
  return [...links];
}

function discoverProcesses(html, sourceUrl) {
  const $ = load(html);
  const results = [];
  $("a[href]").each((_, node) => {
    const title = clean($(node).text());
    const href = absolute($(node).attr("href"), sourceUrl);
    if (!href || title.length < 8) return;
    if (!/hoja(?:s)? de vida|aspirante|candidato|convocatoria|control interno/i.test(title)) return;
    results.push({
      id: slugify(title),
      title,
      position: /control interno/i.test(title) ? "Jefe de Control Interno" : "Cargo indicado en la publicación",
      status: "Publicado",
      startDate: "",
      endDate: "",
      responsible: "Secretaría General y Desarrollo Institucional / Talento Humano",
      summary: "Publicación localizada automáticamente en la sede electrónica. Consulte la fuente para conocer el alcance, fechas y documentos del proceso.",
      documentUrl: href,
      commentsEnabled: true
    });
  });
  return results;
}

function mergeOfficials(previous, discovered, discoveredUrls = new Set(), directoryHealthy = false) {
  const now = new Date().toISOString();
  const map = new Map();
  const discoveredIds = new Set(discovered.map((item) => item.id));

  for (const previousItem of previous) {
    if (previousItem.manualProtected === true) {
      map.set(previousItem.id, {
        ...previousItem,
        lastVerificationAttemptAt: now,
        sourceStatus: previousItem.sourceStatus || "Ficha pública protegida preservada por la sincronización automática."
      });
      continue;
    }
    const profileLocated = discoveredUrls.has(previousItem.profileUrl);
    if (discoveredIds.has(previousItem.id) || profileLocated || !directoryHealthy) {
      map.set(previousItem.id, previousItem);
      continue;
    }
    const missedRuns = Number(previousItem.missedRuns || 0) + 1;
    map.set(previousItem.id, {
      ...previousItem,
      missedRuns,
      lastVerificationAttemptAt: now,
      status: missedRuns >= 2 ? "Histórico / no localizado" : "Pendiente de verificación",
      sourceStatus: missedRuns >= 2
        ? "El perfil dejó de localizarse en dos sincronizaciones consecutivas; se conserva como histórico hasta validación institucional."
        : "El perfil no se localizó en la última sincronización; se conserva mientras se realiza una segunda verificación."
    });
  }

  for (const item of discovered) {
    const previousItem = map.get(item.id) || previous.find((entry) => entry.id === item.id) || {};
    map.set(item.id, {
      ...previousItem,
      ...item,
      status: "Activo",
      missedRuns: 0,
      firstSeenAt: previousItem.firstSeenAt || now,
      lastSeenAt: now,
      lastVerificationAttemptAt: now
    });
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}


function csvCell(value = "") {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function officialsCsv(officials) {
  const headers = ["Nombre", "Cargo", "Dependencia", "Tipo de vinculación", "Código", "Grado", "Formación académica pública", "Experiencia laboral pública", "Correo institucional", "Teléfono", "Perfil institucional", "Hoja de vida / SIGEP", "Estado", "Fecha de verificación", "Estado de fuente"];
  const rows = officials.map((item) => [
    item.name, item.position, item.department, item.employmentType || "No especificado",
    item.career?.employmentCode || "", item.career?.grade || "",
    item.educationSummary || "", item.experienceSummary || "",
    item.email, item.phone, item.profileUrl, item.cvUrl || item.sigepUrl,
    item.status, item.sourceUpdatedAt, item.sourceStatus
  ]);
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

function mergeProcesses(previous, discovered) {
  const map = new Map(previous.map((item) => [item.id, item]));
  discovered.forEach((item) => map.set(item.id, { ...map.get(item.id), ...item }));
  return [...map.values()].sort((a, b) => a.title.localeCompare(b.title, "es"));
}

async function main() {
  const startedAt = new Date().toISOString();
  const current = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
  const sourceReports = [];
  const profileLinks = new Set();
  const processes = [];

  for (const source of SOURCES) {
    try {
      const html = await fetchText(source);
      const links = discoverProfileLinks(html, source);
      links.forEach((link) => profileLinks.add(link));
      processes.push(...discoverProcesses(html, source));
      sourceReports.push({ source, ok: true, profileLinks: links.length });
    } catch (error) {
      sourceReports.push({ source, ok: false, error: String(error.message || error) });
    }
  }

  const discoveredOfficials = [];
  for (const profileUrl of profileLinks) {
    try {
      const html = await fetchText(profileUrl);
      const profile = parseProfile(html, profileUrl);
      if (profile) discoveredOfficials.push(profile);
    } catch (error) {
      sourceReports.push({ source: profileUrl, ok: false, error: String(error.message || error) });
    }
  }

  if (discoveredOfficials.length === 0 && sourceReports.every((item) => !item.ok)) {
    throw new Error("Ninguna fuente institucional respondió. Se conserva el archivo anterior sin cambios.");
  }

  const directoryHealthy = sourceReports.some((item) => item.ok && /directorio-de-funcionarios/.test(item.source));
  const officials = mergeOfficials(current.officials || [], discoveredOfficials, profileLinks, directoryHealthy);
  const considerationProcesses = mergeProcesses(current.considerationProcesses || [], processes);
  const completedAt = new Date().toISOString();
  const output = {
    ...current,
    generatedAt: completedAt,
    sync: {
      ...current.sync,
      status: "Sincronización automática completada",
      lastSuccessfulRun: completedAt,
      discoveredProfiles: profileLinks.size,
      synchronizedProfiles: discoveredOfficials.length,
      totalProfiles: officials.length
    },
    officials,
    considerationProcesses
  };
  const report = {
    startedAt,
    completedAt,
    totalProfileLinks: profileLinks.size,
    parsedProfiles: discoveredOfficials.length,
    totalPublishedProfiles: officials.length,
    processesDiscovered: processes.length,
    sources: sourceReports
  };
  await fs.writeFile(DATA_FILE, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  await fs.writeFile(CSV_FILE, officialsCsv(officials), "utf8");
  await fs.writeFile(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main().catch(async (error) => {
  const report = { completedAt: new Date().toISOString(), ok: false, error: String(error.stack || error) };
  await fs.writeFile(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.error(error);
  process.exitCode = 1;
});

// Versiones de la app Android. Los APK y el registro viven en public/descargas/ y Render los publica
// con cada despliegue. Para publicar una versión: scripts/publicar-version.ts (ver README).
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const CARPETA_DESCARGAS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "descargas");
const REGISTRO = path.join(CARPETA_DESCARGAS, "versiones.json");

export interface Version {
  version: string;      // versionName de Flutter, "1.2.0"
  build: number;        // versionCode de Flutter, siempre creciente
  archivo: string;      // nombre del APK dentro de public/descargas
  notas: string;
  obligatoria: boolean; // si true, la app no deja seguir sin actualizar
  fecha: string;        // ISO
  tamano_bytes?: number;
}

export async function leerVersiones(): Promise<Version[]> {
  try {
    const lista = JSON.parse(await readFile(REGISTRO, "utf8")) as Version[];
    return lista.sort((a, b) => b.build - a.build);
  } catch {
    return [];
  }
}

/**
 * Qué debe hacer una app que tiene instalado el build `buildActual`.
 * Es obligatoria si cualquier versión posterior a la instalada fue marcada como obligatoria.
 */
export async function estadoActualizacion(buildActual: number, baseUrl: string) {
  const versiones = await leerVersiones();
  const ultima = versiones[0];
  if (!ultima) return { hay_actualizacion: false, obligatoria: false, ultima: null };
  const pendientes = versiones.filter((v) => v.build > buildActual);
  return {
    hay_actualizacion: pendientes.length > 0,
    obligatoria: pendientes.some((v) => v.obligatoria),
    ultima: { ...ultima, url: `${baseUrl}/descargas/${encodeURIComponent(ultima.archivo)}` },
    cambios: pendientes.map((v) => ({ version: v.version, fecha: v.fecha, notas: v.notas })),
  };
}

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Página sencilla para la primera instalación desde el celular. */
export async function paginaDescarga(baseUrl: string): Promise<string> {
  const versiones = await leerVersiones();
  const ultima = versiones[0];
  const mb = (b?: number) => (b ? ` · ${(b / 1_048_576).toFixed(1)} MB` : "");
  const historial = versiones.map((v) =>
    `<li><a href="${baseUrl}/descargas/${encodeURIComponent(v.archivo)}">Versión ${escapar(v.version)}</a>
     <span>${new Date(v.fecha).toLocaleDateString("es-CO")}${mb(v.tamano_bytes)}</span><p>${escapar(v.notas)}</p></li>`).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Comparador de precios</title>
<style>
  body{font-family:system-ui,sans-serif;margin:0;background:#f5f5f5;color:#222}
  main{max-width:520px;margin:0 auto;padding:24px 16px}
  h1{font-size:1.5rem;margin:0 0 4px} .sub{color:#666;margin:0 0 24px}
  .boton{display:block;text-align:center;background:#0a7d3b;color:#fff;padding:16px;border-radius:12px;text-decoration:none;font-size:1.1rem;font-weight:600}
  .ayuda{font-size:.9rem;color:#555;background:#fff;border-radius:12px;padding:12px 16px;margin-top:16px}
  ul{list-style:none;padding:0} li{background:#fff;border-radius:12px;padding:12px 16px;margin:8px 0}
  li span{color:#777;font-size:.85rem;margin-left:8px} li p{margin:6px 0 0;font-size:.9rem;color:#444}
</style></head><body><main>
<h1>Comparador de precios</h1><p class="sub">D1 · Megaredil · Ara — Bucaramanga</p>
${ultima
    ? `<a class="boton" href="${baseUrl}/descargas/${encodeURIComponent(ultima.archivo)}">Descargar versión ${escapar(ultima.version)}${mb(ultima.tamano_bytes)}</a>
<div class="ayuda">Al abrir el archivo, Android puede pedir permiso para <b>instalar apps de origen desconocido</b>. Acéptalo solo para tu navegador.
Las siguientes versiones se instalan desde la misma app.</div>
<h2>Versiones</h2><ul>${historial}</ul>`
    : `<p>Todavía no hay versiones publicadas.</p>`}
</main></body></html>`;
}

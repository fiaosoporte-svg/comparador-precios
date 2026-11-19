// Publica una versión nueva de la app Android.
//
//   cd app && flutter build apk --release
//   cd ../api && npx tsx scripts/publicar-version.ts --notas "Qué cambió" [--obligatoria] [--apk ruta.apk]
//   git add . && git commit -m "App 1.2.0" && git push      -> Render despliega y la app avisa a todos
//
// Toma version y build del pubspec.yaml ("version: 1.2.0+5" -> versión 1.2.0, build 5).
import { copyFile, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CARPETA_DESCARGAS, leerVersiones, Version } from "../src/versiones.js";

const MANTENER_APKS = 3; // los APK pesan ~20 MB: se guardan solo los últimos en el repositorio

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const valor = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };

const pubspec = await readFile(path.join(raiz, "app", "pubspec.yaml"), "utf8");
const m = pubspec.match(/^version:\s*(\d+\.\d+\.\d+)\+(\d+)/m);
if (!m) throw new Error('pubspec.yaml debe tener "version: X.Y.Z+BUILD"');
const [, version, buildTxt] = m;
const build = Number(buildTxt);

const apk = valor("--apk") ?? path.join(raiz, "app", "build", "app", "outputs", "flutter-apk", "app-release.apk");
const notas = valor("--notas") ?? "";
const obligatoria = args.includes("--obligatoria");

const versiones = await leerVersiones();
if (versiones.some((v) => v.build >= build)) {
  throw new Error(`Ya hay una versión con build >= ${build}. Sube el número después del + en pubspec.yaml.`);
}

const archivo = `comparador-precios-${version}.apk`;
await copyFile(apk, path.join(CARPETA_DESCARGAS, archivo));
const nueva: Version = { version, build, archivo, notas, obligatoria, fecha: new Date().toISOString(), tamano_bytes: (await stat(apk)).size };

// conservar solo los últimos APK; el resto sale del registro
const lista = [nueva, ...versiones].sort((a, b) => b.build - a.build).slice(0, MANTENER_APKS);
const conservar = new Set(lista.map((v) => v.archivo));
for (const f of await readdir(CARPETA_DESCARGAS)) {
  if (f.endsWith(".apk") && !conservar.has(f)) await unlink(path.join(CARPETA_DESCARGAS, f));
}
await writeFile(path.join(CARPETA_DESCARGAS, "versiones.json"), JSON.stringify(lista, null, 2) + "\n");

console.log(`Versión ${version} (build ${build}) lista en public/descargas/${archivo}${obligatoria ? " [OBLIGATORIA]" : ""}`);
console.log("Ahora: git add . && git commit && git push  -> Render la publica.");

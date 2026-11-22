// Megaredil (Bucaramanga): plataforma Parze, ver parze.ts.
import { categoriasMasViejasParze, MEGAREDIL, parsearPagina as parsear, refrescarParze, sincronizarCategoriasParze } from "./parze.js";

export const parsearPagina = (pagina: string, slug: string) => parsear(pagina, slug, MEGAREDIL);
export const refrescarMegaredil = (slugs: string[]) => refrescarParze(MEGAREDIL, slugs);
export const sincronizarCategorias = () => sincronizarCategoriasParze(MEGAREDIL);
export const categoriasMasViejas = (n: number) => categoriasMasViejasParze(MEGAREDIL, n);

// Todorapidas (domicilios en Bucaramanga, Girón, Piedecuesta, Floridablanca, Lebrija; sede en Floridablanca):
// misma plataforma Parze que Megaredil, ver parze.ts. Publica precios con centavos (calculados), se redondean al peso.
import { categoriasMasViejasParze, parsearPagina as parsear, refrescarParze, sincronizarCategoriasParze, TODORAPIDAS } from "./parze.js";

export const parsearPaginaTodorapidas = (pagina: string, slug: string) => parsear(pagina, slug, TODORAPIDAS);
export const refrescarTodorapidas = (slugs: string[]) => refrescarParze(TODORAPIDAS, slugs);
export const sincronizarCategoriasTodorapidas = () => sincronizarCategoriasParze(TODORAPIDAS);
export const categoriasMasViejasTodorapidas = (n: number) => categoriasMasViejasParze(TODORAPIDAS, n);

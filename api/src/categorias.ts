// Categorías unificadas (ids = tabla categorias). Se decide por cómo EMPIEZA el nombre,
// porque las tiendas casi siempre ponen primero el tipo de producto ("Aceite de Soya...", "Arroz Diana...").
import { sinTildes } from "./normalizar.js";

type Regla = [id: string, empieza: string[], excluye?: string[]];

const REGLAS: Regla[] = [
  ["cereales", ["arroz achocolatado", "arroz inflado", "cereal", "granola", "avena en hojuelas", "avena hojuelas", "avena molida", "avena instantanea", "corn flakes", "zucaritas"]],
  ["arroz", ["arroz"], ["galleta", "sabor", "coco", "con pollo", "chino", "para sushi"]],
  ["aceites", ["aceite", "oleina"], ["bebe", "baby", "little angels", "corporal", "capilar", "cabello", "almendra", "masaje", "dispensador", "johnson", "argan", "mosqueta", "olla", "motor", "para auto"]],
  ["azucar", ["azucar"], ["glass", "pulverizada"]],
  ["panela", ["panela"], ["galleta"]],
  ["harinas", ["harina", "premezcla", "mezcla haz de oros", "masa para", "mezcla para"], ["galleta"]],
  ["lentejas", ["lenteja"]],
  ["frijoles", ["frijol", "frijoles", "frijol"]],
  ["arvejas", ["arveja", "alverja", "garbanzo", "blanquillo", "maiz pira", "maiz para"]],
  ["pastas", ["pasta", "espagueti", "spaghetti", "spaguetti", "macarron", "fideo", "tornillo", "conchas", "conchitas", "lasagna", "lasana", "penne", "fusilli", "fettuccine", "cabello de angel"], ["dental", "de tomate", "de ajo"]],
  ["cafe", ["cafe"], ["galleta", "taza", "cafetera", "molino", "filtro"]],
  ["chocolate", ["chocolate", "cocoa", "milo", "alimento en polvo milo", "bebida achocolatada", "chocolisto"], ["galleta", "barra", "chocolatina", "bombon", "cobertura", "tableta de chocolate blanco"]],
  ["sal", ["sal ", "sal refinada", "sal marina", "sal de mesa"]],
  ["atun", ["atun", "duo pack atun"], []],
  ["sardinas", ["sardina"]],
  ["salsas", ["salsa", "mayonesa", "mostaza", "ketchup", "vinagre", "caldo", "ricostilla", "dona gallina", "maggi", "sazonador", "condimento", "comino", "pimienta", "color ", "triguisar", "base para salsa", "mermelada"]],
  ["leche_polvo", ["leche en polvo"]],
  ["leche", ["leche"], ["condensada", "corporal", "crema", "limpiadora", "dulce de leche", "arequipe", "de magnesia", "en polvo", "body milk"]],
  ["quesos", ["queso", "quesito", "cuajada"], ["galleta", "arepa"]],
  ["yogur", ["yogur", "yogurt", "kumis", "kefir", "avena liquida", "bebida lactea"]],
  ["mantequilla", ["mantequilla", "margarina", "esparcible"]],
  ["huevos", ["huevo", "huevos"], ["kinder", "chocolate", "sorpresa", "pascua"]],
  ["pollo", ["pollo", "pechuga", "muslo", "contramuslo", "entremuslo", "alas de pollo", "molida de pollo", "filete de pollo"], ["nuggets", "salchicha", "caldo", "sabor"]],
  ["res", ["carne de res", "carne molida", "cadera de res", "bota", "muchacho", "posta", "sobrebarriga", "lomo de res", "punta de anca", "chatas", "costilla de res", "res "]],
  ["cerdo", ["cerdo", "lomo de cerdo", "costilla de cerdo", "milanesa de cerdo", "chuleta", "tocino", "pernil", "carne de cerdo"]],
  ["embutidos", ["salchicha", "salchichon", "jamon", "tocineta", "chorizo", "nuggets", "mortadela", "butifarra", "morcilla", "longaniza", "salami", "hamburguesa", "pepperoni", "rica ", "zenu "]],
  ["pan", ["pan ", "pan tajado", "mogolla", "tostada", "arepa", "croissant", "pandebono", "almojabana", "calado", "tortilla"], ["rallado"]],
  ["galletas", ["galleta", "galletas", "wafer", "ducales", "saltin", "festival", "ritz", "oreo", "tosh"]],
  ["snacks", ["papas", "papa ", "chito", "detodito", "mani", "doritos", "platanito", "chicharron", "rosquita", "snack", "chocolatina", "chicle", "goma", "caramelo", "bombon", "chupeta", "masmelo", "trident", "barra de cereal", "brownie", "ponque", "gelatina", "econopack", "tajadita"], ["para perro", "para gato"]],
  ["agua", ["agua"], ["de colonia", "micelar", "oxigenada", "de rosas", "saborizada"]],
  ["gaseosas", ["gaseosa", "bebida gaseosa", "coca cola", "coca-cola", "postobon", "pepsi", "sprite", "quatro", "big cola", "pony malta", "malta", "colombiana", "seven up", "7up"]],
  ["jugos", ["jugo", "nectar", "refresco", "te ", "te helado", "bebida", "hit ", "tutti frutti", "del valle", "gatorade", "powerade", "electrolit", "speed", "vive 100", "red bull", "monster", "avena alpina"], ["lactea", "achocolatada"]],
  ["cerveza", ["cerveza", "sixpack de cerveza", "aguardiente", "ron ", "vino", "whisky", "tequila", "vodka", "ginebra", "sangria", "aguila", "poker", "club colombia", "corona", "budweiser", "stella"]],
  ["detergente", ["detergente", "jabon en polvo", "jabon liquido para ropa", "jabon de ropa", "jabon en barra para ropa", "jabon rey", "jabon azul", "fab ", "ariel", "ace ", "ultrex", "rindex", "dersa"]],
  ["blanqueador", ["blanqueador", "cloro", "clorogel", "limpido", "blancox"]],
  ["lavaloza", ["lavaloza", "lava loza", "axion", "lavaplatos"]],
  ["suavizante", ["suavizante", "suavitel", "perfumador", "downy"]],
  ["limpiadores", ["limpiador", "limpia", "desinfectante", "multiusos", "fabuloso", "varsol", "desengrasante", "ambientador", "insecticida", "lustramuebles"]],
  ["papel_higienico", ["papel higienico"]],
  ["toallas_cocina", ["toalla de cocina", "toallas de cocina", "servilleta", "pano reutilizable"]],
  ["shampoo", ["shampoo", "champu", "acondicionador", "shampoo o acondicionador", "crema para peinar"]],
  ["crema_dental", ["crema dental", "pasta dental"]],
  ["jabon", ["jabon"], ["ropa", "rey", "azul", "en polvo", "lavaloza"]],
  ["desodorante", ["desodorante", "antitranspirante"]],
  ["toallas_higienicas", ["toalla higienica", "toallas higienicas", "toallas nosotras", "protector diario", "protectores diarios", "tampon"]],
  ["panales", ["panal", "panales", "pañal", "pañales", "pañitos", "panitos", "toallitas humedas"]],
  ["cuidado_bucal", ["cepillo dental", "cepillo de dientes", "cepillos dentales", "enjuague bucal", "enjuage bucal", "seda dental", "hilo dental", "listerine"]],
  ["afeitada", ["maquina de afeitar", "maquina afeitar", "prestobarba", "rasuradora", "espuma de afeitar", "espuma gillette", "gel de afeitar", "gillete gel", "gillette gel", "gillette mach", "gillette prestobarba", "repuesto maquina", "rpuesto maquina", "after shave", "cuchilla"]],
  ["cuidado_capilar", ["tinte", "tratamiento capilar", "tratamiento ", "mascarilla capilar", "gel para el cabello", "gel ego", "gel fijador", "cera para el cabello", "keratina"]],
  ["cuidado_piel", ["crema corporal", "crema para manos", "crema piel", "crema facial", "crema antiarrugas", "talco", "bloqueador", "protector solar", "vaselina", "locion corporal"]],
  ["hogar_desechables", ["bolsa de basura", "bolsas de basura", "bolsa aseo", "bolsa negra", "esponja", "esponjilla", "guante", "escoba", "trapero", "recogedor", "papel aluminio", "pelicula plastica", "papel autosellante", "vaso desechable", "vasos", "plato desechable", "plato blanco", "cuchara", "tenedor", "palillo", "pila ", "pilas ", "bombillo", "luz led", "encendedor", "fosforos", "pano ", "paño "]],
  ["congelados", ["helado", "empanada", "pizza", "tamal", "croqueta", "lasana congelada", "papa francesa", "papas francesas", "filete de salmon", "filete de tilapia", "filete de trucha", "camaron", "mixtura"]],
  ["drogueria", ["suero oral", "acetaminofen", "ibuprofeno", "alcohol antiseptico", "alcohol jgb", "algodon", "ensure", "pedialyte", "glucerna", "pediasure", "curitas", "gasa", "tapabocas"]],
  ["mascotas", ["alimento para perro", "alimento para gato", "comida para", "arena para gato", "cat chow", "dog chow", "chunky", "dogourmet", "gatsy", "pedigree", "whiskas", "purina", "max cat", "gatush", "comedero", "snack para perro", "agility", "br for"]],
  ["frutas_verduras", ["banano", "platano", "papa pastusa", "papa criolla", "papa sabanera", "tomate", "cebolla", "zanahoria", "limon", "naranja", "mandarina", "manzana", "paquete de manzana", "pera ", "mango", "aguacate", "pina", "papaya", "fresa", "mora ", "lulo", "maracuya", "guayaba", "uva", "pepino", "pimenton", "lechuga", "repollo", "brocoli", "cilantro", "yuca", "ahuyama", "habichuela", "remolacha", "apio", "granadilla", "patilla", "melon", "malla de"], ["jugo", "salsa", "pasta de tomate", "mermelada", "sabor", "gelatina"]],
];

// Si el prefijo no alcanza, se busca en todo el nombre.
const CONTIENE: [string, string[]][] = [
  ["frutas_verduras", ["megafruver"]],
  ["pan", ["megapan"]],
  ["mascotas", [" para perro", " para gato", "mascota"]],
  ["desodorante", [" desodorante", " antitranspirante"]],
  ["shampoo", [" shampoo", " acondicionador", " champu"]],
  ["crema_dental", [" crema dental"]],
  ["cuidado_bucal", [" cepillo dental", " enjuague bucal", " seda dental"]],
  ["detergente", [" detergente", " desmanchador"]],
  ["suavizante", [" suavizante"]],
  ["lavaloza", [" lavaloza", " lava loza", " lavaplatos"]],
];

/**
 * Cuando el nombre no basta (empieza por la marca: "Pantene Shampoo..."), se usa la categoría de la tienda.
 * Claves: slug de Megaredil sin el sufijo de UUID que traen algunas ("perros-828f123b-...").
 */
const POR_CATEGORIA_TIENDA: Record<string, string> = {
  perros: "mascotas", gatos: "mascotas",
  "cuidado-capilar-shampoo": "shampoo", tratamientos: "cuidado_capilar", "tintes-cabello": "cuidado_capilar",
  "cepillos-dentales": "cuidado_bucal", "enjuage-bucal": "cuidado_bucal", "ceda-dental": "cuidado_bucal",
  "afeitada-hombre": "afeitada", "afeitada-mujer": "afeitada",
  "cuidado-piel": "cuidado_piel", "talco-pies": "cuidado_piel", "talcos-polvo": "cuidado_piel",
  "jabones-barra": "jabon", "jabones-liquidos": "jabon",
  protectores: "toallas_higienicas", "toallas-higienicas": "toallas_higienicas",
  panales: "panales", panitos: "panales", "aseo-infantil": "panales",
  drogueria: "drogueria", "medicamentos-otc": "drogueria", "gel-antibacterial": "drogueria",
  "sal-y-condimentos": "salsas", "salsas-y-sazonadoras": "salsas", encurtidos: "salsas", "sopas-cremas-caldos-y-bases": "salsas",
  panaderia: "pan", megapanaderia: "pan", "pasta-para-flauta-y-pasta-para-empanada": "pan",
  "panaderia-y-pasteleria": "harinas", "reposteria-megaredil": "harinas",
  "pasabocas-megaredil": "snacks", confiteria: "snacks", "dulces-tipicos": "snacks", masmelos: "snacks",
  "lacteos-megaredil": "yogur", "quesos-megaredil": "quesos", "leches-liquidas": "leche",
  "alimento-lacteo": "leche_polvo", "leche-en-polvo-megaredil": "leche_polvo", "huevos-megaredil": "huevos",
  "galletas-crema": "galletas", "galletas-saludables": "galletas", "galletas-megaredil": "galletas",
  "gaseosas-megaredil": "gaseosas", "te-liquido": "jugos", bebidas: "jugos", "bebidas-jugos-hit-saviloe": "jugos", agua: "agua",
  "cafe-chocolate-aromaticas-y-te": "cafe", aromaticas: "cafe", coladas: "cereales", "pastas-megaredil": "pastas",
  "limpieza-cocina": "lavaloza", "ambientadores-megaredil": "limpiadores", desinfectantes: "limpiadores",
  "desengrasantes-casa": "limpiadores", insecticidas: "limpiadores", "aseo-hogar-megaredil": "limpiadores",
  desmanchadores: "detergente", "desmanchadores-telas": "detergente", "cuidado-telas": "detergente",
  "servilletas-y-toallas-cocina": "toallas_cocina",
  "implementos-hogar": "hogar_desechables", esponjillas: "hogar_desechables", "bolsas-aseo": "hogar_desechables",
  "escobas-traperos-mechas": "hogar_desechables", guantes: "hogar_desechables", panos: "hogar_desechables",
  aluminio: "hogar_desechables", vinipel: "hogar_desechables", platos: "hogar_desechables", vasos: "hogar_desechables",
  cubiertos: "hogar_desechables", "palillos-pinchos-paletas": "hogar_desechables", "hogar-megaredil": "hogar_desechables",
  helados: "congelados", "pescados-congelados": "congelados", precocidos: "congelados", "papas-y-acompanamientos": "congelados",
  "aperitivos-y-pasabocas": "congelados", "pizzas-y-productos-horneables": "congelados",
  jamon: "embutidos", salchichas: "embutidos", chorizos: "embutidos",
  megafruver: "frutas_verduras",
  // Todorapidas
  "insumos-panaderia": "harinas", panaderias: "harinas", esencias: "harinas", almidones: "harinas", "harina-de-trigo": "harinas",
  conservas: "salsas", condimentos: "salsas", aderezos: "salsas", salsas: "salsas", "salsas-institucionales": "salsas", "cremas-cocina": "salsas",
  hogar: "hogar_desechables", portacomidas: "hogar_desechables", "portacomidas-papel-y-carton": "hogar_desechables", bolsas: "hogar_desechables",
  desechables: "hogar_desechables", aluminios: "hogar_desechables", palos: "hogar_desechables", bandejas: "hogar_desechables", pitillos: "hogar_desechables",
  aseo: "limpiadores", "blanqueadores-y-ambientadores": "limpiadores",
  "detergentes-polvo-liquido-y-barra": "detergente", "suavizantes-y-quitamanchas": "suavizante",
  snacks: "snacks", confites: "snacks", dulces: "snacks", bocadillos: "snacks", "bocadillos-industriales": "snacks", chocolates: "snacks",
  "papa-perros": "snacks", arequipes: "snacks", "tortas-y-ponques": "snacks",
  "micheladas-y-granizados": "jugos", pulpas: "jugos", "todorapidas-bebidas": "jugos", "refrescos-en-polvo": "jugos", te: "jugos",
  "todorapidas-energizantes": "jugos", "todorapidas-gaseosas": "gaseosas", licores: "cerveza",
  "cremas-de-dientes": "crema_dental", "cepillos-de-dientes": "cuidado_bucal", "maquinas-de-afeitar": "afeitada",
  "toallas-higienicas-panitos-y-panales": "toallas_higienicas", "shampoo-acond-y-cremas-de-peinar": "shampoo",
  "jabon-de-bano": "jabon", desodorantes: "desodorante",
  pollo: "pollo", carne: "res", "carne-cerdo": "cerdo", "cabano-y-peperoni": "embutidos", especialidades: "embutidos",
  congelados: "congelados", "comidas-rapidas": "congelados",
  "derivados-lacteos": "yogur", yogures: "yogur", quesos: "quesos", "leche-en-polvo": "leche_polvo",
  "bebidas-en-polvo": "chocolate", "cafe-y-chocolate": "cafe",
  galletas: "galletas", pan: "pan", "pasta-empanadas-y-flautas": "pan",
  "cereales-desayuno-y-avena": "cereales", "papel-higienico-y-toallas": "toallas_cocina",
  "legumbres-y-hortalizas": "frutas_verduras",
};

const sinUuid = (slug: string) => slug.replace(/-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "");

export function categorizar(nombre: string, categoriaTienda?: string | null): string {
  const n = sinTildes(nombre) + " ";
  for (const [id, empieza, excluye = []] of REGLAS) {
    if (empieza.some((p) => n.startsWith(p)) && !excluye.some((x) => n.includes(x))) return id;
  }
  for (const [id, palabras] of CONTIENE) {
    if (palabras.some((w) => n.includes(w))) return id;
  }
  if (categoriaTienda) return POR_CATEGORIA_TIENDA[sinUuid(categoriaTienda)] ?? "otros";
  return "otros";
}

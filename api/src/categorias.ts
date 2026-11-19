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
  ["mascotas", ["alimento para perro", "alimento para gato", "comida para", "arena para gato", "cat chow", "dog chow", "chunky", "dogourmet", "gatsy", "pedigree", "whiskas", "purina", "max cat", "gatush", "comedero", "snack para perro", "agility", "br for"]],
  ["frutas_verduras", ["banano", "platano", "papa pastusa", "papa criolla", "papa sabanera", "tomate", "cebolla", "zanahoria", "limon", "naranja", "mandarina", "manzana", "paquete de manzana", "pera ", "mango", "aguacate", "pina", "papaya", "fresa", "mora ", "lulo", "maracuya", "guayaba", "uva", "pepino", "pimenton", "lechuga", "repollo", "brocoli", "cilantro", "yuca", "ahuyama", "habichuela", "remolacha", "apio", "granadilla", "patilla", "melon", "malla de"], ["jugo", "salsa", "pasta de tomate", "mermelada", "sabor", "gelatina"]],
];

// Si el prefijo no alcanza, se busca en todo el nombre.
const CONTIENE: [string, string[]][] = [
  ["frutas_verduras", ["megafruver"]],
  ["pan", ["megapan"]],
  ["mascotas", [" para perro", " para gato", "mascota"]],
];

export function categorizar(nombre: string): string {
  const n = sinTildes(nombre) + " ";
  for (const [id, empieza, excluye = []] of REGLAS) {
    if (empieza.some((p) => n.startsWith(p)) && !excluye.some((x) => n.includes(x))) return id;
  }
  for (const [id, palabras] of CONTIENE) {
    if (palabras.some((w) => n.includes(w))) return id;
  }
  return "otros";
}

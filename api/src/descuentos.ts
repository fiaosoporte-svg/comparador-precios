// Descuentos por convenio que dependen del día (la app los aplica si el usuario dice que es afiliado).
// Viven aquí para poder cambiarlos sin publicar una versión nueva de la app.
//   tipo "diario":  aplica todos los días
//   tipo "dia_mes": aplica ese día de cada mes (si coinciden varias reglas, gana el porcentaje mayor; no se suman)

export interface ReglaDescuento { tipo: "diario" | "dia_mes"; dia?: number; porcentaje: number }
export interface ProgramaDescuento { id: string; nombre: string; tienda_id: string; nota: string; reglas: ReglaDescuento[] }

export const PROGRAMAS: ProgramaDescuento[] = [
  {
    id: "comfenalco",
    nombre: "Afiliados Comfenalco",
    tienda_id: "megaredil",
    nota: "5% todos los días, 10% el día 1 y 15% el día 16 de cada mes para afiliados a Comfenalco.",
    reglas: [
      { tipo: "diario", porcentaje: 5 },
      { tipo: "dia_mes", dia: 1, porcentaje: 10 },
      { tipo: "dia_mes", dia: 16, porcentaje: 15 },
    ],
  },
];

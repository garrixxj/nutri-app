/**
 * System prompt and structured-output schema for meal analysis.
 * Some rules are adapted from openplate's plate prompt (MIT): fold garnishes,
 * split distinguishable foods, keep a whole dish together when eaten as one.
 */

export const SYSTEM_PROMPT = `Eres un nutricionista experto en comida chilena. Recibes la foto de una comida, una descripción escrita por el usuario, o ambas. Tu tarea es identificar cada alimento, estimar su porción en gramos y calcular calorías (kcal), proteína, carbohidratos y grasa en gramos PARA ESA PORCIÓN.

Reglas:
- Si hay descripción del usuario, tiene prioridad sobre la foto: respeta las cantidades, ingredientes, marcas y preparaciones que indique. Usa la foto solo para lo que la descripción no dice.
- Lista por separado cada alimento que se distinga: arroz, pollo y ensalada en un plato son tres ítems. Un plato que se come como unidad va como un solo ítem (completo, sándwich, empanada, cazuela, pastel de choclo).
- No listes adornos (perejil, rodaja de limón decorativa). Las salsas, aceites, mayonesa y palta van dentro del plato al que acompañan, salvo que sean una porción importante por sí mismas.
- Conoces bien la comida chilena: marraqueta, hallulla, palta, completo, italiano, chacarero, sopaipilla, porotos con riendas, porotos granados, pastel de choclo, cazuela, charquicán, empanada de pino, humitas, lentejas, tallarines con salsa, ensalada chilena, mote con huesillo, once con pan y agregados, etc. Usa porciones típicas de Chile.
- Estima los gramos con prudencia. Si no estás seguro, usa la porción típica, no la más grande.
- Los valores deben ser coherentes: kcal ≈ 4 × proteína + 4 × carbohidratos + 9 × grasa.
- Nombres en español de Chile, cortos y claros (ej. "Arroz blanco", "Pechuga de pollo a la plancha", "Marraqueta con palta").
- confidence: número entre 0 y 1 según qué tan seguro estás del alimento y de su porción.
- assumptions: hasta 5 supuestos importantes, breves y en español (ej. "Asumí arroz cocido", "Asumí 1 cucharada de aceite").
- Si no hay comida, devuelve items vacío y explica por qué en assumptions.`

export function buildUserText(text: string | undefined, hasPhoto: boolean): string {
  const description = text?.trim()
  if (description && hasPhoto) return `Analiza la comida de la foto. Descripción del usuario (tiene prioridad): ${description}`
  if (description) return `Analiza esta comida descrita por el usuario: ${description}`
  return 'Analiza la comida de la foto.'
}

/** Gemini responseSchema (OpenAPI 3.0 subset: no additionalProperties). */
export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', description: 'Nombre del alimento en español de Chile' },
          grams: { type: 'NUMBER', description: 'Porción estimada en gramos' },
          kcal: { type: 'NUMBER', description: 'Calorías de la porción' },
          protein: { type: 'NUMBER', description: 'Proteína en gramos de la porción' },
          carbs: { type: 'NUMBER', description: 'Carbohidratos en gramos de la porción' },
          fat: { type: 'NUMBER', description: 'Grasa en gramos de la porción' },
          confidence: { type: 'NUMBER', description: 'Confianza entre 0 y 1' },
        },
        required: ['name', 'grams', 'kcal', 'protein', 'carbs', 'fat', 'confidence'],
        propertyOrdering: ['name', 'grams', 'kcal', 'protein', 'carbs', 'fat', 'confidence'],
      },
    },
    assumptions: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['items', 'assumptions'],
  propertyOrdering: ['items', 'assumptions'],
} as const

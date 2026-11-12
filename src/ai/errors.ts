export type AiErrorKind =
  | 'no_key'
  | 'invalid_key'
  | 'model_not_found'
  | 'quota_daily'
  | 'rate_limit'
  | 'unavailable'
  | 'network'
  | 'timeout'
  | 'blocked'
  | 'no_food'
  | 'bad_response'
  | 'cancelled'

/** What the error screen should offer besides manual entry. */
export type AiErrorAction = 'settings' | 'retry' | 'none'

export class AiError extends Error {
  override name = 'AiError'
  constructor(
    readonly kind: AiErrorKind,
    message: string,
    readonly action: AiErrorAction,
  ) {
    super(message)
  }
}

export function aiError(kind: AiErrorKind, model = ''): AiError {
  switch (kind) {
    case 'no_key':
      return new AiError(kind, 'Falta tu API key de Gemini. Agrégala en Ajustes.', 'settings')
    case 'invalid_key':
      return new AiError(kind, 'Google rechazó tu API key. Revísala en Ajustes.', 'settings')
    case 'model_not_found':
      return new AiError(
        kind,
        `El modelo "${model}" no existe o no está disponible con tu key. Cámbialo en Ajustes (el recomendado es gemini-flash-latest).`,
        'settings',
      )
    case 'quota_daily':
      return new AiError(
        kind,
        'Se acabó la cuota gratis de Gemini por hoy. Se renueva entre las 3 y las 5 de la mañana. Mientras, puedes registrar a mano.',
        'none',
      )
    case 'rate_limit':
      return new AiError(kind, 'Hiciste varios análisis seguidos. Espera un minuto y vuelve a intentarlo.', 'retry')
    case 'unavailable':
      return new AiError(kind, 'Gemini está saturado o con problemas. Inténtalo de nuevo en un rato.', 'retry')
    case 'network':
      return new AiError(kind, 'No hay conexión. Revisa tu internet y vuelve a intentarlo.', 'retry')
    case 'timeout':
      return new AiError(kind, 'Gemini tardó demasiado en responder. Vuelve a intentarlo.', 'retry')
    case 'blocked':
      return new AiError(kind, 'Gemini no quiso analizar esto. Prueba con otra foto o descríbelo con palabras.', 'none')
    case 'no_food':
      return new AiError(kind, 'No encontré comida para analizar. Prueba con otra foto o agrega una descripción.', 'none')
    case 'bad_response':
      return new AiError(kind, 'La respuesta de la IA vino incompleta. Vuelve a intentarlo.', 'retry')
    case 'cancelled':
      return new AiError(kind, 'Análisis cancelado.', 'none')
  }
}

interface GoogleErrorBody {
  error?: {
    message?: string
    status?: string
    details?: { '@type'?: string; reason?: string; violations?: { quotaId?: string }[] }[]
  }
}

/** Maps a non-200 Gemini response to a user-facing error. */
export function classifyHttpError(status: number, bodyText: string, model: string): AiError {
  let body: GoogleErrorBody = {}
  try {
    body = JSON.parse(bodyText) as GoogleErrorBody
  } catch {
    // Non-JSON body (proxy page, etc.): fall back to the status code.
  }
  const details = body.error?.details ?? []
  const message = body.error?.message ?? ''

  if (status === 429) {
    const quotaIds = details.flatMap((d) => d.violations ?? []).map((v) => v.quotaId ?? '')
    const perMinute = quotaIds.some((id) => /PerMinute/i.test(id)) && !quotaIds.some((id) => /PerDay/i.test(id))
    return aiError(perMinute ? 'rate_limit' : 'quota_daily')
  }
  if (status === 404) return aiError('model_not_found', model)
  const reasons = details.map((d) => d.reason ?? '')
  if (reasons.includes('API_KEY_INVALID') || /api key/i.test(message) || status === 401 || status === 403) {
    return aiError('invalid_key')
  }
  if (status === 400 && /model/i.test(message) && /not (found|supported)/i.test(message)) {
    return aiError('model_not_found', model)
  }
  if (status >= 500) return aiError('unavailable')
  return aiError('bad_response')
}

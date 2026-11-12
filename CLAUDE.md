# Nutri App: réplica personal de Fitia

## Contexto
App personal (un solo usuario) para contar calorías y macros con IA a partir de fotos y descripciones de comida.
Se usa en iPhone como PWA instalada desde Safari ("Agregar a pantalla de inicio"). Costo total: $0.

## Idioma
- UI en español de Chile.
- Código, variables y nombres de archivos en inglés.

## Stack (no cambiar sin preguntar)
- Vite + React + TypeScript (strict)
- Tailwind CSS
- vite-plugin-pwa (manifest, service worker, funciona offline)
- Dexie (IndexedDB) para todos los datos. No hay backend.
- Gemini API llamada con fetch desde el cliente. BYOK: la API key se ingresa en Ajustes y se guarda en IndexedDB. NUNCA en el código ni en archivos del repo.
- Gráficos: SVG propio para anillo de calorías y barras de macros.
- Deploy: Cloudflare Pages o GitHub Pages (HTTPS obligatorio para la cámara).

## Reglas de iOS (obligatorias)
- Mobile first: diseñar para 390x844. Usar viewport-fit=cover y env(safe-area-inset-*).
- Fotos con <input type="file" accept="image/*" capture="environment">. NO usar getUserMedia para fotos.
- Antes de enviar a la IA: redimensionar a máx 1024px en el lado mayor y JPEG calidad ~0.8.
- Llamar navigator.storage.persist() al iniciar.
- Exportar e importar respaldo JSON desde Ajustes (obligatorio desde la fase 1).
- Inputs con font-size >= 16px (evita el zoom automático de iOS).
- Meta tags: apple-mobile-web-app-capable, apple-touch-icon, theme-color, manifest con display standalone.
- Escáner de barras (fase 3): una sola pantalla sin cambio de ruta mientras la cámara está activa. Decodificar con ZXing WASM (Safari no tiene BarcodeDetector).

## Modelo de datos inicial
- profile: sex, age, heightCm, weightKg, activityLevel, goal ('gain_muscle' | 'maintain' | 'cut'), targets { kcal, protein, carbs, fat }
- entries: id, date (YYYY-MM-DD), meal ('desayuno' | 'almuerzo' | 'once' | 'cena' | 'snack'), items[], source ('photo' | 'text' | 'barcode' | 'manual' | 'favorite'), photoThumb?, createdAt
- item: name, grams, kcal, protein, carbs, fat, confidence?
- settings: geminiApiKey, geminiModels (cadena; geminiModel antiguo se migra)
- Fase 2: favorites, weights, water

## Cálculo de metas
- TMB con Mifflin-St Jeor por factor de actividad.
- gain_muscle: +300 kcal. maintain: 0. cut: -20%.
- Proteína 2 g/kg, grasa 25% de las kcal, carbohidratos el resto.
- Todas las metas se pueden editar a mano.

## IA de comida
- Endpoint REST generateContent con responseMimeType "application/json" y responseSchema.
- Cadena de modelos configurable en Ajustes, por defecto gemini-3.6-flash → gemini-3.5-flash → gemini-3.5-flash-lite → gemini-3.1-flash-lite. Con 503, 429, 404 o más de 25 s sin respuesta se pasa al siguiente. No usar gemini-flash-latest (apunta a modelos saturados). La key no se valida por formato, solo con una llamada real al guardarla.
- Prompt: nutricionista experto en comida chilena. Identifica cada alimento, estima gramos y calcula kcal, proteína, carbohidratos y grasa por ítem. Considera comida chilena (marraqueta, hallulla, palta, completo, sopaipilla, porotos, pastel de choclo, cazuela, etc.). Si el usuario escribe una descripción, tiene prioridad sobre la foto. Devuelve confidence 0-1 por ítem y los supuestos usados.
- Siempre mostrar una pantalla de revisión editable antes de guardar. Cambiar los gramos recalcula los macros de forma proporcional.
- Error 429 (cuota agotada): mensaje claro en español y opción de registro manual.

## Fases
1. MVP: onboarding y metas, pantalla Hoy (anillo y macros por comida), registro por foto y texto con revisión editable, historial por día, Ajustes (API key, modelo, metas, respaldo JSON). PWA instalable.
2. Favoritos y comidas frecuentes, agua, peso con gráfico, resumen semanal.
3. Código de barras con Open Food Facts.
4. Plan de comidas con IA según macros restantes, más lista de compras.
Trabajar solo en la fase actual.

## Referencias
- reference/ contiene repos de solo lectura. Nunca modificarlos.
- Revisa el LICENSE de cada uno. Si es MIT o Apache, se puede reutilizar código con atribución. Si no, solo tomar ideas.

## Forma de trabajar
- Antes de implementar algo grande, proponer un plan breve y esperar aprobación.
- Commits pequeños por funcionalidad, con mensajes en español.
- Antes de dar una tarea por terminada: npm run build y typecheck sin errores.
- No agregar dependencias sin justificarlo.

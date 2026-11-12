# Diseño

## Dirección
Basado en el proyecto de Stitch "App de Nutrición": fondo lila muy claro, tarjetas blancas grandes y muy redondeadas, números enormes, botones principales en píldora casi negra y el verde reservado para calorías.
Sigue el modo claro u oscuro del sistema (prefers-color-scheme). El oscuro se deriva de la misma paleta.

## Tipografía
- Plus Jakarta Sans variable (200–800), autoalojada en `public/fonts` para que funcione offline. Respaldo: -apple-system, system-ui.
- Números con font-variant-numeric: tabular-nums.
- Escala: 44 (kcal principal), 34 (display), 22 (títulos), 18 (secciones), 16 (cuerpo), 14 (secundario), 12 (etiquetas).

## Colores
| Rol | Token | Claro | Oscuro |
|---|---|---|---|
| Fondo | bg | #FAF8FE | #121316 |
| Tarjeta | card | #FFFFFF | #1D1E22 |
| Relleno interno (paneles, segmentado, chips) | fill | #F1EFF5 | #2A2B30 |
| Texto | text | #1A1B1F | #F2F1F6 |
| Texto secundario | text-2 | #64656C | #A4A5AD |
| Botón principal (fondo / texto) | ink / on-ink | #1C1D21 / #FFFFFF | #F2F1F6 / #121316 |
| Calorías (anillo, rellenos) | brand | #4EBA6F | #5FCF80 |
| Acento en texto e íconos | accent | #006D34 | #71DC8D |
| Proteína | protein | #FF7843 | #FF9466 |
| Carbohidratos | carbs | #4EBA6F | #5FCF80 |
| Grasa | fat | #5B8DEF | #84A9FF |
| Peligro | danger | #BA1A1A | #FFB4AB |
Los colores de macros son fijos en toda la app (anillo, barras, chips, gráficos). `brand` no se usa para texto pequeño (contraste bajo); para eso está `accent`.

## Forma y espacio
- Espaciado en múltiplos de 4. Margen lateral de 16.
- Radios: tarjetas 28, bloques internos e imágenes 18, botones y chips en píldora (999).
- Sombra suave y amplia en modo claro, ninguna en oscuro (se usa el contraste del fondo).
- Áreas táctiles de mínimo 44x44. Botón principal de 52 de alto.

## Navegación
Barra inferior flotante en píldora, separada de los bordes y sobre el indicador de inicio: Hoy · Historial · [ cámara ] · Progreso · Ajustes.
El botón central es un círculo casi negro que sobresale de la barra; abre la hoja "Registrar" con: Foto, Describir, Manual, Favoritos y (fase 3) Código de barras.

## Pantallas clave
- Hoy: anillo de kcal restantes arriba, tres barras de macros debajo, y tarjetas por comida (desayuno, almuerzo, once, cena, snack) con su total y sus ítems.
- Revisión de IA: foto en miniatura, lista de ítems con gramos editables y nivel de confianza, totales que se actualizan al instante, botón "Guardar" fijo abajo.
- Estados: vacío (invita a registrar la primera comida), cargando (skeleton y texto "Analizando tu plato…") y error (mensaje claro más registro manual).

## Movimiento
Transiciones de 150 a 250 ms con ease-out. El anillo se anima al cambiar el valor. Respetar prefers-reduced-motion.

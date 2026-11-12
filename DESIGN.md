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
| Agua | water | #1D9BC4 | #5CC8E6 |
| Marcas de gráficos (línea de peso, barras de kcal) | chart | #2E9A55 | #46AD66 |
| Aviso (confianza media, "revisa") | warning | #9A5B00 | #FFB95C |
| Peligro | danger | #BA1A1A | #FFB4AB |
`chart` es un verde un paso más oscuro que `brand`, validado con el script de dataviz (contraste ≥ 3:1 sobre la tarjeta y dentro de la banda de luminosidad en ambos modos).
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
- Hoy: tarjeta grande con "Te quedan X kcal" a la izquierda y el anillo con el % de la meta a la derecha; debajo, un panel gris con las tres barras de macros. Luego "Comidas" con un chip "N de 5 registradas" y una grilla de 2 columnas (emoji o foto, nombre de la comida, ítems y kcal, botón +). Snack ocupa el ancho completo. Tocar una comida con un registro abre su detalle; con varios, abre una hoja con la lista. Al final, la tarjeta de Agua (fondo con un toque del color agua): ml del día frente a la meta, barra de progreso, botones +250 ml y +500 ml, y deshacer el último vaso.
- Foto y Revisión de IA (estilo "AI Food Scanner" de Stitch): la foto ocupa el ancho completo arriba, con esquinas de visor y un botón atrás circular encima. Una tarjeta se monta sobre el borde inferior de la foto: chip de confianza promedio, kcal en grande, título, n.º de alimentos y tres bloques de macros. Debajo: chips "¿En qué comida?", ítems con gramos editables y confianza, supuestos de la IA y el botón fijo "Guardar en <comida> · N kcal". Sin foto (texto o edición), la tarjeta va bajo un encabezado con botón atrás. Mientras analiza: la misma foto con la píldora "Analizando" y un skeleton en la tarjeta.
- Historial: flechas para cambiar de semana con el día elegido al centro (tocarlo abre el selector de fecha) y una tira de 7 días (L a D). El día elegido va en píldora negra; un punto verde marca los días con registros. Debajo, el mismo resumen y grilla de Hoy.
- Estados: vacío (invita a registrar la primera comida), cargando (skeleton y texto "Analizando tu plato…") y error (mensaje claro más registro manual).

## Movimiento
Transiciones de 150 a 250 ms con ease-out. El anillo se anima al cambiar el valor. Respetar prefers-reduced-motion.

## Gráficos
- SVG propio, sin librerías. Una sola serie por gráfico, así que no lleva leyenda en caja: el título la nombra y, si hay marcas secundarias, una clave de línea o punto debajo.
- Líneas de 2 px con uniones redondeadas. Barras de 24 px como máximo, punta redondeada de 4 px y base recta. Marcador final de 9 px con anillo de 2 px del color de la tarjeta.
- Grilla horizontal de 1 px continua en `separator`; ejes y etiquetas en `text-2`, 11 px. Nunca líneas punteadas ni doble eje.
- El texto nunca usa el color de la serie: los valores van en colores de texto con una marca de color al lado.
- Tocar o arrastrar muestra una línea vertical y un globo con el valor (primero el número, después la etiqueta). Las flechas del teclado hacen lo mismo. Cada gráfico lleva una tabla oculta para VoiceOver.
- Peso: pesajes del día como puntos tenues (`text-2` al 35 %) y el promedio móvil de 7 días como la línea. La línea empieza cuando ya promedia al menos 2 días.


# Diseño

## Dirección
Que se sienta como una app nativa de iOS: limpia, rápida y con números grandes y claros. Nada de estética genérica de plantilla.
Sigue el modo claro u oscuro del sistema (prefers-color-scheme).

## Tipografía
- Fuente del sistema: -apple-system, "SF Pro", system-ui.
- Números con font-variant-numeric: tabular-nums.
- Escala: 34 (kcal principal), 22 (títulos), 17 (cuerpo), 15 (secundario), 13 (etiquetas).

## Colores
| Rol | Claro | Oscuro |
|---|---|---|
| Fondo | #F2F2F7 | #000000 |
| Tarjeta | #FFFFFF | #1C1C1E |
| Texto | #111111 | #F5F5F7 |
| Texto secundario | #6B6B70 | #98989F |
| Acento / calorías | #16A34A | #22C55E |
| Proteína | #EF4444 | #F87171 |
| Carbohidratos | #F59E0B | #FBBF24 |
| Grasa | #3B82F6 | #60A5FA |
| Peligro | #DC2626 | #F87171 |
Los colores de macros son fijos en toda la app (anillo, barras, chips, gráficos).

## Forma y espacio
- Espaciado en múltiplos de 4. Margen lateral de 16.
- Radios: tarjetas 20, botones 14, chips 999.
- Sombras mínimas en modo claro, ninguna en oscuro (se usa el contraste del fondo).
- Áreas táctiles de mínimo 44x44.

## Navegación
Barra inferior fija con safe area: Hoy · Historial · [ + Registrar ] (botón central destacado) · Progreso · Ajustes.
"Registrar" abre una hoja inferior con: Foto, Describir, Favoritos y (fase 3) Código de barras.

## Pantallas clave
- Hoy: anillo de kcal restantes arriba, tres barras de macros debajo, y tarjetas por comida (desayuno, almuerzo, once, cena, snack) con su total y sus ítems.
- Revisión de IA: foto en miniatura, lista de ítems con gramos editables y nivel de confianza, totales que se actualizan al instante, botón "Guardar" fijo abajo.
- Estados: vacío (invita a registrar la primera comida), cargando (skeleton y texto "Analizando tu plato…") y error (mensaje claro más registro manual).

## Movimiento
Transiciones de 150 a 250 ms con ease-out. El anillo se anima al cambiar el valor. Respetar prefers-reduced-motion.

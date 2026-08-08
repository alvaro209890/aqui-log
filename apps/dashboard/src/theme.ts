/**
 * UX-01C — ponte entre os tokens CSS e os componentes que precisam da cor em
 * JavaScript (Recharts e Leaflet).
 *
 * Aqui não existe valor de cor: só o nome do token. A definição mora em
 * `styles.css` (`:root`), que é a fonte única — trocar a marca é editar um
 * lugar. `var(--x)` funciona porque `fill`/`stroke`/`color` viram atributos de
 * apresentação SVG, que aceitam custom properties.
 *
 * Diretrizes: docs/01-produto/02-DIRETRIZES-VISUAIS.md
 */

const token = (name: string) => `var(--${name})`;

export const themeColors = {
  primary: token('color-primary'),
  primaryStrong: token('color-primary-strong'),
  success: token('color-success'),
  warning: token('color-warning'),
  error: token('color-error'),
  info: token('color-info'),
  textTertiary: token('color-text-tertiary'),
  chartGrid: token('chart-grid'),
  chartAxis: token('chart-axis'),
  chartTrack: token('chart-track'),
} as const;

/**
 * Paleta categórica dos gráficos, na ordem. A primeira é a série principal
 * (laranja da marca); as demais são semânticas e distinguíveis entre si.
 */
export const chartSeriesColors = [
  token('chart-1'),
  token('chart-2'),
  token('chart-3'),
  token('chart-4'),
  token('chart-5'),
  token('chart-6'),
  token('chart-7'),
  token('chart-8'),
] as const;

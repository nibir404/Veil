export const QUALITY = {
  high: { label: 'High', pixelRatio: 1.5, reflection: 0.6, shadows: 2048, rain: 7000 },
  balanced: { label: 'Balanced', pixelRatio: 1.0, reflection: 0.4, shadows: 1024, rain: 4500 },
  low: { label: 'Performance', pixelRatio: 0.75, reflection: 0.25, shadows: 0, rain: 2200 },
};
export function qualitySettings(name) { return QUALITY[name] || QUALITY.high; }

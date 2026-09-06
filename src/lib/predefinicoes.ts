import type { Predefinicao } from "../types";

export const predefinicoes: Record<string, Predefinicao> = {
  sepia: { fundo: "#f4ecd8", inverter: 0, matiz: 0, contraste: 100, brilho: 100, sepia: 25 },
  creme: { fundo: "#faf3e0", inverter: 0, matiz: 0, contraste: 95, brilho: 100, sepia: 10 },
  escuro: { fundo: "#1e1e1e", inverter: 1, matiz: 180, contraste: 100, brilho: 95, sepia: 0 },
  altoContraste: { fundo: "#000000", inverter: 1, matiz: 180, contraste: 120, brilho: 100, sepia: 0 },
  verde: { fundo: "#cfe0c3", inverter: 0, matiz: 0, contraste: 95, brilho: 100, sepia: 15 },
  papel: { fundo: "#ffffff", inverter: 0, matiz: 0, contraste: 100, brilho: 100, sepia: 0 },
};

export const rotulosPredefinicoes: Record<string, string> = {
  sepia: "Sépia",
  creme: "Creme",
  escuro: "Escuro",
  altoContraste: "Alto contraste",
  verde: "Verde suave",
  papel: "Papel",
  personalizado: "Personalizado",
};

export const opcoesFonteLeitura = [
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Times New Roman', serif", label: "Times" },
  { value: "'Palatino Linotype', Palatino, serif", label: "Palatino" },
  { value: "system-ui, sans-serif", label: "Sistema" },
  { value: "'Helvetica Neue', Arial, sans-serif", label: "Helvetica" },
  { value: "Verdana, sans-serif", label: "Verdana" },
  { value: "'Atkinson Hyperlegible', Verdana, sans-serif", label: "Atkinson" },
  { value: "'OpenDyslexic', Verdana, sans-serif", label: "OpenDyslexic" },
  { value: "'Courier New', monospace", label: "Courier" },
];

/** Luminância relativa aproximada — usada para escolher a cor de texto padrão. */
export function luminancia(hex: string): number {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return 1;
  const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function filtroCss(p: Predefinicao): string {
  return `invert(${p.inverter}) hue-rotate(${p.matiz}deg) contrast(${p.contraste}%) brightness(${p.brilho}%) sepia(${p.sepia}%)`;
}

/** Tela de toque (celular/tablet): usa layout e limites próprios. */
export const ehToque = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

import { useEffect, useRef, type RefObject } from "react";

export type Ponto = { x: number; y: number };

type Callbacks = {
  /** Durante o gesto: escala relativa ao início e centro entre os dedos (coordenadas da tela). */
  aoMover: (escala: number, centro: Ponto) => void;
  /** Ao soltar: escala final do gesto. */
  aoTerminar: (escala: number, centro: Ponto) => void;
};

type ListaToques = ArrayLike<{ clientX: number; clientY: number }>;

const distancia = (t: ListaToques) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
const centro = (t: ListaToques): Ponto => ({
  x: (t[0].clientX + t[1].clientX) / 2,
  y: (t[0].clientY + t[1].clientY) / 2,
});

/** Detecta o gesto de pinça (dois dedos) num elemento. */
export function usePinca(alvo: RefObject<HTMLElement | null>, callbacks: Callbacks) {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    const el = alvo.current;
    if (!el) return;
    let inicial = 0;
    let escala = 1;
    let ultimoCentro: Ponto = { x: 0, y: 0 };

    const aoComecar = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      inicial = distancia(e.touches);
      escala = 1;
      ultimoCentro = centro(e.touches);
    };

    const aoMover = (e: TouchEvent) => {
      if (!inicial || e.touches.length !== 2) return;
      e.preventDefault();
      escala = distancia(e.touches) / inicial;
      ultimoCentro = centro(e.touches);
      callbacksRef.current.aoMover(escala, ultimoCentro);
    };

    const aoSoltar = () => {
      if (!inicial) return;
      inicial = 0;
      if (escala !== 1) callbacksRef.current.aoTerminar(escala, ultimoCentro);
    };

    el.addEventListener("touchstart", aoComecar, { passive: true });
    el.addEventListener("touchmove", aoMover, { passive: false });
    el.addEventListener("touchend", aoSoltar);
    el.addEventListener("touchcancel", aoSoltar);
    return () => {
      el.removeEventListener("touchstart", aoComecar);
      el.removeEventListener("touchmove", aoMover);
      el.removeEventListener("touchend", aoSoltar);
      el.removeEventListener("touchcancel", aoSoltar);
    };
  }, [alvo]);
}

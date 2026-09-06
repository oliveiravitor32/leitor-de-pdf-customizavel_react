import type { ReactNode } from "react";

export function BotaoIcone({
  titulo,
  rotulo,
  onClick,
  desabilitado,
  ativo,
  children,
}: {
  titulo: string;
  /** Texto ao lado do ícone, para ações que o ícone sozinho não explica. */
  rotulo?: string;
  onClick: () => void;
  desabilitado?: boolean;
  ativo?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      disabled={desabilitado}
      className={`inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg transition-colors disabled:cursor-default disabled:opacity-30 ${
        rotulo ? "px-2.5" : "w-9"
      } ${ativo ? "bg-current/15" : "hover:bg-current/10"}`}
    >
      {children}
      {rotulo && <span className="text-xs font-medium">{rotulo}</span>}
    </button>
  );
}

export function Deslizante({
  rotulo,
  valor,
  min,
  max,
  passo,
  sufixo,
  onChange,
}: {
  rotulo: string;
  valor: number;
  min: number;
  max: number;
  passo: number;
  sufixo?: string;
  onChange: (valor: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="flex justify-between opacity-70">
        <span>{rotulo}</span>
        <span className="tabular-nums opacity-80">
          {valor}
          {sufixo}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={passo}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer"
      />
    </label>
  );
}

export function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="opacity-70">{rotulo}</span>
      {children}
    </label>
  );
}

export const classesSelect =
  "w-full cursor-pointer rounded-lg border border-current/20 bg-current/5 px-2 py-1.5 text-xs outline-none focus:border-current/50";

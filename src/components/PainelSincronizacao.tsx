import { Cloud, Download, LogIn, LogOut, Trash2 } from "lucide-react";
import { categorias, rotulosCategorias, type Categoria } from "../lib/categorias";
import type { Ativas, Conta } from "../lib/sincronizacao";

type Props = {
  /** Falso quando o Firebase não está configurado: o app segue só local. */
  disponivel: boolean;
  conta: Conta;
  ativas: Ativas;
  erro: string;
  onEntrar: () => void;
  onSair: () => void;
  onAlternar: (categoria: Categoria) => void;
  onApagar: () => void;
  /** Baixa um arquivo com tudo o que a nuvem guarda sobre o usuário. */
  onExportar: () => void;
};

const classesBotao =
  "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-current/20 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-current/10";

export function PainelSincronizacao({ disponivel, conta, ativas, erro, onEntrar, onSair, onAlternar, onApagar, onExportar }: Props) {
  if (!disponivel) return null;

  return (
    <section className="mb-5 flex flex-col gap-3">
      <h3 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide opacity-50">
        <Cloud className="h-3.5 w-3.5" /> Sincronização
      </h3>

      {!conta ? (
        <>
          <p className="text-xs opacity-70">
            Opcional: entre para levar suas preferências para outros dispositivos.
          </p>
          <button type="button" className={classesBotao} onClick={onEntrar}>
            <LogIn className="h-4 w-4" /> Entrar com Google
          </button>
        </>
      ) : (
        <>
          <p className="text-xs opacity-70">Escolha o que este dispositivo compartilha:</p>
          {(Object.keys(categorias) as Categoria[]).map((categoria) => (
            <label key={categoria} className="flex cursor-pointer items-center justify-between text-sm">
              {rotulosCategorias[categoria]}
              <input
                type="checkbox"
                role="switch"
                checked={ativas[categoria]}
                onChange={() => onAlternar(categoria)}
                className="h-4 w-4 cursor-pointer accent-current"
              />
            </label>
          ))}
          <div className="mt-1 flex flex-wrap gap-2">
            <button type="button" className={classesBotao} onClick={onSair}>
              <LogOut className="h-4 w-4" /> Sair
            </button>
            <button type="button" className={classesBotao} onClick={onExportar}>
              <Download className="h-4 w-4" /> Exportar meus dados
            </button>
            <button
              type="button"
              className={`${classesBotao} text-red-600`}
              onClick={() => {
                if (window.confirm("Apagar da nuvem todas as suas preferências? Elas continuam neste dispositivo.")) onApagar();
              }}
            >
              <Trash2 className="h-4 w-4" /> Apagar meus dados
            </button>
          </div>
        </>
      )}

      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </section>
  );
}

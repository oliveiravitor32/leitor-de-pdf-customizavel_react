import { useState } from "react";
import { BookOpenText, FileUp, Palette, Type } from "lucide-react";

type PropsZonaDeArquivo = {
  onEscolher: () => void;
  arrastando: boolean;
  erro: string;
};

export function ZonaDeArquivo({ onEscolher, arrastando, erro }: PropsZonaDeArquivo) {
  const [pairado, setPairado] = useState(false);

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto p-6">
      <div className="w-full max-w-lg text-center">
        <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-current/10">
          <BookOpenText className="h-7 w-7" strokeWidth={1.6} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Leitor de PDF Customizável</h1>
        <p className="mt-2 text-sm opacity-70">
          Cores, fontes e espaçamento do seu jeito. Seus PDFs ficam só neste dispositivo — nenhum
          arquivo é enviado para lugar nenhum.
        </p>

        <button
          type="button"
          onClick={onEscolher}
          onDragEnter={() => setPairado(true)}
          onDragLeave={() => setPairado(false)}
          onDrop={() => setPairado(false)}
          className={`mt-8 flex w-full cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-10 transition-colors ${
            arrastando || pairado ? "border-current/60 bg-current/10" : "border-current/25 bg-current/5 hover:border-current/40"
          }`}
        >
          <FileUp className="h-8 w-8 opacity-60" strokeWidth={1.5} />
          <span className="font-medium pointer-coarse:hidden">Solte um PDF aqui ou clique para escolher</span>
          <span className="hidden font-medium pointer-coarse:inline">Toque para escolher um PDF</span>
          <span className="text-xs opacity-60">Somente arquivos .pdf</span>
        </button>

        {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}

        <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs opacity-60">
          <span className="inline-flex items-center gap-1.5">
            <Palette className="h-4 w-4" /> Predefinições de cor
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Type className="h-4 w-4" /> Modo leitura
          </span>
        </div>
      </div>
    </div>
  );
}

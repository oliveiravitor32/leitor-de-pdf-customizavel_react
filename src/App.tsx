import { useCallback, useEffect, useRef, useState } from "react";
import { BarraFerramentas } from "./components/BarraFerramentas";
import { VisualizadorPdf } from "./components/VisualizadorPdf";
import { ZonaDeArquivo } from "./components/ZonaDeArquivo";
import { useEstadoLeitor } from "./hooks/useEstadoLeitor";
import { useTextoPdf } from "./hooks/useTextoPdf";
import { carregarDocumentoPdf } from "./lib/pdf";
import { luminancia } from "./lib/predefinicoes";
import type { DocumentoPdf } from "./types";

export default function App() {
  const { estado, atualizar, aplicarPredefinicao, resetar } = useEstadoLeitor();
  const [documento, setDocumento] = useState<DocumentoPdf | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [zoom, setZoom] = useState(1.2);
  const [painelAberto, setPainelAberto] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [erro, setErro] = useState("");
  const [telaCheia, setTelaCheia] = useState(false);

  const entradaArquivoRef = useRef<HTMLInputElement>(null);
  const irParaPaginaRef = useRef<(pagina: number) => void>(() => {});
  const obterTextoPagina = useTextoPdf(documento);

  // Sem cor explícita, o texto do modo leitura acompanha o fundo escolhido.
  const corTexto = estado.corTexto || (luminancia(estado.fundo) < 0.5 ? "#e8e6e1" : "#3b3a36");

  const abrirArquivo = useCallback(async (arquivo: File) => {
    setErro("");
    try {
      const doc = await carregarDocumentoPdf(arquivo);
      setDocumento(doc);
      setNomeArquivo(arquivo.name);
      setPaginaAtual(1);
    } catch (e) {
      setErro(`Não foi possível abrir o PDF: ${(e as Error).message}`);
    }
  }, []);

  const irParaPagina = useCallback(
    (pagina: number) => {
      if (!documento) return;
      const limitada = Math.min(Math.max(1, pagina), documento.numPages);
      setPaginaAtual(limitada);
      irParaPaginaRef.current(limitada);
    },
    [documento],
  );

  const registrarNavegacao = useCallback((ir: (pagina: number) => void) => {
    irParaPaginaRef.current = ir;
  }, []);

  const aplicarZoom = useCallback((delta: number) => {
    setZoom((z) => Math.round(Math.min(3, Math.max(0.4, z + delta)) * 100) / 100);
  }, []);

  const alternarTelaCheia = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    const aoMudar = () => setTelaCheia(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", aoMudar);
    return () => document.removeEventListener("fullscreenchange", aoMudar);
  }, []);

  // Arrastar e soltar em qualquer lugar da janela.
  useEffect(() => {
    const aoArrastar = (e: DragEvent) => {
      e.preventDefault();
      setArrastando(true);
    };
    const aoSair = (e: DragEvent) => {
      if (!e.relatedTarget) setArrastando(false);
    };
    const aoSoltar = (e: DragEvent) => {
      e.preventDefault();
      setArrastando(false);
      const arquivo = e.dataTransfer?.files?.[0];
      if (!arquivo) return;
      if (arquivo.type !== "application/pdf") {
        setErro("Esse arquivo não é um PDF.");
        return;
      }
      abrirArquivo(arquivo);
    };
    window.addEventListener("dragover", aoArrastar);
    window.addEventListener("dragleave", aoSair);
    window.addEventListener("drop", aoSoltar);
    return () => {
      window.removeEventListener("dragover", aoArrastar);
      window.removeEventListener("dragleave", aoSair);
      window.removeEventListener("drop", aoSoltar);
    };
  }, [abrirArquivo]);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === "INPUT" || alvo.tagName === "SELECT" || alvo.isContentEditable))
        return;
      if (!documento) return;

      switch (e.key) {
        case "ArrowRight":
        case "PageDown":
          irParaPagina(paginaAtual + 1);
          break;
        case "ArrowLeft":
        case "PageUp":
          irParaPagina(paginaAtual - 1);
          break;
        case "+":
        case "=":
          aplicarZoom(0.15);
          break;
        case "-":
          aplicarZoom(-0.15);
          break;
        case "t":
        case "T":
          atualizar(
            { modo: estado.modo === "leitura" ? "original" : "leitura" },
            { manterPredefinicao: true },
          );
          break;
        case "f":
        case "F":
          alternarTelaCheia();
          break;
        case "h":
        case "H":
          setPainelAberto((aberto) => !aberto);
          break;
        case "Escape":
          setPainelAberto(false);
          break;
      }
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [documento, paginaAtual, estado.modo, irParaPagina, aplicarZoom, atualizar, alternarTelaCheia]);

  return (
    <div
      className="relative h-full w-full overflow-hidden transition-colors"
      style={{ background: estado.fundo, color: corTexto }}
    >
      {documento ? (
        <>
          <BarraFerramentas
            estado={estado}
            nomeArquivo={nomeArquivo}
            paginaAtual={paginaAtual}
            totalPaginas={documento.numPages}
            zoom={zoom}
            painelAberto={painelAberto}
            onAlternarPainel={() => setPainelAberto((aberto) => !aberto)}
            onIrParaPagina={irParaPagina}
            onZoom={aplicarZoom}
            onAtualizar={atualizar}
            onPredefinicao={aplicarPredefinicao}
            onResetar={resetar}
            onAbrirOutro={() => entradaArquivoRef.current?.click()}
            telaCheia={telaCheia}
            onAlternarTelaCheia={alternarTelaCheia}
          />

          <VisualizadorPdf
            key={`${nomeArquivo}-${estado.modo}`}
            documento={documento}
            estado={estado}
            corTexto={corTexto}
            zoom={zoom}
            obterTextoPagina={obterTextoPagina}
            onMudarPagina={setPaginaAtual}
            registrarNavegacao={registrarNavegacao}
          />

          {arrastando && (
            <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center border-4 border-dashed border-current/40 bg-black/20 text-lg font-medium">
              Solte para abrir este PDF
            </div>
          )}
        </>
      ) : (
        <ZonaDeArquivo onArquivo={abrirArquivo} arrastando={arrastando} erro={erro} />
      )}

      <input
        ref={entradaArquivoRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          if (arquivo) abrirArquivo(arquivo);
          e.target.value = "";
        }}
      />
    </div>
  );
}

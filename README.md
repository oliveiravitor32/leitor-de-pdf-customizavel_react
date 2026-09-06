# Leitor de PDF Customizável

Leitor de PDF que deixa você ajustar cores, fontes e espaçamento para ler confortavelmente por
horas. Tudo roda no navegador — nenhum arquivo sai da sua máquina.

React 19 + Vite + Tailwind v4 + lucide-react + pdf.js.

## Funcionalidades

- **Dois modos**: o PDF original renderizado em canvas, ou o **modo leitura**, que extrai o texto
  e o exibe como um ebook (fonte, tamanho, altura de linha, largura de coluna e espaçamento).
- **Predefinições de cor**: sépia, creme, escuro, alto contraste, verde suave e papel — além de
  ajuste fino de fundo, inversão, matiz, contraste, brilho e sépia via filtro CSS.
- **Renderização preguiçosa**: cada página só é renderizada quando chega perto da janela, então
  PDFs grandes abrem rápido.
- **Preferências persistidas** no `localStorage`.
- Arrastar e soltar, navegação por página, zoom e tela cheia.

## Atalhos

| Tecla | Ação |
| --- | --- |
| ← / → (ou PageUp/PageDown) | Página anterior / próxima |
| `+` / `-` | Zoom |
| `T` | Alterna modo leitura |
| `F` | Tela cheia |
| `H` | Painel de aparência |
| `Esc` | Fecha o painel |

## Rodando

```bash
npm install
npm run dev
```

`npm run build` gera a versão de produção em `dist/`.

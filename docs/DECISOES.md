# Decisões de arquitetura

Registro das decisões técnicas importantes do projeto: o problema, o que foi investigado, o que foi decidido e por quê. Cada decisão segue o formato ADR (*Architecture Decision Record*): contexto → investigação → decisão → alternativas descartadas → consequências.

| # | Decisão | Data | Status | PR |
|---|---------|------|--------|----|
| [ADR-001](#adr-001-redesenho-só-da-página-cuja-imagem-mudou) | Redesenhar só a página cuja imagem mudou | 2026-10-20 | Aceita | [#10](https://github.com/oliveiravitor32/leitor-de-pdf-customizavel_react/pull/10) |

---

## ADR-001: Redesenho só da página cuja imagem mudou

**Status:** aceita · **Data:** 2026-10-20 · **Aparelho de teste:** Motorola Moto G15 (Android, build de release com PDFium)

### Resumo

Na rolagem rápida do modo contínuo, as páginas sumiam (fundo vazio) e a rolagem dava travadas. Três hipóteses de gargalo caíram com a medição: o motor de PDF, a ponte Rust↔JS e a falta de threads. A causa real era um **detalhe de identidade de objeto no React**. Cada miniatura nova recriava o objeto de imagem de **todas** as páginas, e as 100 páginas redesenhavam o canvas várias vezes por segundo. Corrigido isso, o tempo para preparar as 100 miniaturas caiu de **17,7 s para 3,0 s** e os quadros travados caíram de **7,9% para 1,1%**.

**A lição principal:** medir antes de otimizar. A otimização "óbvia" (multithread, protocolo binário) teria custado muito e não resolveria nada.

### Contexto

O renderizador (`src/hooks/useRenderizador.ts`) trabalha em dois níveis:

- **nítidas:** as páginas visíveis e as vizinhas, na resolução da tela (~1,7 MB cada no celular);
- **miniaturas:** todas as páginas em baixa resolução (escala 0,3, ~175 KB cada). Elas são geradas logo ao abrir o PDF e aparecem enquanto a nítida não chega.

O hook devolve um `Map<página, ImagemPagina>` com a nítida, se houver, ou a miniatura. Cada página é um `PaginaCanvas` memorizado (`React.memo`), que desenha a imagem no próprio `<canvas>` quando a prop `imagem` muda.

**O que o usuário via no celular:** mesmo depois de implementado o cache de 200 miniaturas, rolar rápido mostrava páginas vazias, e voltar a rolar causava travadas.

### Investigação

Cada hipótese foi testada no aparelho real, com o app em release. Uma versão temporária tornava a WebView inspecionável (`WebView.setWebContentsDebuggingEnabled(true)`), e o PC controlava o app pelo protocolo do Chrome DevTools via `adb forward`. Essa alteração nunca foi commitada.

#### Hipótese 1: a ponte Rust↔JS converte as imagens em JSON. ❌ Descartada

No Android, o IPC do Tauri passa por `postMessage`. Pouco antes, tínhamos descoberto que o **envio** do PDF (JS → Rust) virava JSON, cerca de 4 vezes maior. A suspeita era que a **volta** das imagens também virasse.

Cronometramos cada etapa direto no aparelho (PDF de teste de 100 páginas, só texto):

| Tipo | Tamanho | Rust + ponte | Montar a imagem no JS | Total |
|---|---|---|---|---|
| Miniatura | 184×238 (171 KB) | ~26 ms | ~1 ms | ~27 ms |
| Nítida | 582×753 (1,7 MB) | ~60 ms | ~9 ms | ~70 ms |

A resposta chega como `ArrayBuffer` (bytes de verdade), e o custo fixo da ponte é de ~10 ms por chamada, medido com uma imagem de 1 pixel. **A ponte não era o gargalo.** Ficou descartada a ideia de servir as imagens por um protocolo próprio do app.

#### Hipótese 2: o motor não acompanha a rolagem. ⚠️ Parcialmente verdadeira

A ~27 ms por miniatura, o PDFium faz ~35 por segundo. Gerar as miniaturas só **durante** a rolagem não acompanha um arremesso. A resposta foi gerar todas **logo ao abrir**: 100 × 27 ms ≈ 3 s estimados. A fila de miniaturas pausa enquanto houver nítida esperando (PR #9).

Mesmo assim, o problema continuou. Era sinal de que havia outra causa.

#### Hipótese 3: a thread principal do JS está sobrecarregada (pediria multithread). ❌ Descartada como causa

| Cenário | Quadros desenhados | Tempo por quadro (mediana) | 95% dos quadros abaixo de | Quadros travados |
|---|---|---|---|---|
| Normal | 241 | 31 ms | 57 ms | 7,9% |
| Canvases escondidos | 181 | 27 ms | 61 ms | 6,6% |

Fonte: `dumpsys gfxinfo` do próprio Android, durante arremessos de verdade com `adb shell input swipe`. A thread principal ficou ocupada só de **0 a 8%** do tempo, e esconder todos os canvases quase não mudou nada. Ou seja, durante a rolagem em si não faltava processamento.

> **Armadilha de medição:** a primeira tentativa contou quadros pelo JS, com `requestAnimationFrame`, e deu 7 a 9 por segundo **até com os canvases escondidos**. Na WebView do Android esse número não reflete o que a tela desenha. A fonte confiável é o `gfxinfo` do sistema. Também não funciona o `Input.synthesizeScrollGesture` do DevTools: a WebView não executa esse comando e a medição trava.

#### A descoberta: as miniaturas levavam 17,7 s, não 3 s

Capturas de tela no meio do arremesso mostraram páginas **totalmente vazias**: sem miniatura, não só borradas. Cronometrando quantas páginas tinham imagem desde a abertura do PDF:

| Tempo depois de abrir | Páginas com imagem |
|---|---|
| 1,5 s | 14 |
| 3 s | 31 |
| 6 s | 54 |
| 10 s | 74 |
| **17,7 s** | **100** |

O ritmo **caía com o tempo**, de ~20 páginas por segundo no início para ~4 no fim, e houve **4.473 chamadas de `drawImage`** para 100 páginas (~45 por página). Esse desenho, um custo que cresce a cada página pronta, é típico de trabalho O(n²).

**Causa:** a cada leva de miniaturas prontas, o `useMemo` que combina nítidas e miniaturas criava **um objeto `{ bitmap, escala }` novo para cada página**:

```ts
// antes
if (mini) combinadas.set(pagina, { bitmap: mini, escala: escalaMini });
```

O bitmap era o mesmo, mas o objeto era outro. Como o `React.memo` compara as props por referência, todas as páginas re-renderizavam. E o efeito do `PaginaCanvas` (dependente de `imagem`) redimensionava e redesenhava o canvas de cada uma. Com N miniaturas prontas, cada nova miniatura custava N redesenhos, e todo esse trabalho competia com a geração das miniaturas restantes.

### Decisão

1. **Identidade estável:** o hook guarda o objeto `ImagemPagina` de cada miniatura (`objetosMiniRef`) e só cria um novo quando o bitmap ou a escala mudam. Com isso, o `React.memo` volta a funcionar e só a página cuja imagem mudou redesenha.
2. **Canvas redimensionado só quando necessário:** o `PaginaCanvas` só atribui `canvas.width`/`canvas.height` quando o tamanho muda, porque essa atribuição apaga e realoca o canvas.

As duas mudanças foram feitas com TDD:
- um teste garante que a imagem de uma página continua sendo **o mesmo objeto** quando outra página termina de renderizar;
- outro teste garante que uma imagem nova do mesmo tamanho **não redimensiona** o canvas.

### Resultado (medido no mesmo aparelho e com o mesmo PDF)

| | Antes | Depois |
|---|---|---|
| Tempo até as 100 miniaturas | 17,7 s | **3,0 s** |
| `drawImage` nesse período | 4.473 | **102** |
| Quadros travados no arremesso | 7,9% | **1,1%** |
| 95% dos quadros abaixo de | 57 ms | **30 ms** |
| Página vazia no meio do arremesso | sim | **não** |

O tempo medido depois da correção (3,0 s) bateu com a estimativa feita a partir do custo por miniatura (100 × 27 ms ≈ 2,7 s). Isso confirma que o tempo extra era todo overhead de redesenho.

### Alternativas descartadas

| Alternativa | Por que não |
|---|---|
| Protocolo próprio (`register_uri_scheme_protocol`) para servir as imagens | A medição mostrou que a ponte já entrega bytes, com ~10 ms fixos por chamada. Ganho pequeno para uma mudança grande. |
| `OffscreenCanvas` + Web Worker (desenho fora da thread principal) | Funciona na WebView do Android, mas a thread principal ficou ocupada só de 0 a 8% durante a rolagem. Moveria um trabalho que não era o gargalo. Fica como opção se o perfil mudar. |
| `bitmaprenderer` (`transferFromImageBitmap`, sem cópia) | Ele **consome** o bitmap, e o cache precisa reutilizar a mesma miniatura quando a página volta à tela. Além disso, o `drawImage` em si custava ~0,1 ms. |
| Várias threads do PDFium no Rust | O PDFium não é seguro para várias threads. Paralelizar exigiria vários processos, com um custo de complexidade alto para um motor que já não era o gargalo. |
| Aumentar o cache de nítidas | Cada nítida ocupa ~1,7 MB no celular e não resolve o arremesso. O cache em dois níveis (nítidas + miniaturas) é mais barato. |

### Consequências

- **Positivas:**
  - a rolagem não mostra mais páginas vazias depois dos ~3 s iniciais;
  - o custo de cada miniatura nova voltou a ser constante, em vez de crescer com o número de páginas prontas;
  - não foi preciso adicionar Web Worker nem protocolo novo.
- **Negativas e limites:**
  - nos primeiros ~3 s depois de abrir, um arremesso ainda pode passar das miniaturas não geradas;
  - o PDF de teste só tinha texto, e livros com imagens devem ter um custo maior por página;
  - na rolagem rápida, as nítidas ainda esperam a rolagem parar por 120 ms.
- **Regra para o futuro:** em listas grandes com `React.memo`, objetos derivados (como `{ bitmap, escala }`) precisam ter **identidade estável**. Recriar o objeto a cada render anula a memorização sem nenhum erro visível, e o custo só aparece na escala.

### Como reproduzir a medição

1. No `MainActivity.kt`, adicione temporariamente `WebView.setWebContentsDebuggingEnabled(true)` e gere o APK de release. **Não commite essa linha.**
2. Instale no aparelho, abra o app e rode `adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>`.
3. Pelo protocolo do DevTools:
   - instrumente `CanvasRenderingContext2D.prototype.drawImage`;
   - abra o PDF disparando um evento `drop` com o arquivo;
   - acompanhe quantos canvases têm `width > 0`.
4. Para os quadros, use `adb shell dumpsys gfxinfo <pacote> reset` antes dos arremessos (`adb shell input swipe 540 1900 540 400 50`) e `dumpsys gfxinfo <pacote>` depois.
5. Para ver as páginas vazias, rode `adb exec-out screencap -p` ~300 ms depois de iniciar um arremesso.

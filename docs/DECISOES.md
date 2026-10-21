# Decisões de arquitetura

Registro das decisões técnicas importantes do projeto: o problema, o que foi investigado, o que foi decidido e por quê. Cada decisão segue o formato ADR (*Architecture Decision Record*): contexto → investigação → decisão → alternativas descartadas → consequências.

| # | Decisão | Data | Status | PR |
|---|---------|------|--------|----|
| [ADR-001](#adr-001-login-com-google-no-android-por-plugin-nativo-próprio) | Login com Google no Android por plugin nativo próprio | 2026-10-15 | Aceita | [#2](https://github.com/oliveiravitor32/leitor-de-pdf-customizavel_react/pull/2) |
| [ADR-002](#adr-002-motor-pdfium-em-rust-com-pdfjs-de-reserva) | Motor PDFium em Rust, com pdf.js de reserva | 2026-10-15 | Aceita | [#2](https://github.com/oliveiravitor32/leitor-de-pdf-customizavel_react/pull/2) |
| [ADR-003](#adr-003-o-pdfium-abre-o-arquivo-pelo-caminho-sem-passar-os-bytes-pela-ponte) | O PDFium abre o arquivo pelo caminho, sem passar os bytes pela ponte | 2026-10-17 | Aceita | [#3](https://github.com/oliveiravitor32/leitor-de-pdf-customizavel_react/pull/3), [#5](https://github.com/oliveiravitor32/leitor-de-pdf-customizavel_react/pull/5), [#6](https://github.com/oliveiravitor32/leitor-de-pdf-customizavel_react/pull/6) |
| [ADR-004](#adr-004-cache-de-páginas-em-dois-níveis-nítidas-e-miniaturas) | Cache de páginas em dois níveis (nítidas e miniaturas) | 2026-10-17 a 20 | Aceita | [#7](https://github.com/oliveiravitor32/leitor-de-pdf-customizavel_react/pull/7), [#8](https://github.com/oliveiravitor32/leitor-de-pdf-customizavel_react/pull/8), [#9](https://github.com/oliveiravitor32/leitor-de-pdf-customizavel_react/pull/9) |
| [ADR-005](#adr-005-redesenho-só-da-página-cuja-imagem-mudou) | Redesenhar só a página cuja imagem mudou | 2026-10-20 | Aceita | [#10](https://github.com/oliveiravitor32/leitor-de-pdf-customizavel_react/pull/10) |

---

## ADR-001: Login com Google no Android por plugin nativo próprio

**Status:** aceita · **Data:** 2026-10-15 · **Commit:** `7aae525`

### Contexto

O login é opcional e só serve para sincronizar as preferências (Firebase Auth + Firestore). Cada plataforma exige um fluxo:

- **Web:** `signInWithPopup` do Firebase funciona normalmente.
- **WebView do Tauri:** o popup e o redirect do Firebase não funcionam, e o Google bloqueia login OAuth dentro de WebViews embutidas.
- **Desktop** (resolvido antes, em 2026-10-12): o login abre no navegador do sistema e volta por um servidor temporário em `127.0.0.1` (`tauri-plugin-oauth`), com PKCE e troca do código pelo `id_token`.

O plano original para o Android era o mesmo caminho: navegador do sistema e retorno por deep link (`leitorpdf://auth`).

### Decisão

Um **plugin Tauri próprio em Kotlin** (`src-tauri/plugins/google-login/`) que abre a janela nativa de contas do Android pelo **Credential Manager** ("Sign in with Google") e devolve o `id_token` ao JS. O token sai com a audiência do **cliente Web** do Google, que é o que o Firebase espera. Por fim, o JS chama `signInWithCredential`.

- O usuário escolhe a conta numa janela do sistema, sem sair do app.
- A lógica testável, que converte a credencial ou a falha numa resposta (token, cancelado ou erro), ficou separada em `RespostaLogin.kt`, com testes JUnit escritos antes. Foi a primeira aplicação do TDD em código nativo, e daí veio a regra no `CLAUDE.md`.

### Alternativas descartadas

| Alternativa | Por que não |
|---|---|
| Navegador do sistema + deep link (plano original) | O usuário sai do app para um navegador e volta, e o fluxo depende do registro do deep link. A janela nativa é a experiência padrão do Android. |
| Popup ou redirect do Firebase na WebView | Não funcionam na WebView, e o Google bloqueia login embutido. |

### Consequências

- O login nativo exige um **cliente OAuth do tipo Android** no Google Cloud, amarrado ao nome do pacote e ao SHA-1 da chave de assinatura.
- O cliente atual, "Android (debug)", só vale para o pacote `.debug` com a chave de depuração do PC. **Para a Play Store será preciso outro cliente**, com o pacote sem `.debug` e o SHA-1 da chave do Google Play. Isso está no aviso de publicação do `CLAUDE.md`, porque sem esse cliente o login simplesmente não funciona no app da loja.

---

## ADR-002: Motor PDFium em Rust, com pdf.js de reserva

**Status:** aceita · **Data:** 2026-10-15 · **Commits:** `e4b6db7`, `512f780`

### Contexto

Depois que o app passou a rodar no celular, a experiência de leitura ficou bem abaixo de leitores nativos como o ReadEra: rolagem e zoom pesados. O app usava o **pdf.js** (JavaScript) dentro da WebView para tudo: interpretar o PDF, rasterizar e desenhar.

### Decisão

Combinar duas frentes:

1. **Motor nativo nas versões Tauri (desktop e Android):** **PDFium**, o motor em C++ do Chrome e do Android, usado pelo Rust (`pdfium-render`, em `src-tauri/src/pdf/`).
   - O PDFium não é seguro para várias threads, então um serviço com **uma thread dedicada** serializa o acesso.
   - A imagem volta ao JS como **bytes crus**: 8 bytes de cabeçalho (largura e altura) seguidos de RGBA, sem codificar em PNG.
   - Os binários usam uma **versão fixa** (`chromium/8066`), conferida por SHA-256 e baixada por `npm run pdfium:baixar`. Eles ficam fora do git.
   - Se a biblioteca não carregar, o app cai para o **pdf.js**, e o PDF abre do mesmo jeito.
   - A web continua só com o pdf.js, porque toda funcionalidade precisa funcionar na web (regra 5 do `CLAUDE.md`).
2. **Renderizador independente do motor (`useRenderizador`):**
   - só as páginas visíveis ±2 ficam na memória, e o resto é liberado;
   - uma renderização por vez, com prioridade para a página visível;
   - rascunho em baixa resolução antes da versão nítida;
   - teto de resolução no celular (densidade ≤ 1,5);
   - filtro de cor aplicado uma vez no desenho (`ctx.filter`), no lugar do filtro CSS recalculado a cada quadro.

Os dois motores ficam atrás da interface `DocumentoMotor`. O resto do app não sabe qual está em uso.

### Alternativas descartadas

| Alternativa | Por que não |
|---|---|
| Só otimizar o pdf.js | Ajuda (e as otimizações independentes do motor foram aproveitadas), mas o pdf.js continua sendo JavaScript disputando a thread principal da WebView. |
| Visualizador nativo do Android | Perderia a personalização de aparência, que é a razão de ser do app, e duplicaria a interface por plataforma. |
| Codificar as imagens em PNG para a ponte | O custo de codificar e decodificar não compensa: os bytes crus vão direto para `ImageData` e `createImageBitmap`. |

### Consequências

- É preciso rodar `npm run pdfium:baixar` uma vez antes de qualquer build ou teste do Tauri.
- O APK leva a `libpdfium.so`, e o instalador do Windows leva a `pdfium.dll`.
- **Ficou sem medição de antes e depois** com números: a fase de medição da Etapa 7.5 do `docs/PLANO.md` está pendente. A melhora foi validada só pelo uso.
- Logo depois surgiu um problema que esta decisão não previa: **no Android, o app estava usando o pdf.js sem ninguém perceber** (ADR-003).

---

## ADR-003: O PDFium abre o arquivo pelo caminho, sem passar os bytes pela ponte

**Status:** aceita · **Data:** 2026-10-17 · **Commits:** `fbb4e32`, `5f7494c`, `bd5fa2f`

### Contexto

**1. Não dava para saber qual motor estava ativo.** No APK de release, as mensagens de `console` do app não chegam ao `logcat`: o Tauri só as repassa em builds de debug. O log `[pdf] motor: PDFium` existia, mas não aparecia em lugar nenhum. Para tornar o diagnóstico visível, o painel de aparência passou a mostrar "Motor de PDF: …" e, quando o app cai para o pdf.js, o motivo.

**2. O painel revelou que o PDFium nunca rodou no Android:**

> Motor de PDF: pdf.js · Motivo: O PDF deve ser enviado como bytes

No desktop, o JS envia o `Uint8Array` como corpo binário da chamada. **No Android, o IPC do Tauri passa por `postMessage`, que só transporta texto**, e o mesmo `Uint8Array` chega ao Rust convertido em JSON (lista de números). O comando recusava tudo que não fosse bytes crus.

**3. A primeira correção** fez o Rust aceitar também o JSON (lista ou objeto de índices). Funcionou, mas expôs o desperdício: o arquivo atravessava a ponte **duas vezes**. Primeiro o Android lia o arquivo e o entregava ao JS (via `plugin-fs`). Depois o JS o devolvia ao Rust em JSON, cerca de 4 vezes maior que o PDF.

### Decisão

O seletor de arquivos devolve **só o caminho**, e o novo comando `pdf_abrir_caminho` lê o arquivo **no próprio Rust**, pelo `tauri-plugin-fs`, que entende também os endereços `content://` do Android.

- No arrastar e soltar (desktop) não há caminho, e os bytes crus continuam, porque lá já são rápidos.
- O pdf.js de reserva lê os bytes pelo caminho quando o PDFium falha.

### Resultado

O painel passou a mostrar "Motor de PDF: PDFium" no celular, e a abertura ficou "muito mais rápida", nas palavras do usuário. **Não houve medição com números**, só a validação no uso.

### Alternativas descartadas

| Alternativa | Por que não |
|---|---|
| Manter o JSON (primeira correção) | Duas viagens pela ponte, e a segunda cerca de 4 vezes maior que o arquivo. |
| Enviar em base64 | 33% maior que o arquivo e ainda com as duas viagens. Melhor que o JSON, pior que não enviar nada. |

### Lições

- **O IPC do Tauri se comporta diferente no desktop e no Android.** Testar só no desktop esconderia o problema para sempre.
- **Em release, falhas silenciosas precisam de um sinal visível.** O indicador de motor no painel e o limite de erro (`LimiteErro`, que mostra o erro em vez de deixar a tela branca) encontraram, cada um, um problema real nos primeiros testes. O limite de erro, por exemplo, revelou um `drawImage` com bitmap já liberado ("image source is detached").

---

## ADR-004: Cache de páginas em dois níveis (nítidas e miniaturas)

**Status:** aceita · **Data:** 2026-10-17 a 2026-10-20 · **Commits:** `76bb1f7`, `e0c46ec`, `10c93c0`

### Contexto

No modo contínuo, rolar rápido fazia as páginas **sumirem** (só o fundo vazio). Havia três causas somadas:

- só as visíveis ±2 ficavam na memória, e cada página que saía dessa faixa era liberada na hora;
- nada era renderizado antes de a rolagem parar por 120 ms;
- ao parar, a página ficava vazia até o rascunho chegar.

### Opções consideradas no início

| Opção | Avaliação |
|---|---|
| Folha de placeholder colorida | Descartada: as páginas não têm uma cor só (fotos, páginas escuras). Pintar com a cor média de cada página ainda seria só um borrão de cor. |
| Aumentar o cache de nítidas | Descartada: ~2 MB por página no celular, e um arremesso passa do limite de qualquer jeito. |
| **Dois níveis:** miniaturas baratas de muitas páginas + nítidas só perto da tela | **Escolhida.** É o que leitores como o ReadEra e o visualizador do Chrome fazem. |

### Evolução (três versões, guiadas pelo teste no celular)

1. **v1:** miniaturas com escala 0,3 (~175 KB cada), 12 à frente e 4 atrás, até 16 MB, desenhadas **durante** a rolagem. Nítidas liberadas a 4 páginas de distância.
   **No celular:** a rolagem melhorou, mas ainda havia páginas vazias, e uma travada ao inverter a rolagem.
2. **v2:** até **200 miniaturas**, com teto de **40 MB** (vale o que chegar primeiro), 12 à frente e 8 atrás. Estimativa: ~36 MB de miniaturas + ~20 MB de nítidas.
   **No celular:** pior que o esperado. Descendo devagar, as páginas caíam logo nas miniaturas, e o desenho não acompanhava o arremesso.
   Houve também um **mal-entendido**: o usuário entendeu que as "12 à frente" eram páginas nítidas, mas eram miniaturas, e as nítidas continuavam ±2. A lição é deixar explícito o que cada número controla.
3. **Medição** (`scripts/medicao/medirRenderizacao.mjs`) antes da v3. A hipótese do momento era que a ponte convertia as imagens em JSON, como no ADR-003. **Estava errada:**

   | Tipo | Tamanho | Rust + ponte | Montar a imagem no JS | Total |
   |---|---|---|---|---|
   | Miniatura | 184×238 (171 KB) | ~26 ms | ~1 ms | ~27 ms |
   | Nítida | 582×753 (1,7 MB) | ~60 ms | ~9 ms | ~70 ms |

   A imagem já volta como `ArrayBuffer`, e o custo fixo da ponte é de ~10 ms por chamada. O limite real era o ritmo: ~35 miniaturas por segundo não acompanham um arremesso se forem desenhadas só durante a rolagem.
4. **v3:**
   - **todas as miniaturas geradas logo ao abrir**, das mais próximas às mais distantes, até o limite (estimativa: 100 × 27 ms ≈ 3 s);
   - uma **fila com prioridade**, em que as miniaturas pausam enquanto houver nítida esperando, porque as duas disputam a única thread do PDFium;
   - nítidas **assimétricas**: 4 no sentido da rolagem e 2 no oposto, liberadas a 5 de distância.

   **No celular:** ainda havia páginas vazias e travadas. A investigação continuou no ADR-005.

### Consequências

- A memória de imagens fica em ~55 a 60 MB num PDF de 100 páginas carta ou A4. É uma estimativa, não medida no aparelho.
- A lógica pura (`planejarPaginas`, `planejarMiniaturas`, `CacheMiniaturas`, `FilaRenderizacao`) ficou separada do hook e coberta por testes, e foi isso que permitiu ajustar as três versões com segurança.
- **Lição:** as estimativas das versões 1 e 2 vieram do código, não do aparelho, e duas delas erraram. A partir da v3, toda mudança de desempenho passou a ser precedida de medição no celular.

---

## ADR-005: Redesenho só da página cuja imagem mudou

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

A ~27 ms por miniatura, o PDFium faz ~35 por segundo. Gerar as miniaturas só **durante** a rolagem não acompanha um arremesso. A resposta foi gerar todas **logo ao abrir**: 100 × 27 ms ≈ 3 s estimados. A fila de miniaturas pausa enquanto houver nítida esperando (ADR-004, v3).

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

Os scripts estão em `scripts/medicao/`, e o passo a passo está no [README](../scripts/medicao/README.md):
- `medirMiniaturas.mjs` mede o tempo até todas as páginas terem imagem e conta os `drawImage`;
- `medirRolagem.mjs` mede os quadros pelo `gfxinfo` durante arremessos e captura a tela no meio deles.

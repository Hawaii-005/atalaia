# Ficheiros — especificação (Fase 0)

Wireframes da aba **Ficheiros**. São a especificação: a implementação segue posição,
hierarquia, estados e comportamento daqui; o aspeto final vem dos tokens do tema
(`src/theme/tokensV6.ts`), não destes desenhos.

- `wireframe-tablet.svg` / `.png` — 1180×740, dois painéis
- `wireframe-telemovel.svg` / `.png` — 390×844, lista
- `wireframe-detalhe.svg` / `.png` — detalhe do ficheiro
- `wireframe-camadas.svg` / `.png` — pré-visualização de camadas
- `wireframe-receber.svg` / `.png` — receber por «Partilhar»
- `wireframe-estados.svg` / `.png` — carregar, vazio, sem ligação, erro, sem miniatura, sem metadados

Low-fi de propósito: cinzentos, contorno tracejado, texto curto. Nada de dados
inventados — quando um valor depende de algo que a app ainda não tem, escreve-se
«depende de X» ou «—».

## O que já existe (verificado no código)

| Peça | Onde está hoje |
| --- | --- |
| Lista de ficheiros | `FilesScreen.tsx` → `listFilesCommand('/local/', página, 100)` (`Cmd 258`), paginado; **só** ficheiros `.gcode`; máximo 20 páginas |
| Miniaturas | `utils/miniatura.ts`: `http://<ip>/thumbnail/<nome>.png` (144×144) e, em 404, a PNG embutida no cabeçalho do `.gcode` |
| Detalhe | `Cmd 260` (`fileDetailCommand`) → `ColorMapping`, camadas, tempo; cache em memória (`cacheDetalhe`) |
| Cores por ferramenta | `gcodeCores.ts` (`filamentosDoCabecalho`, `consumoDoGcode`) + `Cmd 324` (slots do CANVAS) |
| Verificação de filamentos | `utils/filamentos/verificacao.ts` → `verificarTodosOsSlots` |
| Imprimir | `startPrintCommand` + `ackDaResposta`; opções nivelar/lado da mesa/timelapse |
| Fila | `adicionarAFila({ id, printerId, name, label })` no `PrinterConnectionsContext` |
| Apagar | `deleteFilesCommand([nome])` |
| Enviar do telemóvel | `uploadGcode(ip, uri, nome, onProgresso)` — HTTP em blocos de 1 MB para `:3030/uploadFile/upload` |
| Resina | `carregarParaSaturno` (`Cmd 256` + servidor local) e `imprimirNoSaturno`; **não há listagem** de ficheiros no SDCP v1 usado pela Saturn |
| Preferências locais | `AsyncStorage` (`atalaia.ficheiros.prefs`, `atalaia.filamentos.v2`, `filaImpressao`) |
| Cópia de segurança | `utils/backup.ts` (versão 3 desde a Fase 1; aceita backups das versões 1 e 2) |
| Tema / i18n | `tokensV6.ts` (o Início já o usa) e `src/i18n` com 10 idiomas |

## Blocos — tablet

| # | Nome | Mostra | Dados (origem) | Componente |
| --- | --- | --- | --- | --- |
| 1 | Cabeçalho da lista | Título, impressora, contagem, Enviar, recarregar | `printers`, resultado do `Cmd 258` | `FicheirosCabecalho` |
| 2 | Pesquisa | Campo por nome (sem acentos, minúsculas) | estado local | `FicheirosPesquisa` |
| 3 | Filtros e ordenação | impressora, material, favoritos, ordem, lista/grelha | `Cmd 258` + `Cmd 260` + registo local | `FicheirosFiltros` |
| 4 | Lista virtualizada | miniatura, nome, tamanho·duração, ★, ↻ n | `Cmd 258`, `miniatura.ts`, `duracaoDoNome`, registo local | `ListaFicheiros` |
| 5 | Resumo | total de ficheiros, soma de tamanhos, ordem activa | `Cmd 258` | `FicheirosResumo` |
| 6 | Identidade | miniatura grande, nome, tamanho, tempo, camadas, nº de cores | `Cmd 258` (`TotalLayers`), `Cmd 260`, nome do ficheiro | `DetalheIdentidade` |
| 7 | Filamento por cor | cor, material e gramas por ferramenta; «—» quando falta | cabeçalho do `.gcode` + `Cmd 260` | `DetalheCores` |
| 8 | Ações | Imprimir, Pôr na fila, Favorito, Apagar | `startPrintCommand`, `adicionarAFila`, novo registo local, `deleteFilesCommand` | `DetalheAcoes` |
| 9 | Pré-visualização | silhueta 2D e entrada para camadas | `useGcodePreview` (só com cópia local ≤ 6 MB) | `DetalhePrevisao` |
| 10 | Verificação de filamentos | avisos de compatibilidade | `verificarTodosOsSlots` | `DetalheVerificacao` |
| 11 | Opções do arranque | nivelar, lado A/B | estado do ecrã (como hoje) | `DetalheOpcoes` |
| 12 | Aviso de estado | sem ligação / cache / erro | `error`, idade do último carregamento | `AvisoLista` |

## Blocos — telemóvel

Os mesmos blocos, por esta ordem: **1** cabeçalho, **2** pesquisa, **3** filtros,
**4** lista, **5** resumo e vista, **6** ficheiro em foco (pré-visualização do
selecionado). Tocar num ficheiro abre o ecrã de detalhe (blocos 6–11 do tablet,
empilhados, mais 9 «histórico local»). No tablet o detalhe é o painel direito: a
seleção não navega.

## Blocos — detalhe

| # | Nome | Mostra | Dados | Componente |
| --- | --- | --- | --- | --- |
| 1 | Cabeçalho | voltar | navegação | `DetalheCabecalho` |
| 2 | Miniatura | 144×144 ampliada, ★ | `miniatura.ts` + registo local | `DetalheMiniatura` |
| 3 | Metadados | tamanho, tempo, camadas — «—» quando não há | `Cmd 258`/`Cmd 260` | `DetalheMetadados` |
| 4 | Filamento por cor | por ferramenta | cabeçalho + `Cmd 260` | `DetalheCores` |
| 5 | Ações | Imprimir, Fila, ★, Apagar | ver bloco 8 | `DetalheAcoes` |
| 6 | Pré-visualização | silhueta + «Ver camadas» | `useGcodePreview` | `DetalhePrevisao` |
| 7 | Filamentos | resumo da verificação | `verificarTodosOsSlots` | `DetalheVerificacao` |
| 8 | Opções | nivelar, lado | estado local | `DetalheOpcoes` |
| 9 | Histórico local | reimpressões e última impressão | registo local (Fase 1) | `DetalheHistorico` |

## Blocos — camadas

| # | Nome | Mostra | Dados | Componente |
| --- | --- | --- | --- | --- |
| 1 | Cabeçalho | ficheiro, voltar | — | `CamadasCabecalho` |
| 2 | Desenho | vista de cima da camada (só extrusão) | G-code analisado localmente | `CamadasDesenho` |
| 3 | Slider | camada N / total | parser | `CamadasSlider` |
| 4 | Botões | anterior / seguinte (≥48 dp) | parser | `CamadasBotoes` |
| 5 | Informação | altura da camada, mudanças de cor | parser | `CamadasInfo` |
| 6 | Limite honesto | explica porque não há vista | decisão do parser | `CamadasLimite` |
| 7 | Resina | o que o `.ctb`/`.goo` permitir | formato | `CamadasResina` |

## Blocos — receber por «Partilhar»

| # | Nome | Mostra | Dados | Componente |
| --- | --- | --- | --- | --- |
| 1 | Ficheiro recebido | nome, tipo, tamanho | `ContentResolver` (content URI) | `ReceberFicheiro` |
| 2 | Escolher impressora | só compatíveis; as outras esbatidas | `printers` + extensão | `ReceberDestino` |
| 3 | Confirmação | pergunta e dois botões | — | `ReceberConfirmar` |
| 4 | Progresso | barra, %, Parar | `uploadGcode` / `carregarParaSaturno` | `ReceberProgresso` |
| 5 | Erro | mensagem e tentar de novo | erro real | `ReceberErro` |
| 6 | Aviso de tamanho | aviso antes de ficheiros grandes | tamanho do content URI | `ReceberAviso` |
| 7 | Limpeza | temporários apagados no fim | `expo-file-system` | — |

## Estados

| Estado | Quando | O que se vê | Onde |
| --- | --- | --- | --- |
| A carregar | primeiro pedido ao `Cmd 258` | esqueleto de 4–6 linhas, sem spinner em bloco | lista (bloco 4) |
| Lista vazia | resposta sem ficheiros | ícone, «Nenhum ficheiro», botão «Enviar» | lista |
| Sem ligação | erro de rede com lista anterior | última lista conhecida + faixa de aviso + «Tentar de novo» | bloco 12 |
| Erro de envio | `uploadGcode` lança | mensagem real + «Tentar de novo» / «Escolher» | receber (5) |
| A enviar | upload em curso | barra com %, botão Parar | receber (4) |
| Ficheiro sem miniatura | 404 e sem PNG embutida | marcador cinzento com ícone de cubo | lista/detalhe |
| Ficheiro sem metadados | `Cmd 260` falha ou campo vazio | «—» em cada campo | detalhe (3) |
| Sem cópia local | ficheiro > 6 MB ou só na impressora | miniatura + explicação | camadas (6) |
| Resina sem listagem | impressora de resina selecionada | aviso de que a app só envia | lista |

## Comportamento

- **Tocar** numa linha abre o detalhe (telemóvel). No tablet seleciona; o painel direito actualiza.
- **Toque longo** numa linha: menu com Favorito, Pôr na fila, Apagar.
- **Imprimir** pede sempre confirmação e mostra os avisos de filamento; usa o `startPrintCommand` actual, sem alterações.
- **Apagar** pede confirmação com o nome do ficheiro; nunca apaga em lote sem o dizer.
- **Favorito** e **reimpressões** são locais, por impressora + nome + tamanho.
- **Rodar o ecrã** mantém a seleção, a pesquisa, os filtros e a posição de scroll.
- **Telemóvel**: lista → detalhe. **Tablet (≥840 dp, paisagem)**: dois painéis.
- Áreas de toque ≥ 48 dp; botões só com ícone levam `accessibilityLabel`.
- Contraste AA nos temas existentes; nada de cores fixas no código.

## Decisões em aberto

1. **Filtro por material** — só é conhecido depois do `Cmd 260`; sem ele, o filtro esconde ficheiros. Proposta: filtrar apenas os que têm material conhecido e dizer quantos ficaram de fora.
2. **«Mais impressos»** — precisa do contador local (Fase 1). Sem registo, a ordem fica indisponível com explicação.
3. **Miniaturas: 144×144** — ampliar muito fica desfocado. Proposta: no detalhe, 144 dp com fundo desfocado, não interpolação.
4. **Cache da última lista** — hoje não existe. A Fase 2 passa a guardar a última resposta boa por impressora para o estado «sem ligação».
5. **Dois painéis no tablet** — feito na Fase 3: com a janela a partir de 1000 dp, a lista fica à esquerda e o detalhe à direita (painel, não modal). Abaixo disso, modal, como no telemóvel.

## Depende do que a app ainda não tem

| Bloco | Falta |
| --- | --- |
| 7 / detalhe 4 | Gramas por cor só quando o cabeçalho do `.gcode` as declara; senão «—» |
| 9 / camadas | Geometria por camada exige descarregar o ficheiro; acima de 6 MB não há vista (limite actual do `useGcodePreview`) |
| camadas (7) | O `.ctb`/`.goo` não é analisado pela app: só o que o formato e o código actual derem |
| lista (resina) | O SDCP v1 da Saturn não expõe listagem de ficheiros na app |
| detalhe 9 | Reimpressões e última impressão vêm do registo local (`atalaia.ficheiros.v1`), contado no arranque de cada impressão (ficheiro, fila ou histórico), com o Id do comando como testemunho |
| filtro material | Só com `Cmd 260` por ficheiro; não vale a pena pedi-lo para 2000 ficheiros de uma vez |

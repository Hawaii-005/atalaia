# Início — wireframes e especificação

Fase 0 do redesenho da aba **Início**. Isto é a especificação: a implementação segue estes blocos, esta ordem e estes estados. O aspeto (cores, cantos, tipografia) vem dos tokens de `src/theme/`, não daqui.

Ficheiros:

- `wireframe-tablet.svg` / `.png` — tablet em paisagem, 1180×740
- `wireframe-telemovel.svg` / `.png` — telemóvel, 390×844 (o ecrã continua em baixo)
- `wireframe-telemovel-camara.svg` / `.png` — telemóvel com a câmara aberta (bloco 2 expandido)
- `wireframe-tablet-bancada.svg` / `.png` — modo bancada (opcional, desligado por defeito)

Regra de leitura: cada bloco tem o mesmo número em todos os ecrãs. O que muda entre tablet e telemóvel é a posição, não o bloco.

---

## 1. Blocos

| # | Bloco | O que mostra | De onde vêm os dados | Componente a criar/usar |
|---|-------|--------------|----------------------|--------------------------|
| 1 | Cabeçalho da impressora | Nome, estado (`StatusPill`), IP, hora da última atualização; seletor de máquinas quando há mais de uma; botão `+` | `printer.printerName`, `printer.ipAddress`, `printer.connectionStatus`, `printer.lastUpdate`; `getPrintStatus(status.PrintInfo.Status)` | `PrinterHeader` + `StatusPill` (novos), `usePrinterConnections` |
| 2 | Câmara em destaque | Vídeo da câmara e três atalhos: Foto, Ecrã inteiro, Luz | Stream MJPEG em `http://<ip>:3031` dentro de WebView, como em `CameraScreen`; luz por `Cmd 403 LightStatus.SecondLight`; foto por `captureRef` | `CameraHero` (novo, extrai a lógica de `CameraScreen`) |
| 3 | Ficheiro em curso | Nome do ficheiro, camada atual/total, percentagem e tempo restante, nº de cores | `PrintInfo.Filename`, `CurrentLayer`, `TotalLayer`, `CurrentTicks`/`TotalTicks` (`formatTicksToReadableTime`), `Progress`; cores de `filamentosDoCabecalho` (ver D2) | `JobSummary` (novo) |
| 4 | Atalhos | Câmara, Ficheiros, Histórico, Inventário | Navegação existente (`navigation.navigate`, `mudarMaquina`/`mudarSecao`) | `Atalhos` (extraído do `InicioScreen` atual) |
| 5 | Histórico recente | Últimos trabalhos da máquina escolhida e `Ver tudo` | `loadHistory()` → `PrintRecord` (filename, startedAt, endedAt, outcome) | bloco atual do `InicioScreen`, sem alterações de lógica |
| 6 | Anel de progresso | Percentagem no centro, tempo restante, camada atual/total | `PrintInfo.Progress`, ticks, camadas | `ProgressRing` (novo, `react-native-svg`, gradiente do tema) |
| 7 | Temperaturas | Bico, mesa e câmara, com alvo quando existe | `TempOfNozzle`/`TempTargetNozzle`, `TempOfHotbed`/`TempTargetHotbed`, `TempOfBox` | `StatCard` (novo) |
| 8 | Slots do Canvas | A1–A4: cor, material e gramas restantes quando há bobina ligada | `Cmd 324` (`canvasSlotsCommand`) → `tray_list` (marca, tipo, cor, estado); gramas do inventário local (`Spool.canvasSlot`) | `CanvasSlots` (novo) |
| 9 | Ações | Pausar/Retomar e Parar | `isResumable(status)`, `pausePrintCommand`, `resumePrintCommand`, `stopPrintCommand` | `ActionBar` (novo, sem tocar na lógica) |
| 10 | Fila | Próxima impressão e quantas faltam; atalho para a fila | `fila` (`ItemFila`: `name`, `label`) + `CartaoFila` | `QueueNext` (novo) a partir de `CartaoFila` |
| 11 | Consumíveis | Bobina ou garrafa ativa e o que resta | `roloActivo` / `garrafaActiva` sobre `carregarInventario()` | bloco atual, extraído para `ConsumivelRow` |
| 12 | Mascote | Polvo discreto que reage ao estado (ocioso, a imprimir, sem ligação, concluído) | `PoseMascote` de `src/ui/Mascote.tsx`; estado atual do `getPrintStatus` | `Mascote` (existente) com `pose` derivada |
| 13 | Outra impressora | Linha com a outra máquina e o respetivo estado; tocar troca a máquina em foco | `printers[]` menos a escolhida | bloco atual, extraído para `OutraImpressora` |
| 14 | Relógio de bancada | Hora, data e estado, com tudo o resto reduzido | `RelogioBancada` (já existe) + `Date` | `RelogioBancada` + `useKeepAwake` |

Ordem no tablet: coluna esquerda 2, 3, 4, 5; coluna direita 6, 7, 8, 9, 10, 11; 1 em cima a toda a largura; 12 no canto do bloco 6.
Ordem no telemóvel: 1, 6, 12, 2, 7, 9, 13, 11, 4, 5, 10.

---

## 2. Estados

O que cada bloco mostra em cada estado. `—` = bloco escondido nesse estado.

| Estado | 1 Cabeçalho | 2 Câmara | 3 Ficheiro | 6 Anel | 7 Temperaturas | 8 Canvas | 9 Ações | 10 Fila | 12 Mascote |
|---|---|---|---|---|---|---|---|---|---|
| Sem impressoras | convite a adicionar (ecrã atual mantém-se) | — | — | — | — | — | — | — | ocioso |
| Sem ligação | pill "sem ligação" + hora da última leitura | último fotograma, se houver; senão "sem sinal" | último ficheiro conhecido, marcado como antigo | anel vazio | últimos valores, esbatidos + hora | últimos slots, esbatidos | escondidas | visível | semLigacao |
| Ligada, sem impressão | pill "pronta" | direto | convite: "escolher ficheiro" | 0 %, sem tempo | valores ao vivo | slots ao vivo | — | próxima da fila ou "fila vazia" | ocioso |
| A preparar / aquecer / nivelar | pill "a preparar" | direto | nome do ficheiro, sem progresso | 0 %, "a preparar" | valores ao vivo, alvo destacado | slots | só Parar | visível | imprimindo |
| A imprimir | pill "a imprimir" | direto | nome, camada, %, restante, cores | cheio até à % | valores ao vivo | slots | Pausar + Parar | visível | imprimindo |
| Em pausa | pill "em pausa" | direto | como a imprimir, congelado | anel parado, "em pausa" | valores ao vivo | slots | Retomar + Parar | visível | ocioso |
| A parar | pill "a parar" | direto | como a imprimir | último valor | valores ao vivo | slots | escondidas | visível | ocioso |
| Terminada | pill "terminada" | direto | resumo curto (duração; gramas só se existirem) + "ver histórico" | 100 % | valores ao vivo | slots | escondidas | visível | concluido |
| Erro (resina) | pill "erro" | direto | `ErrorNumber` traduzido | escondido | valores ao vivo | — | escondidas | visível | semLigacao |
| Câmara a ligar | normal | "a ligar…" com indicador | normal | normal | normal | normal | normal | normal | — |
| Câmara sem sinal | normal | "sem sinal · tentar de novo" | normal | normal | normal | normal | normal | normal | — |

Regra transversal: quando a última leitura tem mais de 30 s, o cabeçalho mostra a hora e os valores deixam de parecer em direto (opacidade reduzida no bloco 7 e 8). Isto já existe em `PrinterCard` (`lastUpdate` + `formatTimeAgo`); reutiliza-se.

---

## 3. Comportamento

- **Tocar na câmara (telemóvel)** expande o bloco 2 para 16:9 e empurra o resto para baixo; tocar de novo ou no `×` fecha. No tablet a câmara já está grande: tocar abre o ecrã inteiro.
- **Foto** guarda um fotograma (`captureRef`, como hoje em `CameraScreen`). **Ecrã inteiro** abre o modal atual. **Luz** alterna `Cmd 403` e o ícone reflete o estado real (`LightStatus.SecondLight`).
- **Parar** pede sempre confirmação com as mesmas strings de hoje (`comum.cancelarImpressao` / `comum.interrompeImpressao`).
- **Pausar/Retomar** segue `isResumable`; não se cria lógica nova nem se toca na fila.
- **Trocar de impressora** (seletor do bloco 1 ou linha do bloco 13) muda tudo o que está em baixo; a escolha persiste enquanto a app estiver aberta.
- **Rodar o ecrã** não perde a máquina escolhida nem o estado aberto/fechado da câmara.
- **Câmara**: só corre com o ecrã em foco (`useIsFocused`); ao sair do Início, o WebView é desmontado e o stream pára.
- **Fila**: o bloco 10 mostra a próxima; o botão principal abre a fila. Arrancar diretamente do Início fica para decidir (D4).
- **Modo bancada**: liga-se em Definições › Aparência; só com a app em primeiro plano (`expo-keep-awake`); sem serviços em segundo plano; sai com o botão do bloco 1 ou ao tocar fora do relógio.
- **Burn-in**: os elementos fixos (cabeçalho, anel, relógio) deslocam-se 4–8 px a cada 30 min e o brilho baixa; o relógio é o único elemento grande.
- **Re-renders**: o anel e os valores só mudam quando `Progress`, `CurrentLayer` ou as temperaturas mudam; o resto do ecrã não re-renderiza com cada mensagem SDCP.

---

## 4. Decisões em aberto

**D1 — Câmara em direto no Início.** O firmware responde 500 a `/snapshot`; só existe `/video` (MJPEG), que o `<Image>` não lê. Para ter vídeo no Início há duas opções:
(a) WebView MJPEG embutida, como no `CameraScreen` — funciona, custa ~1 MB/s e obriga a `Cmd 386`;
(b) cartão com o último fotograma guardado + botão para abrir a câmara — leve, mas não é "em destaque".
O wireframe assume (a). Confirma.

**D2 — "Número de cores" do trabalho.** Só se sabe lendo o cabeçalho do G-code (`filamentosDoCabecalho`). Hoje isso só acontece no ecrã Ficheiros. Proposta: guardar as cores no momento em que o trabalho arranca (cache local por ficheiro) e mostrar no bloco 3. Sem isso, o bloco mostra só "—". Depende de decidires se vale a pena o cache.

**D3 — Gramas por slot.** O `Cmd 324` não traz gramas. O que existe é a ligação local `Spool.canvasSlot`, que pode estar vazia. Sem bobina ligada, o slot mostra cor e material e "— g" (como no wireframe).

**D4 — Arrancar da fila no Início.** `startPrintCommand` exige `Filename`, `nivelar`, `lado` e `slot_map`; o item da fila só guarda `name`/`label`. Proposta para a Fase 3: o botão do bloco 10 abre a fila/ficheiros em vez de arrancar. Arrancar direto exige guardar mais dados no item da fila.

**D5 — Modo bancada e brilho.** `expo-keep-awake` já está no projeto (sem dependência nova). Baixar o brilho do ecrã exige `expo-brightness` (dependência nova, pequena). Alternativa: escurecer só a interface. Qual preferes?

**D6 — Mascote no Início.** Hoje o `Mascote` só aparece em estados vazios e de erro. O wireframe põe-no discreto no canto do anel, a mudar de pose com o estado. Confirma que não fica ruído.

**D7 — Histórico no tablet.** O bloco 5 fica na coluna esquerda, por baixo dos atalhos. Se preferires o ecrã mais limpo, pode passar a uma folha a partir do bloco 4.

---

## 5. O que já existe e o que muda

Já existe e é reutilizado: pausa/retomar/parar com confirmação, cartão da fila, histórico recente, consumíveis, seletor de máquinas, câmara (ecrã próprio com WebView, foto, ecrã inteiro, luz), `getPrintStatus` com o caso 20 (preparação/pausa), `Mascote`, `RelogioBancada`, `lastUpdate`.

Não existe e é novo: anel de progresso, cartões de temperatura, slots do Canvas no Início, câmara embutida no Início, cabeçalho de impressora, modo bancada, mascote associado ao estado.

Diferenças face ao pedido:
- A "câmara em destaque" não pode ser um `<Image>` do stream; ver D1.
- O "número de cores" e as "gramas" do resumo final não vêm do protocolo; ver D2 e D3.
- O Início atual mostra a miniatura do G-code como herói; isso passa a ser o bloco 3 (pequeno) e o espaço grande é da câmara.

---

## 6. Fases seguintes (para aprovação)

1. **Fase 1 — componentes base**: `ProgressRing`, `StatCard`, `CanvasSlots`, `StatusPill`, `PrinterHeader`; formatadores com testes. Ficheiros: `src/components/inicio/*`, `src/utils/inicio/formatadores.ts` + testes.
2. **Fase 2 — layout**: `InicioScreen.tsx` reescrito por blocos, dois painéis ≥840 dp, telemóvel em coluna, câmara expansível. Ficheiros: `src/screens/InicioScreen.tsx`, `src/screens/inicio/*`.
3. **Fase 3 — estados**: `estadoInicio.ts` (estado → blocos), próxima da fila, resumo de terminada, poses do mascote.
4. **Fase 4 — ligação**: último estado conhecido com hora, estados da câmara, memoização do anel.
5. **Fase 5 — modo bancada**: `useKeepAwake`, deslocamento anti burn-in, interruptor em Definições › Aparência.

Cada fase: `npm run lint`, `npx tsc --noEmit`, `npm test`, build de release e capturas tablet/telemóvel no PR.

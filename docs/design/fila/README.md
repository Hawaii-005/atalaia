# Fila — wireframes e especificação (Fase 0)

Fonte de verdade para a reorganização da aba Fila. A implementação segue estes
blocos; o aspeto final vem dos temas da app (não destes desenhos).

- `wireframe-tablet.svg` / `.png` — 1180×740, paisagem
- `wireframe-telemovel.svg` / `.png` — 390×844, vertical
- `wireframe-detalhe.svg` / `.png` — folha de detalhe (telemóvel) / painel (tablet)
- `wireframe-mesa-limpa.svg` / `.png` — confirmação «Mesa limpa?» com contagem
- `wireframe-modo-arranque.svg` / `.png` — escolha do modo de arranque
- `wireframe-erros.svg` / `.png` — erros, bloqueios e reconciliação

Gerados por `gerar_wireframes_fila.py` (nesta pasta): SVG escrito à mão e PNG
por Chrome headless (`python3 gerar_wireframes_fila.py` a partir da raiz). Tons de cinzento, contorno tracejado, números em círculo.
Texto e valores (`peca_1.gcode`, `45m`, `14:10`) são **marcadores visuais**, não
dados reais: a app mostra `—` quando não sabe.

## Blocos — tablet (1180×740)

| # | Bloco | O que mostra | De onde vêm os dados | Componente |
|---|-------|--------------|----------------------|------------|
| 1 | Cabeçalho da fila | título, impressora, nº de itens, chip do modo de arranque, botão pausar/retomar, total de tempo conhecido | `printers` + `fila` + modo (novo, persistido) | `FilaScreen` › novo `CabecalhoFila` |
| 2 | Faixa de estado do arranque | aviso «a app tem de estar aberta»; quando o motor está bloqueado, o motivo | derivado do modo + `AppState`/`connectionStatus` | novo `FaixaArranque` |
| 7 | Seletor de impressora | chips Centauri / Saturn; cada chip mostra a sua contagem | `printers` + `fila.printerId` | novo `ChipsImpressora` |
| 3 | Lista da fila | por item: posição, miniatura, nome, estado, duração, início/fim, pega de arrastar | `fila`, `duracaoDoNome()`, `extrairMiniaturaEmbutidaFila()` | `CartaoFila` (reescrito) |
| 4 | Ações do item | subir, descer, topo, duplicar, remover (alternativa acessível ao arrastar) | item selecionado | novo `AcoesItem` |
| 5 | Detalhe do item | miniatura, impressora, metadados, estado, motivo de bloqueio, estimativas, posição, ações | item + `printer.status` + histórico | `DetalheItem` (novo; irmão de `DetalheFicheiro`) |
| 6 | Rodapé | de onde vêm os itens («Ficheiros › Pôr na fila») e que a fila é por impressora | fixo | `FilaScreen` |

## Blocos — telemóvel (390×844)

| # | Bloco | O que mostra | De onde vêm os dados | Componente |
|---|-------|--------------|----------------------|------------|
| 1 | Cabeçalho | voltar, título, impressora, chip do modo | igual ao tablet | `CabecalhoFila` |
| 2 | Impressoras | chips com contagem | `printers` + `fila` | `ChipsImpressora` |
| 3 | Aviso de primeiro plano | «arranque só com a app aberta» (uma linha) | modo + `AppState` | `FaixaArranque` |
| 4 | Lista da fila | cartões com miniatura, nome, estado, duração+hora, pega, ↑↓ | igual ao tablet | `CartaoFila` |
| 5 | Tocar no item | abre a folha de detalhe | — | navegação interna |
| 6 | Barra inferior | pausar/retomar a fila, total de itens e tempo conhecido | `fila` + modo | `BarraFila` |

## Blocos — detalhe do item

| # | Bloco | O que mostra | De onde vêm os dados |
|---|-------|--------------|----------------------|
| 1 | Cabeçalho da folha | nome completo, fechar | item |
| 2 | Miniatura e metadados | miniatura, impressora, tamanho, camadas | `extrairMiniaturaEmbutidaFila()`; tamanho vem do Cmd 258; camadas **depende de ler o G-code** |
| 3 | Estado e motivo | estado do item; motivo do bloqueio quando existe | máquina de estados + regras de bloqueio |
| 4 | Estimativas | duração, início e fim estimados | `duracaoDoNome()` + relógio; `—` quando falta |
| 5 | Posição | «n de m», subir, descer, topo | índice na fila da impressora |
| 6 | Ações | arrancar agora, duplicar, remover | contexto |
| 7 | Regras visíveis | o que pede confirmação e o que a app não faz | texto fixo (i18n) |

## Blocos — «Mesa limpa?»

| # | Bloco | O que mostra | Notas |
|---|-------|--------------|-------|
| 1 | Fundo escurecido | ecrã da fila atrás, sem interação | modal |
| 2 | Cartão | «Mesa limpa?» + «A impressão anterior terminou.» | |
| 3 | Item e impressora | miniatura, nome, impressora, duração | |
| 4 | Contagem decrescente | anel + segundos; 15/30/60/120 configurável | por impressora |
| 5 | Ação primária | «Mesa limpa — arrancar» | única forma de arrancar |
| 6 | Cancelar | fecha e o item fica «à espera» | |
| 7 | Regra da contagem | no fim **não** arranca; fechar a app desfaz | |

## Blocos — modo de arranque

| # | Bloco | O que mostra | Notas |
|---|-------|--------------|-------|
| 1 | Cabeçalho | impressora a configurar | por impressora |
| 2 | Manual (por defeito) | nada arranca sozinho | estado atual da app |
| 3 | Com confirmação | pergunta «Mesa limpa?» no fim; contagem 15–120 s | hoje é o que o `filaAuto` faz |
| 4 | Automático | aviso forte + checkbox de consentimento + pausa entre arranques | **não existe hoje** |
| 5 | Guardar | sem consentimento no automático, não grava | |
| 6 | O que isto significa | app aberta, por impressora, migração do modo antigo | |

## Blocos — erros e recuperação

| # | Bloco | O que mostra | Ações |
|---|-------|--------------|-------|
| 1 | Ack recusado | código + motivo; o item não sai da fila | tentar de novo, ver motivo |
| 2 | Sem ligação a meio | envio parou; «a enviar» → «à espera» | ligar e verificar |
| 3 | Estado desconhecido | app fechada a meio; não mostra «a imprimir» sem prova | verificar, marcar concluído, repor na fila |
| 4 | Bloqueios | lista de motivos sempre visível | — |
| 5 | Fila pausada | nenhum item novo arranca; a impressão em curso continua | retomar |
| 6 | Dois toques em «Arrancar» | botão desativa, progresso visível | — |
| 7 | Regra comum | nenhum erro descarta um item em silêncio | — |
| 8 | Ao reabrir | ler fila → pedir estado real → reconciliar | — |

## Estados do item

| Estado | O que mostra | Ações permitidas |
|--------|--------------|------------------|
| `pendente` | «Pendente» + posição | reordenar, duplicar, remover, arrancar |
| `aEnviar` | «A enviar…» + progresso | cancelar envio |
| `aEsperaAck` | «À espera da impressora…» | cancelar (volta a pendente), ver motivo |
| `aImprimir` | «A imprimir» + progresso real da máquina | parar (com confirmação), **não** reordenar/remover sem confirmar |
| `concluido` | «Concluído» | remover, repetir |
| `falhou` | «Falhou» + motivo | tentar de novo, remover |
| `cancelado` | «Cancelado» + quem cancelou | repetir, remover |
| `bloqueado` | «Bloqueado» + motivo | ver motivo, reordenar (não arranca) |
| `aEsperaMesaLimpa` (derivado) | «À espera de mesa limpa» + contagem | confirmar mesa, cancelar |
| `desconhecido` (derivado) | «Estado desconhecido» | verificar, marcar concluído, repor |

Regras da máquina de estados: `pendente → aEnviar → aEsperaAck → aImprimir →
concluido`; de `aEnviar`/`aEsperaAck` pode ir a `falhou` ou voltar a `pendente`;
`cancelado` só a partir de estados não terminais; `bloqueado` é um `pendente` com
motivo. Transições fora disto são rejeitadas (função pura + testes).

## Modos de arranque

| Modo | Por defeito | Quando a impressão anterior termina | Contagem | Arranca sozinho? |
|------|-------------|-------------------------------------|----------|------------------|
| Manual | **sim** | nada acontece; o item fica pendente | — | não |
| Com confirmação | não | cartão «Mesa limpa?» + contagem | 15/30/60/120 s | só com toque |
| Automático | não | arranca após a pausa entre arranques | — | sim, com aviso aceite |

## Regras de comportamento

- **Arrasta** só o que está `pendente` ou `bloqueado`. `aEnviar`, `aEsperaAck` e
  `aImprimir` não se movem; remover nesses estados pede confirmação e nunca
  contradiz a máquina (se a impressora está a imprimir, o item não desaparece).
- **Arrancar** exige: ligação ativa, estado recente, impressora ociosa e nenhum
  bloqueio por resolver. O motivo aparece sempre, não só o botão desativado.
- **Pausar a fila** impede novos arranques; não mexe na impressão em curso.
- **Parar** e **cancelar** têm prioridade sobre qualquer arranque pendente.
- **Fechar a app** mata o motor de arranque (hoje e depois): o item fica
  «à espera». Ao reabrir, a fila é reconciliada com o estado real.
- **Nunca** dois arranques do mesmo item: id estável + marca «arranque tentado»
  + trava por impressora.
- **Nada** é marcado «concluído» sem confirmação da máquina.
- Sem notificações novas em segundo plano; os avisos existentes mantêm-se.

## Dependências de dados («depende de X»)

| Bloco | Depende de | Hoje |
|-------|-----------|------|
| Duração do item | sufixo do slicer no nome (`..._45m14s`) | `duracaoDoNome()` já existe; sem sufixo → `—` |
| Início/fim estimados | durações de todos os itens anteriores + impressora ociosa | só se tudo conhecido; senão `—` |
| Miniatura | extrair do ficheiro na impressora (`extrairMiniaturaEmbutidaFila`) | pode falhar; fica placeholder |
| Camadas | ler o G-code do ficheiro | a lista de ficheiros (Cmd 258) não traz camadas |
| Tamanho | campo do Cmd 258 | `ItemFila` ainda não o guarda — passa a guardar |
| Filamento suficiente | `verificarTodosOsSlots` + inventário | existe; no máximo é aviso |
| Motivo de bloqueio por estado antigo | `lastUpdate` da impressora | existe; limiar a definir (45 s) |

## Decisões em aberto (precisam de resposta antes da Fase 2)

1. **Tema «vidro»**: não existe na app — foi removido em 2.3.7 e restam ametista,
   esmeralda, cobre e citrino. Os desenhos usam tokens; confirmas que o aspeto
   vem do tema atual?
2. **Arrastar**: não há biblioteca de arrastar instalada (há
   `react-native-gesture-handler` + `react-native-reanimated`). Proponho arrastar
   com essas duas (sem dependência nova) e manter ↑↓ como alternativa. Aceitas,
   ou preferes só botões nesta fase?
3. **Definições de arranque**: hoje a fila arranca com `nivelar:false`, `lado:0`
   e sem `slotMap` — diferente do botão «Imprimir» dos Ficheiros. A fila deve
   guardar as definições escolhidas ao pôr na fila, ou usar sempre as predefinidas?
4. **Miniaturas**: guardar em ficheiro de cache (`expo-file-system`) ou em base64
   no item? Base64 incha o AsyncStorage e a cópia de segurança.
5. **i18n**: o teste exige as mesmas chaves nos 10 idiomas. Traduzo tudo, ou só
   PT/EN e os restantes ficam com inglês até revisão?
6. **Aviso existente**: o botão «Mesa limpa: Arrancar agora» da notificação
   (`CATEGORIA_FILA_ARRANQUE`) não tem handler — hoje não faz nada. Implementar
   (sem criar aviso novo) ou remover o botão?
7. **Fila por impressora**: hoje é uma lista única com `printerId`. Passa a haver
   ordem própria por impressora (migração da lista atual, preservando a ordem
   relativa de cada máquina)?

## Fora de âmbito

- Protocolo SDCP e comandos de envio/arranque/pausa: **não mudam**.
- Sem notificações em segundo plano novas, sem modo simulador, sem aviso de
  firmware, sem telemetria, sem serviços em segundo plano.

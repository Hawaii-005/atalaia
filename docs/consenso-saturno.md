# CONSENSO — pôr a Saturn 3 Ultra a funcionar dentro da Atalaia

Data: 2026‑10‑23 · branch `resina-atual` · código de resina em `src/saturn/` (commit 8e352e8,
transporte já provado contra a máquina com um harness Node, fora da app).

Tudo o que se segue parte de dois pontos de partida: os factos medidos na máquina (listados em
`PEDIDO.md`) e a leitura completa de `src/saturn/protocolo.ts`, `src/saturn/ligacao.ts`,
`src/contexts/PrinterConnectionsContext.tsx`, `src/utils/PrinterDiscovery.ts`, `src/types/index.ts`,
`src/utils/commands.ts`, `src/utils/errors.ts`, `src/components/Header.tsx`,
`src/components/PrinterCard.tsx`, `src/theme/botoes.ts`, `src/navigation/AppNavigator.tsx`, `App.tsx`
e dos ecrãs Home/Discovery/Files. Nenhum ficheiro do repositório foi alterado para escrever este
documento — só `CONSENSO.md`.

---

## 1. Auditoria a `src/saturn/protocolo.ts` e `src/saturn/ligacao.ts`

Os números de linha referem-se aos ficheiros tal como estão no commit 8e352e8. A ordem é por
gravidade: **A** = bug que se manifesta em funcionamento normal, **B** = robustez degradada mas não
imediata, **C** = cosmético/menor.

### 1.1 `src/saturn/ligacao.ts`

**A1 — O `close` do socket antigo dispara um `aoDesligar` falso quando a ligação é substituída.**
`receberCliente()` (221–252): quando chega uma ligação nova, a anterior é destruída (224–229). Mas o
handler `close` (245–251) só compara identidades na primeira linha — `if (this.cliente === socket)`.
A verificação seguinte, `if (this.ligado && !this.parado) { this.ligado = false; ... aoDesligar }`,
corre **qualquer que seja o socket que fechou**. Sequência concreta: a impressora (ou um cliente em
paralelo, tipo Chitubox) abre uma segunda ligação → o socket antigo morre → `aoDesligar('A impressora
fechou a ligação.')` dispara **com a ligação nova saudável**, e `ligado` passa a `false` sem motivo.
Correcção: encerrar todo o bloco dentro de `if (this.cliente === socket)`.

**A2 — Um timeout em `ligar()` deixa os dois servidores abertos.**
`ligar()` (163–207): cria os servidores MQTT e HTTP (187–191) e só depois espera a promessa de
subscrição (199). Se essa promessa for rejeitada pelo relógio de 15 s (174–176), `ligar()` lança o
erro e acaba — **não há `catch` que chame `this.desligar(false)`**. O servidor MQTT e o servidor HTTP
de ficheiros ficam a ouvir para sempre (fuga de sockets e de portas). Um `ligar()` posterior recupera,
porque faz `desligar(false)` no início (164), mas uma desistência definitiva (ecrã fechado, erro
apresentado ao utilizador) não. Correcção: `try { ... await ligacao } catch (e) { await
this.desligar(false); throw e; }`.

**A3 — Pedidos pendentes nunca são rejeitados quando a impressora fecha o socket.**
O handler `close` (245–251) limpa `this.cliente` mas ignora `this.pedidos`: um `pedido()` em curso
fica pendurado até ao relógio próprio (8 s). O equivalente WebSocket na app rejeita os pedidos
pendentes no `onclose` (PrinterConnectionsContext.tsx 791–799) — aqui falta. Correcção: no `close`,
rejeitar tudo o que estiver em `this.pedidos` e, da mesma forma, a `this.transferencia` pendente.

**A4 — Não há detecção de morte silenciosa.**
A impressora envia CONNECT com keepalive e PINGREQ (que o caso 12 responde, 283–285), mas **não há
vigia do nosso lado**: se a impressora perder corrente ou Wi-Fi, o TCP não gera um `close` fiável e
`estaLigado` continua `true` até algum pedido falhar por timeout. A FDM resolve isto com o vigia de
silêncio (`startWatchdog`, PrinterConnectionsContext.tsx 526–562: última mensagem registada, fecho
do socket após 60 s de silêncio). Correcção: registar a hora da última mensagem (data, PINGREQ e
estado público — de tudo), e fechar `this.cliente` se passar ~35 s sem nada (a impressora publica
estado a cada 5 s via comando 512, pelo que qualquer intervalo superior a 2–3 ciclos é já anómalo).

**A5 — O roteamento dos pedidos depende de um `mainboardId` adoptado só se vier vazio.**
`tratarMensagem` caso 1 (256–262): `this.mainboardId = this.mainboardId || cliente`. Se o
`mainboardId` passado a `ligar()` vier errado (fonte: registo antigo da descoberta ou escrito à mão),
os PUBLISH partem para `/sdcp/request/<id-errado>` e **nunca** chega resposta — só o timeout. O
clientId do CONNECT é a fonte da verdade (é o MainboardID da máquina); usar sempre o que a impressora
enviar. Correcção de uma linha (259).

**A6 — Os comandos 0/1/512 são mandados só uma vez (202–204).**
Se o `M66666` e a subscrição vão bem, mas o ack do 512 se perde, a impressora **não publica estado
periódico nenhum** e a UI fica «ligada» e morta. Não há ciclo de re-pedido nem reacção ao silêncio.
Correcção em duas partes: (i) repetir o 512 até ver `aoEstado` a chegar; (ii) ligar isto ao vigia do
A4, que reenvia a convite (`M66666`) antes de declarar a ligação morta.

**B1 — Uma transferência pode ficar órfã ao desligar.**
`desligar()` (514–547) limpa `this.transferencia` (526) e apaga as rotas (527), mas **não rejeita a
promessa**: a quem pediu `carregar()`, o `conclusao` fica agarrado até ao relógio de 20 min —
atribuir `null` não rejeita nada. Correcção: rejeitar a transferência pendente no `desligar()`
igual aos pedidos.

**B2 — Dois `ligar()` em paralelo sabotam-se.**
Ambos fazem `desligar(false)` no início e competem por `this.mqtt`/`this.http`/`this.aoSubscrever`;
o segundo sobrescreve os resolvers do primeiro (177–184). A corrida é improvável (auto-reconnect +
toque do utilizador ao mesmo tempo) mas existe. Correcção: guarda `this.ligando:
Promise<AtributosResina> | null` devolvida em chamadas simultâneas.

**B3 — `bufferMqtt` sem limite.**
`receberCliente` (234–242) junta tudo e `lerMensagens` (protocolo.ts 121–151) mantém o `resto`. Um
pacote corrupto que anuncie um comprimento varint enorme deixa o `resto` a crescer sem teto.
Correcção: cap (ex. 1 MB) no tamanho do resto, com fecho do socket ao exceder.

**B4 — Sem backpressure no envio do ficheiro por HTTP.**
`SocketSaturno.write()` na interface (24–29) devolve `void`, e `enviarFicheiro()` (437–448) escreve
blocos de 1 MB em cadeia, esperando apenas por um `setTimeout(0)` (446). O buffer de escrita do
socket não é escoado à velocidade de leitura: com um .goo de centenas de MB a memória da app cresce
com os bytes em fila. Correcção: `write` devolve o nº de bytes aceites (o
`react-native-tcp-socket` devolve um valor) e o envio espera `drain` antes do bloco seguinte
— o evento existe no pacote; falta expô-lo na interface. Isto é a tratar no futuro adaptador
`redeNativa.ts` (ver §2.3), mas o desenho da interface tem de o prever antes de um .goo real passar
pelo telemóvel.

**B5 — HTTP: só se serve um pedido por socket e `Range` é ignorado.**
`receberHttp()` (401–435): a flag `servido` descarta tudo o que chegue depois; o cabeçalho é sempre
`Connection: close`. Se a firmware pedir intervalos (`Range: bytes=…`) para retomar uma transferência
cortada, recebe o ficheiro inteiro e o MD5 falha. **Não confirmado** que a firmware use Range — mas
é barato antecipar: responder 206 com o segmento pedido (ler a partir do offset correspondente).

**B6 — `carregar()` pode sobrepor duas transferências.**
Sem guarda de ocupado (451–495): uma segunda chamada substitui `this.transferencia` (465), enquanto
o relógio da primeira mantém o callback vivo — que, ao disparar, faz `this.transferencia = null`
(461–464) e mata a pendência da segunda. Correcção: rejeitar logo com «transferência já em curso»,
ou enfileirar (o padrão da fila da FDM).

**B7 — `conclusao` não rejeita se o socket HTTP morrer a meio.**
`enviarFicheiro().catch(() => socket.destroy())` mata o socket, e nada rejeita a promessa até ao
relógio de 20 min. A mesma correcção de A3 (rejeitar no `close` do socket de dados) resolve.

**C1 — `aoSubscrever` sobrevive a tudo:** nunca é limpo (209–210, 177–184); após o `ligar()`, um
SUBSCRIBE posterior (a impressora reconectar-se-á a nós) resolve de novo uma promessa antiga — sem
efeito prático hoje, mas mascara A2/B2.
**C2 — `aoSubscreverErro` é código morto:** definido (209–210) e nunca chamado. Ou se invoca nos
erros do servidor, ou se apaga.
**C3 — `TimeStamp: agora()` em ms (388)** enquanto o lado WebSocket manda segundos
(PrinterConnectionsContext.tsx 970). Aceite pelo harness; registrar a divergência e não «corrigir»
sem voltar a provar na máquina.
**C4 — `desligar()` não limpa `bufferMqtt`/`ultimoTick`/`desdeTick`/`atributos`:** `ligar()` repõe os
três primeiros (169–171), mas não `desdeTick` nem `atributos` — os atributos de uma sessão anterior
sobrevivem e podem ser mostrados como se fossem actuais. Correcção: `atributos = {}` no `ligar()`.
**C5 — `enviarUdp` sem devolução de erro:** a falha do `M66666` é invisível; fazer a interface
devolver uma `Promise` e registá-la no log evita uma sessão de debug às cegas.
**C6 — O ramo `HEAD` de `receberHttp` (421–430) nunca foi testado** (no harness só se viu GET);
manter, mas registado como não provado — ou testar.

### 1.2 `src/saturn/protocolo.ts`

O codec está sólido e pequeno. O que resta:

**C7 — `textoUtf8` (17–41):** bytes lidos além do fim do buffer (`bytes[i++]` passado do comprimento)
produzem
`NaN` sem erro nem aviso; e não há validação de sequências de continuação inválidas (sai lixo em vez
de falhar). Correcção: guard `if (i >= bytes.length) break;` nos ramos de 2/3/4 bytes.
**C8 — `comprimento` (73–83)** não representa comprimento de corpo > ~256 MB (varint de 4 bytes).
Sem risco para MQTT (payloads de KB); documentar o teto.
**C9 — `publicar` (110–119):** `idPacote = 1` fixo. O quirk medido (QoS 0 com os 2 bytes extras pelo
meio) está correctamente implementado e é comentado só como «o firmware espera»; reforçar no
comentário que aqueles dois bytes são **preenchimento exigido pela firmware**, e não um id de
protocolo QoS 0 real — senão alguém os «corrige» e parte a máquina.
**C10 — `codificarTexto` (85–88)** constrói um array com `spread`; inofensivo (só headers HTTP).
**C11 — Comentário duplicado** "Bytes UTF-8…" nas linhas 43 e 90 (o segundo descreve
`decodificarTexto`, que é o inverso). Cosmético.
**Sem bugs funcionais** em `lerMensagens`/`lerConnect`/`lerSubscricao`/`lerPublicacao`/`puback` — e
convém mante-las funções puras, porque são 100% cobertas por jest sem React/Native.

### 1.3 Falta para reconexão — peças ausentes, em resumo

1. **Reconvite (`M66666`) reagindo à queda:** hoje é uma chamada + um retry fixo a 800 ms (193–197).
   Faltam reconvites periódicos durante a espera e a reacção a `aoDesligar`.
2. **Vigia de silêncio** (A4).
3. **Espera crescente de reconexão** (2 s→30 s, reset em primeiro plano) — o padrão já existe na FDM
   (PrinterConnectionsContext.tsx 467–524); aqui nada.
4. **Estado «a reconectar» na UI** (reaproveitar um `reconnectAttempt` análogo).
5. **Fecho limpo:** comando 64 antes de morrer — com a ressalva da dúvida D4 sobre o que ele de
   facto faz.

Resumo: `ligacao.ts` funciona como prova de conceito de uma sessão controlada por um harness, mas
precisa dos itens A1–A6 e B1–B7 antes de sustentar um contexto React com reconexão automática —
senão vai animar a UI com estados mortos como se estivessem vivos.

---

## 2. Integração: como, e porquê (contexto separado vs. transport no contexto)

### 2.1 Recomendação: **contexto e ecrã separados** para resina, com `kind` apenas como etiqueta

A pergunta era: «transport próprio dentro do `PrinterConnectionsContext` (com `kind: 'fdm' |
'resin'`) ou contexto/ecrã separados para resina». **Proposta: contexto separado
(`ResinaConnectionsProvider`) + ecrã separado (`ResinaScreen`) — o FDM não é tocado —, com um
`kind?: 'fdm' | 'resin'` apenas no tipo `Printer` partilhado** para listar, despachar na descoberta
e ramificar o toque em `HomeScreen`.

### 2.2 Justificativa pelo risco de regressão na FDM

O `PrinterConnectionsContext` (1257 linhas) não é uma estrutura neutra; é o núcleo de todas as
funcionalidades verificáveis da app. Colocar a resina dentro dele obriga a tocar em ~10 pontos de
comportamento FDM, todos críticos:

- `connectToPrinter` (569–831): ramificar WebSocket ↔ `LigacaoSaturno`;
- `request` (932–977) e `sendCommand` (1112–1147): a validação `isSdcpCommand` não se aplica à
  resina, e a fila de `pendingRequestsRef` está acoplada à entrega de WS por RequestID ≠
  resposta MQTT;
- `startStatusTimer` (368–398) e `sendStatusRequest` (324–366): a resina **publica** estado
  (comando 512), não responde a um pedido de comando 0 em intervalos;
- `healPrinterIp` (424–465): o critério de «em trabalho» (códigos FDM 7/8/9, 1/16/20) **não** é o
  mesmo da resina (0/16 + ticks);
- **fila de impressão** (1073–1109): espera transição para 9 — o 9 não está confirmado na resina;
- **`MonitorServico`** (1023–1041) e **`usePrintNotifications`** (App.tsx) leem
  `PrintInfo.Status`/`Progress` em semântica FDM — o payload da resina nem tem `Progress`;
- `PrinterStatus` (types/index.ts 125–140) tem `CurrentStatus: number[]`, `TempOf*`, `LightStatus` —
  a resina traz `CurrentStatus` escalar e **nenhuma temperatura**; fundir os dois obrigaria a
  alterar dezenas de acessos `.status?.TempOf…` espalhados pelos ecrãs;
- persistência `printers` em AsyncStorage (266–289) gravada pelo provider inteiro — misturar listas
  no mesmo ficheiro cria a corrida de escritas de dois providers a gravar listas diferentes.

Enfim: introduzir a resina dentro deste contexto toca **em tudo o que já está demonstrado na FDM**.
Com contexto separado, o toque na FDM é zero — o `PrinterConnectionsContext.tsx` fica intocado —
porque:

- o armazenamento da resina usa uma chave própria (`impressorasResina`), evitando a corrida de
  escritas;
- o ciclo de vida (load/save, espera crescente, heal de IP, vigia de silêncio) é **copiado dos
  padrões já demonstrados** no contexto FDM, mas instanciado para a resina sem partilhar
  referências;
- a UI de resina (§3) exige um ecrã novo de qualquer forma, porque o `PrinterCard` lê
  `TempOf*`/`Progress`/`CurrentFanSpeed` que a resina não tem; estender o `PrinterCard` por props
  envenena o componente e arrisca os comportamentos da FDM em troca de nada.

Custo da via separada: duplicação ligeira de persistência/ciclo de vida (~80–120 linhas). Aceitável
contra o risco de regressão.

**Nota sobre o transporte:** `LigacaoSaturno` **já é** o transport puro (broker MQTT + HTTP + UDP +
pedidos); o contexto novo não redefine protocolo nenhum, apenas orquestra o ciclo de vida e traduz
eventos em estado React. Falta, sim, um adaptador que implemente `RedeSaturno` sobre módulos React
Native — e há boa notícia: **`react-native-tcp-socket` v6.4.3 e `react-native-udp` já estão no
`package.json`**, e `spark-md5` é já usado pelo `gcodeUpload`; nada a adicionar ao build.

### 2.3 Lista exacta de ficheiros/funções a tocar (via recomendada)

**Ficheiros novos:**
1. **`src/saturn/redeNativa.ts`** — `export const redeNativa: RedeSaturno`. `criarServidor` sobre
   `react-native-tcp-socket` (expondo `drain`/retorno de `write` — ver B4); `enviarUdp` sobre
   `react-native-udp`; `tamanhoFicheiro`/`lerFicheiro` sobre `expo-file-system` (`getInfoAsync` /
   `readAsStringAsync` base64, reutilizando `decodeBase64` de `gcodeUpload.ts` — exportá-lo desse
   ficheiro em vez de duplicar); `md5Ficheiro` sobre `spark-md5` (SparkMD5.ArrayBuffer, como em
   `gcodeUpload.ts` 59–69).
2. **`src/contexts/ResinaConnectionsContext.tsx`** — load/save em AsyncStorage chave
   `impressorasResina`; `ligar()` via `LigacaoSaturno`; reconexão por espera crescente (padrão
   `reconnectDelay`/`scheduleReconnect` da FDM); vigia de silêncio e reenvio do comando 512; API:
   `impressorasResina`, `addPrinterResina(ip, nome, mainboardId)`, `removePrinterResina(id)`,
   `reconnectAllResina()`, `pausar()`, `retomar()`, `parar()`, `imprimir(nome, camadaInicial)`,
   `carregarFicheiro(uri, nome, emProgresso?)`.
3. **`src/screens/ResinaScreen.tsx`** — ver §3.
4. **`src/components/ResinaCard.tsx`** — ver §3.
5. *(Opcional, passos de debug)* **`src/screens/DevTestSaturnScreen.tsx`** — temporário, removível
   no final, para verificar cada passo no telemóvel antes da UI ficar rica.

**Ficheiros editados:**
6. **`src/types/index.ts`** — acrescentar `kind?: 'fdm' | 'resin'` a `Printer` (142–154); reexportar
   os tipos de resina (`EstadoResina`, `AtributosResina`, já em `src/saturn/ligacao.ts`).
7. **`src/utils/PrinterDiscovery.ts`** — acrescentar `tipo?: 'fdm' | 'resin'` a `DiscoveredPrinter`,
   preenchido em `udpDiscovery` (86–150) a partir do `Data` do `M99999`; funções: interface e
   handler `message` (112–131).
8. **`src/screens/DiscoveryScreen.tsx`** — `printerFor` (76–89) e `handleAdd` (91–107) despacham
   para `addPrinterResina` quando `device.tipo === 'resin'`; etiqueta «resina» na linha de
   resultados.
9. **`src/screens/HomeScreen.tsx`** — combinar `printers` + `impressorasResina`; `handlePrinterPress`
   (49–96) naviga para `Resina` ou `PrinterDetails` por `kind`; `PrinterCard` só para FDM.
10. **`src/navigation/AppNavigator.tsx`** — rota `Resina` no `PrintersStackNavigator`.
11. **`src/i18n/pt.ts` + `src/i18n/en.ts`** — chaves `resina.*`, **em ambos** (a verificação
    automática de `src/i18n/index.ts` 78–88 reclama se as tabelas divergirem).
12. **`App.tsx`** — envolver `AppContent` em `<ResinaConnectionsProvider>`.

**Ficheiros deliberadamente NÃO tocados:** `src/contexts/PrinterConnectionsContext.tsx`,
`src/utils/commands.ts`, `src/screens/PrinterDetailsScreen.tsx`, `CameraScreen`,
`FilesScreen`, `HistoryScreen`, `StatsScreen`, `src/hooks/usePrintNotifications.ts`,
`src/utils/fila.ts` e o nativo `MonitorServico`.

### 2.4 Detecção de resina na descoberta

O UDP `M99999` traz, em `Data.Attributes`, também `Capabilities` e `ProtocolVersion` — campos
que o `PrinterDiscovery` **ainda não extrai** (só `MainboardIP`/`MachineName`/`FirmwareVersion`/
`MainboardID`, 112–131). Proposta honesta:

- **Determinístico:** a Saturn 3 Ultra aparece como resina pelo nome (`MachineName` contém
  "Saturn"), que é exactamente o campo que a firmware manda. Risco: nomes futuros/alterados.
- **Recomendação:** heurística — resina se `MachineName` (sem maiúsculas/minúsculas) contiver
  "saturn" **ou** se as `Capabilities`, ao serem extraídas, tiverem PRINT_CONTROL e não VIDEO
  (a câmara/video está sempre disponível na FDM). Guardar o resultado como o padrão e **permitir
  alterá-lo manualmente** em Add/Edit — margem de erro mínima, sem quebra de fluxo.

---

## 3. UI honesta (sem câmara, sem temperaturas, sem lista de ficheiros)

### 3.1 Princípios

- **O que a firmware dá, mostra-se; o que não dá, não se disfarça.** A firmware (V1.5.4) não responde
  a 258/320/321/386/400/403/300/260 — sem lista de ficheiros, câmara, temperaturas, histórico. A UI
  mostra ficheiro/camada/tempo + controlos + envio, e **um aviso fixo pequeno** a indicar que a
  firmware não expõe o resto — mesmo padrão do aviso de rede local em `HomeScreen` (198–208,
  `border` + Ionicons `warning-outline`).
- **Reuso total da linguagem visual:** `Header`, `SafeAreaView edges={['top']} flex-1 bg-canvas`,
  cartões `rounded-xl2 border border-line bg-cartao p-4`, números grandes `font-bold
  fontFamily:'monospace'` como o herói de `HomeScreen` (213–219), barra de progresso fina
  `h-1.5 rounded-full bg-line` + `bg-brand` (235–240), e `theme/botoes.ts` (`BT_ACENTO`,
  `BT_PERIGO`, `BT_NEUTRA`, `BT_APAGADA` + `TX_*`).

### 3.2 Estrutura proposta do `ResinaScreen`

```
SafeAreaView (edges: top) flex-1 bg-canvas
└ Header  title = MachineName  ·  subtitle = estado de ligação
          (comum.ligada/desligada/aLigar/aReconectar — reuso de chaves existentes)
          rightAction = icon "refresh" → reconnectAllResina
└ ScrollView (padding 16, paddingBottom 32) — espelho do HomeScreen
  ├ ResinaCard (mesma forma que PrinterCard: anel de 58 dp com react-native-svg
  │             Circle + strokeDashoffset com base no progresso; ponto de cor
  │             por ConnectionStatus, como STATUS_DOT; nome + IP + lastUpdate
  │             com formatTimeAgo)
  │             — mostra EXPLICITAMENTE as 3 fichas de temperatura do PrinterCard
  │             - progresso do anel: camada (CurrentLayer/TotalLayer) quando TotalLayer>0;
  │               senão ticks (CurrentTicks/TotalTicks)
  ├ [só a imprimir] Bloco herói (espelho de HomeScreen 210–253, sem ventoinhas):
  │   ·  N grande monospaced = % por CAMADA
  │   ·  à direita: nome do ficheiro truncado (split('/').pop()), CAMADA X/Y · FALTAM h m
  │   ·  barra fina; por baixo, linha única: DECORRIDO h m · RESTANTE h m
  │     (decorrido = CurrentTicks, restante = TotalTicks − CurrentTicks; unidade por D5)
  ├ [só em transferência] Barra (% = DownloadOffset/FileTotalSize) + nome
  │   — pode atrasar até 5 s (cada ciclo TimePeriod); fazer o cartão dizer isso no subtítulo
  ├ Controlos (só a imprimir / em pausa):
  │   · "PAUSAR"/"RETOMAR" (BT_ACENTO) e "PARAR" (BT_PERIGO com confirmação via `Alert`,
  │     iguais ao handleStopPrint de HomeScreen 120–138)
  │   · desabilitados com BT_APAGADA conforme estado (critérios `isPausable`/`isResumable`
  │     análogos para resina: pausável quando em impressão com ticks a avançar;
  │     retomável quando ticks parados > 6 s)
  ├ Envio de ficheiro:
  │   · botão "ENVIAR .GOO/.CTB" (BT_ACENTO) → expo-document-picker (já dependência, usada
  │     em FilesScreen) → `carregar()` com barra de progresso ao vivo (evento `aoTransferir`)
  │   · sub-bloco pós-envio: "IMPRIMIR AGORA" (BT_ACENTO) + campo numérico "CAMADA INICIAL"
  │     (por defeito 0) — chama `LigacaoSaturno.imprimir(nome, camada)`
  │   · o nome canónico para o comando 128 (D1) deve ser sempre o que a máquina devolveu
  │     em `FileTransferInfo.Filename`/`PrintInfo.Filename` durante o envio
  └ Aviso honesto (pequeno, uma linha):
     "Esta firmware (V1.5.4) não dá lista de ficheiros, câmara nem temperaturas."
```

**Não fazer:** navegar para `CameraScreen` a partir de resina (não há protocolo); reutilizar
directamente `PrinterCard`/`showPrintControls` (lê 3 temperaturas + `Progress` FDM). Denominar
os estados honestamente: se o `PrintInfo.Status` da resina ainda não está confirmado em pausa (D3),
o ecrã **não publica nomes de estados FDM**; usa apenas «a imprimir / em pausa (ticks) / pronto /
em transferência».

### 3.3 Componente nova, não prop-hack

`ResinaCard` em nova componente, não por sobrecarregar `PrinterCard` de props (já lá vão 320
linhas e uma semântica FDM). Helpers a reutilizar de `FormatUtils`: `formatTimeAgo`,
`formatTextMaxEllipsis`.

---

## 4. Dúvidas técnicas (confirmado / não confirmado)

| # | Questão | Resposta honesta |
|---|---|---|
| D1 | O `Filename` do comando 128 é o nome simples enviado no 256? | **Não confirmado.** É o mais provável (o `Filename` veio nos dados do 256 como string simples e o `PrintInfo.Filename` do estado parece reflectir o que a máquina tratar). Mas sem comando 258 não há lista de ficheiros com que comparar. Plano de confirmação: (i) após o sucesso do envio, registar `FileTransferInfo.Filename` e `PrintInfo.Filename` publicados no estado; (ii) mandar 128 com a string exacta enviada no 256; (iii) se der Ack 1, tentar com o basename. Testar ambos, com registo de qual passou. |
| D2 | O ficheiro enviado fica em armazenamento interno e sobrevive a reboot? | **Não confirmado.** O `CleanCache:1` do 256 sugere limpeza de cache entre envios, mas nada confirma persistência após reboot. Plano: enviar, fechar a app, reiniciar a máquina, mandar 128 por nome sem re-enviar — se iniciar a impressão, é persistente. Registar também qualquer indício nos `Attributes` publicados. |
| D3 | Que código tem `PrintInfo.Status` em pausa? | **Não confirmado.** O cassini (firmware antiga) dizia 2/3/4/16, e o código actual **não confia** nisso: a pausa é detectada pela paragem dos ticks (>6 s, `ligacao.ts` 351–359) e sobre-rotulada como 20 para a UI. Confirmar durante uma impressão real pausada registando o `PrintInfo.Status` cru; só então se pode personalizar o rótulo. |
| D4 | A impressora pode ficar presa a apontar a um broker morto depois de a app fechar? | **Não confirmado, mas o risco é real.** O que se sabe: a impressora abriu o MQTT **por nossa ordem** (M66666) e só tem um canal: se a app morrer, o TCP fecha e a firmware fica sem broker. Não há dado sobre o comportamento depois (tenta reconectar? volta a escutar M66666? bloqueia o Chitubox?). O comando 64 («desligar») é mandado no fecho (ligacao.ts 514–519) com o comentário «liberta para o Chitubox», mas **o efeito real do 64 nunca foi observado numa máquina em trabalho** — não está confirmado se ele «liberta» a impressão ou desliga efectivamente a máquina. Mitigação: (i) mandar 64 antes de destruir sockets, capturando o ack; (ii) reenviar sempre o M66666 ao reabrir (o código já o faz no `ligar`); (iii) teste prático: sessão pela app → matar a app → tentar Chitubox e tentar a app, cronometrando qual reage primeiro. Se o 64 se revelar perigoso (desliga corrente), sai do caminho de fecho. |
| D5 | `CurrentTicks`/`TotalTicks` são segundos, como na FDM? | **Não confirmado para resina.** Na Centauri os ticks são segundos (`formatTicksToReadableTime`). Confirmar com impressão real: comparar o `CurrentTicks` acumulado com o relógio de parede durante ~10 min. |
| D6 | `TimeStamp` em ms (ligacao.ts 388) foi aceito? | Confirmado pelo harness (o pedido foi aceite), mas **diverge do WS** que manda segundos. Deixar como está (é o que provou) e documentar — ver C3. |
| D7 | Há HTTP `Range` para retomar transferências? | **Não confirmado** (ver B5). Apenas observável com um corte deliberado durante um envio grande. |

---

## 5. Ordem de implementação — passos pequenos, cada um verificável no telemóvel

Cada passo termina em build + instalação: `cd android && ./gradlew assembleRelease` (com
`JAVA_HOME`/`ANDROID_HOME`/`GRADLE_USER_HOME` em `/Volumes/Arquivos`) e
`adb -s R5CNC12C1LL install -r`. Verificar no telemóvel significa: o comportamento descrito
acontece — e o que não devia acontecer também não acontece (a ausência de regressão é também um
critério).

### Passo 0 — Correcções a `ligacao.ts`/`protocolo.ts` (§1)
A1–A6, B1–B7 (o crítico é A1+A2+A3+A4+A6) e C1–C5. Cristalizados em tests jest puros para o codec
(`lerMensagens`/`publicar`/`puback`/`lerConnect` — sem RN) e para `normalizarEstado` (incluindo a
pausa por ticks parados). **Verificação:** `npm test` verde; if harness da máquina ainda disponível,
repassar `ligar`/`pedido`; a app compila e a FDM não muda.

### Passo 1 — `src/saturn/redeNativa.ts`
Adaptador `RedeSaturno`: servidor TCP (react-native-tcp-socket, expondo retorno de `write` e
`drain` — B4), UDP (react-native-udp), leitura/MD5 (expo-file-system + spark-md5, reutilizando
`decodeBase64`). **Verificação:** build; abrir a app; não há regressão visível (módulo ainda sem UI).

### Passo 2 — `ResinaConnectionsProvider` mínimo + ecrã de diagnóstico
`src/contexts/ResinaConnectionsContext.tsx` com load/save em `impressorasResina`, `ligar`,
`desligar`, estado ao vivo mínimo; ecrã temporáario que lista
`MachineName`/`MainboardID`/`ProtocolVersion`/`Capabilities` e o último `EstadoResina` cru.
**Verificação:** botão LIGAR → aparece identidade da impressora e estado «pronto»
(`CurrentStatus 0`); DESLIGAR → volta a vazio sem fugas (testando desligar/ligar seguidos três vezes).

### Passo 3 — Estado ao vivo honesto
`ResinaScreen` verdadeiro (§3.2) com `ResinaCard` + estado de ligação; **sem controlos**.
**Verificação:** sem impressão mostra «pronto»; arrancando impressão pelo painel físico da máquina,
ficheiro/camada/tempo aparecem ao vivo e mudam.

### Passo 4 — Controlo (pausar/retomar/parar)
Botões com confirmação para o PARAR; falhas traduzidas por `mensagemDoErro`/`descreverAck`
(existem). **Verificação:** numa impressão real, pausar → ticks param e o rótulo passa a
em-pausa; retomar → retomam; parar → estado volta a pronto.

### Passo 5 — Envio de ficheiro
`carregar()` com picker; barra de progresso alimentada pelo evento `aoTransferir`; após conclusão
aparece «IMPRIMIR AGORA». Testar primeiro com um ficheiro falso pequeno (a máquina aceitou um falso
de 120 kB) e depois com um `.goo`/`.ctb` real pequeno. **Verificação:** a barra avança; o ecrã da
máquina passa a transferência e volta; o nome canónico (`FileTransferInfo.Filename` /
`PrintInfo.Filename`) é capturado como resposta a D1.

### Passo 6 — Imprimir
Comando 128 com o nome canónico de D1 (observado no passo 5); campo opcional de camada inicial.
**Verificação:** peça pequena impressa — arranque, progresso, pausa, aveiro e fim via app.

### Passo 7 — Resiliência de serviço
Na ordem: (i) reenvio periódico de `M66666` durante a espera; (ii) vigia de silêncio (A4) com
reconvite antes de desistir; (iii) espera crescente de reconexão + `reconnectAttempt` na UI; (iv)
heal de IPs, reutilizando o padrão FDM. **Verificação:** cortar Wi-Fi da impressora 30 s → a UI
reflecte e reconecta sozinha; mudar o IP por DHCP → o heal repõe na tentativa seguinte.

### Passo 8 — Fecho limpo e convivência com o Chitubox
Mandar 64 ao fechar (com captura do ack), destruir sockets, reconvite ao reabrir. Responder a D4 com
o teste descrito. **Verificação:** matar a app → o Chitubox deve apanhar a impressora (ou não, mas
com o comportamento medido e registado); reabrir a app → volta a ligar sem recurso a desligar a
impressora da corrente.

### Passo 9 — Integração no resto do fluxo da app
Marcação de resina em `PrinterDiscovery`/DiscoveryScreen, `HomeScreen` a combinar listas e
ramificar o toque, i18n pt/en, remover o ecrã de debug do passo 2.
**Verificação (anti-regressão final):** descobrir na mesma rede e ver A Saturn como «resina»; a
Centauri permanece com o comportamento exacto de antes em todos os ecrãs — porque este plano de
integração não toca em `PrinterConnectionsContext`, mas confirmar de cada vez.

---

*Se algum passo revelar uma contradicção com este boletim (ex.: o 64 desligar de facto a máquina,
ou o comando 128 exigir um caminho completo em vez do nome), o passo para, o facto entra aqui como
medido, e só depois se avança.*

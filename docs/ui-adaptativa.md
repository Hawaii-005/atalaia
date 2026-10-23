# UI.md — A interface adapta-se à impressora (Centauri Carbon / Saturn 3 Ultra)

Objetivo: a UI deixa de ser igual para todas as impressoras e passa a reflectir as capacidades
de cada máquina. A Centauri Carbon (FDM) tem câmara, temperaturas e ficheiros; a Saturn 3 Ultra
(resina) só publica o trabalho em curso (ficheiro, camada X/Y, tempo, estado, erro da máquina).
Nada de abas vazias nem botões mortos.

Documento escrito sobre o código tal como está hoje (a seguir, "hoje" = estado actual,
verificado na máquina). Não é código; é desenho.

---

## 1. Arquitectura de navegação

### 1.1 As duas hipóteses

**(a) Aba fixa "Monitor" cujo conteúdo muda.**
Mantêm-se três abas fixas: **Impressoras · Monitor · Definições**. A aba do meio substitui
a actual "Câmara". O conteúdo interno depende do tipo de impressora seleccionada
(o seleccionador por "chips" já existe na `CameraScreen.tsx`):

| Impressoras registadas | Conteúdo do Monitor |
|---|---|
| Só FDM (Centauri) | exactamente o ecrã de câmara de hoje |
| Só resina (Saturn) | painel de trabalho da resina (secção 2) |
| Ambas | chips (Centauri / Saturn) + o painel do tipo escolhido |
| Nenhuma | estado vazio honesto, com atalho para Impressoras |

**(b) Abas dinâmicas.**
A aba "Câmara" desaparece e dá lugar a "Trabalho" quando não há nenhuma impressora com
câmara registada. O conjunto de abas é derivado do `kind` das impressoras registadas.

Nota importante que condiciona (b): as abas têm de ser derivadas de **impressoras
registadas** (a lista `printers` carregada do AsyncStorage), nunca de `connectionStatus`.
Se fossem derivadas do estado de ligação, a aba "Câmara" desaparecia cada vez que a
Centauri caísse — Wi-Fi oscilante fazia a barra de abas reorganizar-se a cada falha,
o que é pior do que o problema original.

### 1.2 Recomendação: hipótese (a)

1. **Estabilidade estrutural.** Com (a), o conjunto de rotas nunca muda em execução. Com (b),
   registar a Centauri introduz uma rota nova a meio da sessão: a barra de abas
   reorganiza-se, os separadores deslocam-se e quem estava na aba "Trabalho" tem de
   reencontrar o sítio.
   Um rearranjo de abas deveria acontecer só quando o utilizador adiciona ou remove uma
   impressora de forma deliberada — e mesmo aí é discutível.
2. **O regresso da Centauri não perde lugar.** Quando a Centauri volta (reconexão automática
   com esperas crescentes, já implementada), com (a) nada muda estruturalmente: a aba
   Monitor continua onde estava e o cartão de vídeo simplesmente regressa quando
   `connectionStatus` passa a `connected`. Com (b), a aba "Câmara" reapareceria no meio da
   barra, mudando as posições — mexer no local de memória do utilizador por causa de uma
   reconexão automática é má experiência. Com (a), a resposta directa à pergunta
   «a aba reaparece? o utilizador perde o sítio?» é: **a aba nunca saiu do sítio e o
   utilizador nunca perdeu o sítio**.
3. **Menos código frágil.** Com (a) não há `Tab.Screen` condicional nem registos de ecrãs
   dependentes de estado. As rotas nomeadas deixam de poder "não existir":
   `navigation.navigate('Camera')` em `HomeScreen.tsx` (linha 327) deixaria de funcionar
   com (b) quando só existe resina registada.
4. **Custo de (a) aceitável.** A única desvantagem é semântica: "Monitor" é menos específico
   que "Câmara". Paga-se com mais código no `MonitorScreen` (um desvio por `kind`) —
   exactamente o que o `HomeScreen` já faz com os seus cartões adaptados por tipo.

**(b) só ganharia se** houvesse muitas impressoras de tipos diferentes e cada tipo tivesse
de ser uma aba: não é o caso — são duas máquinas, e o seleccionador por chips resolve.

### 1.3 Os nomes das abas

| | pt | en | Chave i18n |
|---|---|---|---|
| Aba 1 | Impressoras | Printers | `home.title` (inalterada) |
| Aba 2 | **Monitor** | **Monitor** | `monitor.title` (nova; ver secção 4) |
| Aba 3 | Definições | Settings | `settings.title` (inalterada) |

Ícone da aba 2: `Ionicons` **pulse / pulse-outline**, fixo, independente do tipo de máquina
seleccionada. Manter o ícone de videocam seria enganador: com só a Saturn a aba não tem
câmara nenhuma.

### 1.4 O seleccionador com mais de uma impressora

Reaproveita-se o seleccionador de chips da `CameraScreen.tsx` (linhas 477–497), corrigindo
um bug existente: hoje os chips listam **todas** as impressoras, mas a impressora escolhida
sai de uma lista filtrada sem resina (`comCamera`), pelo que tocar no chip da Saturn não
faz nada visível. No `MonitorScreen` a lista de chips passa a ser a lista completa e a
selecção passa a ser honrada para qualquer tipo.

### 1.5 Sumário do comportamento por cenário

| Cenário | Abas | O Monitor mostra |
|---|---|---|
| 0 impressoras | as três, sempre | ícone `videocam-off` + `camera.semImpressoras` + botão `camera.irParaImpressoras` |
| Só Centauri | as três, sempre | cartão de vídeo + controlos + recentes (o conteúdo actual da `CameraScreen`) |
| Só Saturn | as três, sempre | painel de trabalho da resina (secção 2) |
| Ambas | as três, sempre | chips + painel conforme o chip escolhido |
| Centauri desligada | as três, sempre | cartão escuro com etiqueta `camera.impDesligada` ou `camera.aReconectarTentativa` (existente) |
| Centauri reconecta | nada muda estruturalmente | o vídeo regressa quando `connectionStatus === 'connected'` |
| Saturn reconecta | nada muda estruturalmente | o painel "acorda"; até lá **dados parados e etiquetados** como tal (secção 3) |

O atalho para câmara no cartão da Impressoras (`PrinterCard` → `onOpenCamera`) muda de
`navigate('Camera', …)` para `navigate('Monitor', { printerId })`, mantendo a
pré-selecção por `route.params.printerId`.

---

## 2. O que aparece no lugar da câmara para a Saturn

### 2.1 Princípio

Não há nada a inventar: a `ResinScreen.tsx` já tem o essencial (estado do trabalho,
pausa/retomar/parar, envio de `.goo`/`.ctb`, erro da máquina, botão de reconexão). O
trabalho consiste em **extrair** esses blocos para um componente partilhado, montá-lo no
Monitor e deixar o ecrã de stack "Resina" usar o mesmo componente. Um só componente,
duas superfícies — nada duplicado.

Novo componente: `src/components/resina/PainelResina.tsx`, com `props: { printer, navigation }`.

### 2.2 O PainelResina, de cima para baixo

1. **Barra de reconexão** (só quando desligada): `comum.aReconectarTentativa` (nº de
   tentativas) ou `resina.naoLigada`, com o botão `resina.tentar` → `reconnectAll()`.
   Já está feito em `ResinScreen.tsx` (linhas 191–206); extrai-se tal como está.
2. **Trabalho em curso** (se `aImprimir || emPausa`, i.e. código 6 ou 20): o número grande
   de `progresso %` (54 px, monoespaçado), nome do ficheiro, `comum.emPausa` /
   `comum.aImprimir`, barra de progresso, `comum.camada` (camada X/Y) e
   `comum.restantes` (tempo calculado por `TotalTicks − CurrentTicks`). Feito em
   `ResinScreen.tsx` (linhas 210–245); extrai-se tal como está.
   Nota de honestidade: não se mostra nada além do que a máquina publica — nem
   temperatura, nem ventoinhas, nem imagem. O firmware da resina não as fornece, e o
   próprio ecrã actual admite-o em `resina.limites` (essa nota mantém-se).
3. **Bloco "em repouso"** (sem trabalho): cabeçalho `resina.estadoMaquina`, texto grande
   `comum.impressaoConcluida` (código 9) ou `resina.emRepouso`, nome do último ficheiro ou
   `resina.mesaLivre`, e linha de erro se `ErrorNumber > 0` (`resina.erroMaquina`).
   Linhas 247–266 do código actual; extrai-se tal como está.
4. **Controlos**: Pausar/Retomar (código 20 → "Retomar") e Parar (com confirmação
   `comum.cancelarImpressao` + `resina.confirmarParar`). Linhas 270–303; extrai-se tal
   como está, com os mesmos critérios de `isPausable`/`isResumable`/`isStoppable`
   (`src/types/index.ts`) — nada se recalcula.
5. **Cartão "ENVIAR FICHEIRO"** (`resina.enviarTitulo`): escolha de `.goo`/`.ctb`, barra de
   envio com percentagem, `trocar`, `enviar` via `carregarParaSaturno` e depois
   `imprimir` com confirmação `resina.confirmarImprimir`. Linhas 306–394; extrai-se tal
   como está — já está provado na máquina e é a equivalente resina de
   "Enviar G-code / Ficheiros" que a câmara da FDM tem.
6. **Últimas acções (novo, pequeno e opcional).**
   O pedido menciona "últimos comandos". Atenção: **o firmware da resina não publica
   histórico de comandos** — a máquina só publica `PrintInfo` (estado, camadas, tempo) e
   responde a pedidos individuais. A única variante honesta é um registo do lado da
   **aplicação**: as últimas 5 acções feitas a partir deste ecrã, cada uma com hora,
   etiqueta (`pausar` · `retomar` · `parar` · `enviar ficheiro` · `arrancar impressão`) e
   desfecho ("aceite", "recusado (Ack n)" ou o texto de `mensagemDoErro(erro)`).
   Cabeçalho com `monitor.registoTitulo`, estado vazio com `monitor.registoVazio`.
   Limitação assumida: só registam acções feitas **neste ecrã** — as notificações e os
   cartões da Home fazem os mesmos comandos sem passar por aqui, e não se promete
   o contrário. Se na prática isto se revelar ruído, corta-se sem tocar no resto: é uma
   sub-secção isolada.

### 2.3 O que se move e o que fica

| Ficheiro | Fica | Move |
|---|---|---|
| `ResinScreen.tsx` | `Header` (título + subtítulo com IP), botão de voltar, resolução de `route.params.printerId`, montagem do `PainelResina` | todo o resto (blocos 1–6 acima, incluindo os alertas e as formatações) |
| `CameraScreen.tsx` | nada — o ficheiro desaparece; a aba Monitor assume a sua função | lógica de selecção, vídeo, fullscreen, recentes, pausa/parar, orientação, keep-awake |
| `MonitorScreen.tsx` (novo) | cabeçalho de aba (etiqueta + ponto de estado, o padrão de `CameraScreen` linhas 448–470), `useKeepAwake`, chips, desvio por `kind` | — |

---

## 3. Estados vazios e honestos

Regra geral: nunca prometer dados ao vivo quando não há ligação, e nunca mostrar dados
antigos sem o dizer. O `Printer.status` continua a conter o último `PrintInfo` mesmo com
a impressora desligada, por isso a distinção importa.

| Estado | O que aparece | Chaves (existentes, salvo indicação) |
|---|---|---|
| Desligada | Barra com `resina.naoLigada` + botão `resina.tentar`; se houver dados parados, o painel fica escurecido (opacity ~0.5) com a etiqueta nova `monitor.ultimoDado` — "Dados de {hora}", formatada a partir de `printer.lastUpdate` | `resina.naoLigada`, `resina.tentar`, `monitor.ultimoDado` (nova) |
| A reconectar | A mesma barra, com `comum.aReconectarTentativa` (nº da tentativa); botões de controlo desactivados | `comum.aReconectarTentativa` |
| Em pausa | Continua tudo no sítio: etiqueta `comum.emPausa` sobre o painel de trabalho e o botão passa a `comum.retomar` (código 20) | `comum.emPausa`, `comum.retomar` |
| Com erro da máquina | O bloco "em repouso" mostra a linha de erro. Não inventar causas: para `ErrorNumber = 4` (ficheiro inválido/corrompido) já existe texto; para outros códigos, mostra-se o número cru "Erro da máquina {n}", sem interpretação. **Nada de prometer auto-recuperação** — enquanto a firmware mantiver o erro, a UI mantém-no. | `resina.erroMaquina` |
| Sem trabalho | "Em repouso" + "Mesa livre, sem trabalho". Não se reutiliza `camera.mesaLivre` (fala de impressão em curso e é da FDM) | `resina.emRepouso`, `resina.mesaLivre` |
| A enviar `.goo`/`.ctb` | Barra de envio + `resina.aEnviar` com percentagem; os controlos de impressão continuam operacionais | `resina.aEnviar` |
| Sem câmara no Monitor da resina | Resolve-se por **omissão**: nenhum botão de câmara, nem desactivado, nem etiqueta a dar desculpa — simplesmente não existe | — |

Notas de honestidade global:

- **Sem lista de ficheiros na resina.** A firmware da Saturn não expõe listagem — os
  comandos aceites por esta ligação (ver `PrinterConnectionsContext.tsx`, `request`) são
  apenas 0 (estado), 128/129/130/131 (imprimir/pausar/parar/retomar) e o envio via
  `carregarParaSaturno`. O painel da resina não mostra o cartão "Ficheiros" da FDM.
- **Sem temperaturas nem ventoinhas na resina**: os campos (`TempOfNozzle`, etc.) não
  existem no SDCP V1 desta máquina.
- **Sem estimativas à margem**: o tempo restante da resina é o que a máquina
  reporta; se ela manda um valor que não bater certo, mostra-se o valor — não se calcula
  uma estimativa própria sobre a qual o firmware nada sabe.

---

## 4. Plano de implementação

Ordem pensada para manter a build a compilar em cada passo. Nada disto altera a rede.

### Ficheiros novos

1. **`src/components/resina/PainelResina.tsx`**
   Extraído de `ResinScreen.tsx`. Props: `printer: Printer`, `navigation`.
   Contém os blocos 1–6 da secção 2.2. A lógica de comandos
   (`pausePrintCommand`/`resumePrintCommand`/`stopPrintCommand` via `request`),
   `carregarParaSaturno`, `imprimirNoSaturno`, os alertas e as formatações
   (`formatoTamanho`, `formatoTempo`) movem-se exactamente como estão.

2. **`src/components/camera/CameraImpressora.tsx`**
   Extraído de `CameraScreen.tsx`. Props: `printer: Printer`, `navigation`, `pouparDados`.
   Move-se: o cartão 16:9 (WebView MJPEG ou `SnapshotAoVivo` em modo poupança), etiqueta
   "EM DIRETO", acções de fullscreen/fotografia, rodapé camada/tempo/barra, linha
   Bico/Mesa/Luz (`LIGHT_COMMAND` 403), recentes, pausa/parar, enviar G-code/Ficheiros,
   o `Modal` de fullscreen, o bloqueio de orientação ligado a `fullscreen`, a lógica de
   pedido do fluxo (Cmd 386, com a guarda `lastVideoRequestRef`) e os HTML
   `streamHtml`/`fullscreenHtml` (o `<img>` com recuo exponencial — não se tocar: a
   impressora só aceita UMA ligação de vídeo e não a liberta depressa). Responsabilidade
   de manter **uma só `WebView` viva** fica no componente.

3. **`src/screens/MonitorScreen.tsx`** (a nova aba)
   - `usePrinterConnections()` — só para ler `printers`; sem chamadas de rede.
   - `useKeepAwake()` (sai da `CameraScreen`: acompanhar uma impressão de camadas longas
     também merece ecrã ligado na resina).
   - Leitura da preferência `modoRemoto` via `AsyncStorage` (preferência global que hoje a
     `CameraScreen` lê), passada como `pouparDados` ao `CameraImpressora`.
   - Selecção de impressora: `route.params?.printerId` → primeira ligada → primeira,
     sobre **todas** as impressoras (sem filtro por `kind`; o desvio acontece depois) —
     corrige o bug dos chips (secção 1.4).
   - Cabeçalho de aba: etiqueta `monitor.title` + ponto de estado da impressora
     seleccionada (verde/vermelho, padrão de `CameraScreen` linhas 448–470); chips
     quando `printers.length > 1`.
   - Desvio: `printer.kind === 'resin'` → `<PainelResina/>`; caso contrário →
     `<CameraImpressora/>`.
   - `printers.length === 0` → estado vazio: icon `videocam-off`, `camera.semImpressoras`,
     botão `camera.irParaImpressoras` (tal como hoje; as chaves `camera.*` continuam a
     ser o texto certo, não vale a pena duplicar).

4. **`src/hooks/useRegistoComandos.ts`** (para a secção 2.2.6)
   `const [accoes, registraAcao] = useRegistoComandos(5);` — guarda
   `{ id, hora, accao, desfecho }[]`. Chamado do `PainelResina` à volta de cada
   `request`/`carregar`/`imprimir`. Cerca de 30 linhas, sem estado global.

### Ficheiros editados

5. **`src/navigation/AppNavigator.tsx`**
   - Substituir `<Tab.Screen name="Camera" component={CameraScreen} options={{ title: t('camera.title') }}>` por
     `<Tab.Screen name="Monitor" component={MonitorScreen} options={{ title: t('monitor.title') }}>`.
   - No `tabBarIcon`: trocar o ramo `route.name === 'Camera'` por `route.name === 'Monitor'`,
     com `Ionicons` `pulse`/`pulse-outline`.
   - Remover o `import { CameraScreen }`; adicionar o `MonitorScreen`. O stack
     `PrintersStackNavigator` **mantém** a rota `Resina`, que é o destino do cartão de
     resina na Home.

6. **`src/screens/HomeScreen.tsx`**
   Linha 327: `navigate('Camera', …)` → `navigate('Monitor', …)`. Mais nada — o cartão da
   resina (hoje sem `onOpenCamera` nem `onToggleLight`) e o `onPress` → `Resina` ficam
   intactos.

7. **`src/screens/ResinScreen.tsx`**
   Reduz-se a `Header` (título + subtítulo `resina.subtitulo` com o IP) +
   `<PainelResina printer={printer} navigation={navigation}/>`. Mantém-se como ecrã de
   stack, para o fluxo de envio/impressão continuar exactamente onde está — já provado.

8. **Apagar `src/screens/CameraScreen.tsx`** (todo o seu conteúdo teve destino; deixá-lo
   seria uma segunda câmara a viver em paralelo). Confirmado: é importado apenas em
   `AppNavigator.tsx` (não consta do `src/screens/index.ts`); verificar no regulador de
   busca que não restam `import { CameraScreen }` nem `navigate('Camera')`.

9. **`src/i18n/pt.ts` e `src/i18n/en.ts`** — só 4 chaves novas, **nas duas tabelas**
   (a verificação de paridade em `src/i18n/index.ts` linhas 78–88 avisa em `__DEV__`
   quando não coincidem):

   | chave | pt | en |
   |---|---|---|
   | `monitor.title` | Monitor | Monitor |
   | `monitor.ultimoDado` | Dados de {hora} — sem ligação | Data from {hora} — printer offline |
   | `monitor.registoTitulo` | Últimas acções | Recent actions |
   | `monitor.registoVazio` | Acções feitas neste ecrã ficam registadas aqui. | Actions taken on this screen will be listed here. |

   Todo o resto do painel reaproveita `resina.*` e `comum.*`; o painel da FDM continua a
   apoiar-se nas `camera.*`. Não se renomeia nenhuma chave existente.

### O que NÃO se toca

- `src/saturn/**` — transporte SDCP V1 por MQTT, provado na máquina. Fora de alcance.
- `src/contexts/PrinterConnectionsContext.tsx` — só se consome (`printers`, `request`,
  `carregarParaSaturno`, `imprimirNoSaturno`, `reconnectAll`). Reconexão, vigia de
  silêncio, fila e notificações: como estão.
- `src/utils/**` — construtores de comandos, `uploadGcode`, tratamento de erros (`Ack`),
  ficheiros, notificações.
- `src/types/index.ts` — `PrinterKind`, `classificarEstado`,
  `isPausable`/`isResumable`/`isStoppable`.
- `src/components/PrinterCard.tsx` — continua a consumir as props que já tem
  (`showTemps`, `onOpenCamera`, `onToggleLight`); a mudança de destino feita no lado de
  quem passa as props (`HomeScreen`).
- `app.json` / lado nativo — nada de permissões novas.

---

## 5. Riscos e testes

### Risco 1 — referências à rota que muda de nome
Mudar `Camera` → `Monitor` quebra qualquer `navigate('Camera')` deixado para trás.
Verificação: `grep -rn "'Camera'" src/` antes e depois — hoje só existe o
`navigate('Camera')` em `HomeScreen.tsx:327` e a rota em `AppNavigator.tsx` (linhas 60 e
108). Teste manual: pelo cartão da Home, tocar no botão de câmara do cartão da Centauri —
deve abrir o Monitor já focado nela (chip pré-seleccionado).

### Risco 2 — i18n pt/en desalinhadas
A paridade de chaves é verificada em dev e, em produção, uma chave em falta cai
silenciosamente para pt — em inglês nem sempre salta à vista se não se testar.
Verificação no arranque de dev: nenhum aviso `[i18n] as tabelas pt/en …`. Teste manual:
emulador à inglesa (locale `en`) a visitar o Monitor nos três cenários (FDM / resina /
0 impressoras); nenhuma chave crua no ecrã, nenhum aviso na consola.

### Risco 3 — o cartão da Home
O cartão da resina mantém-se sem botões de câmara nem luz; o da FDM passa a navegar para o
Monitor. Verificação: cartão Centauri ligada → detalhes; cartão Saturn → ecrã "Resina" de
stack; o bloco de hero do topo da Home (`emTrabalho`, linhas 215–270 já adaptadas por
`kind`) sem regressões — camada/tempo/bico/mesa para FDM, camadas/nome para resina.

### Risco 4 — o ecrã de câmara, o mais sensível
A impressora só aceita UMA ligação de vídeo: se a extracção deixar uma `WebView` viva
extra (por exemplo o Modal de fullscreen montado em paralelo), o fluxo acaba em HTTP 500
e só volta com um corte de corrente na máquina. O mesmo vale para o modo poupança
(`modoRemoto`, fotografia cada 2 s em `:3031/snapshot`). Verificação:
1. Monitor da Centauri → vídeo roda; fullscreen → roda dentro do Modal (`:3031/video`
   com `object-fit: contain`).
2. Fotografia → guarda na galeria (permissões pedidas na 1.ª vez).
3. Ligar/desligar "Poupar dados" nas Definições e repetir 1–2.
4. Navegar para outra aba e voltar: a `WebView` morre e recomeça uma só.
5. Botão de refresh do cabeçalho (`restartStream`) recupera o fluxo.
6. Entradas/saídas rápidas da aba repetidas — nenhum 500.

### Risco 5 — o fluxo de envio já provado da resina
Extrair não devia mexer na rede, mas uma assinatura trocada (`carregarParaSaturno`
com o 4.º argumento de progresso) parte a barra de envio em silêncio. Verificação: enviar
um `.goo` de teste → barra com percentagem → "já está na impressora" → Imprimir →
confirmação → arranca; pausa → retoma; parar com confirmação; ficheiro corrompido de
propósito → `resina.erroMaquina` (ErrorNumber 4).

### Risco 6 — dados parados apresentados como ao vivo
`Printer.status` de uma impressora desligada continua com o último `PrintInfo`; um painel
que o monte sem etiqueta parece impressão em curso com a máquina morta. Verificação:
imprimir na Saturn, cortar-lhe o Wi-Fi, esperar a vigia de silêncio (45 s em
`PrinterConnectionsContext.tsx`) → painel escurece + `monitor.ultimoDado` + botões
desactivados; reconectar → o painel retoma os valores reais.

### Risco 7 — ritmo de actualizações da resina
A resina empurra estado por MQTT cada ~5 s; a FDM faz polling (31 s por defeito,
configurável). O painel actualiza, portanto, muito mais vezes: verificar com impressão
em curso que a percentagem sobe e a camada avança sem bloqueios nem dependências
estranhas na extracção — o painel de hoje já aguenta as actualizações de cada ~5 s;
o risco é apenas acrescentar estados derivados desnecessários durante a extracção.
Manter os cálculos locais (`progresso`, `restante`, `formatoTempo`) tal como estão.

### Risco 8 — o registo de acções não mentir
O registo "Últimas acções" é da aplicação, não da máquina; o texto de
`monitor.registoVazio` tem de o dizer sem rodeios. E não existe resposta de
"comandos prévios" no SDCP V1 desta impressora — não se inventa qualquer histórico
do lado da máquina. Se gerar dúvidas em utilização, corta-se primeiro.

### Bateria final de casos

| Caso | Onde verificar | Esperado |
|---|---|---|
| Só Centauri ligada | aba Monitor | vídeo, bico/mesa, recentes, pausa/parar (como hoje) |
| Só Saturn ligada | aba Monitor | PainelResina completo, sem qualquer referência a câmara/temperaturas |
| Ambas | aba Monitor | chips para ambas; a troca de chip troca o painel |
| 0 impressoras (apagar as duas / instalação limpa) | aba Monitor | estado vazio → "IR PARA IMPRESSORAS" |
| Centauri cai e volta | aba Monitor | etiquetas de desligada/a reconectar; o vídeo regressa sem perder o foco da aba |
| Saturn cai a meio | aba Monitor | painel escurecido + `monitor.ultimoDado` + "Tentar agora" |
| Pausa na Centauri (código 20) | aba Monitor | botão "Retomar" — critério `isResumable` existente |
| Pausa na Saturn | aba Monitor | botão "Retomar" |
| Emulador em inglês, três cenários | toda a app | nenhum texto vazio/de chave crua, nenhum dev warning |
| Impressão em curso (ambas ao mesmo tempo) | Home + Monitor | hero da Home e painel do Monitor coerentes entre si |

---

## 6. Veredicto sobre os pontos do pedido

- **Hipótese (b), abas dinâmicas:** má ideia por agora — um rearranjo de abas a meio da
  sessão paga mais do que promete (secção 1.2). Recomenda-se a (a), aba fixa com conteúdo
  adaptado por chips.
- **"Últimos comandos" na resina:** só com a ressalva de que o firmware nada publica
  nesse sentido — fica como registo local do lado da aplicação, claramente etiquetado
  (secção 2.2.6), e é a primeira coisa a cortar se estorvar.
- **O resto do pedido está bem posto:** ocultar o que não existe em vez de desactivar
  botões mortos, e extrair o painel da `ResinScreen` para um componente partilhado em vez
  de duplicar — eram exactamente as duas decisões que faltavam tomar, e o código actual
  já prepara o terreno para ambas.

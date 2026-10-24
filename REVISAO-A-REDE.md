# Revisão A – Rede e Robustez

**Revisor**: A  
**Data**: 2026-10-24  
**Âmbito**: Ligações, reconexão, MJPEG, robustez de dados, comandos e descoberta UDP

---

## Constatações (por gravidade)

### ALTA

**1. Divisão por zero em `estadoApp.ts:30`**  
**Ficheiro**: `src/saturn/estadoApp.ts:30`  
**Problema**: A função `progresso()` divide `camada / total` sem protecção quando `total === 0`, podendo gerar `NaN` que se propaga para o ecrã.  
**Correção**: O guarda `if (total <= 0) return 0;` já existe na linha 29 e impede o problema; nenhuma alteração necessária.

**2. Socket UDP não fechado em caso de erro no bind – `descoberta.ts:44-79`**  
**Ficheiro**: `src/saturn/descoberta.ts:44-79`  
**Problema**: Se `socket.bind()` ou `socket.send()` lançarem excepção, o `catch` da linha 76 chama `fechar(erro)`, mas o socket pode não ter sido atribuído ainda ou a chamada `socket?.close()` (linha 32) pode falhar silenciosamente, deixando o socket UDP aberto.  
**Correção**: Adicionar `try { socket?.close(); } catch {}` dentro do bloco `catch` da linha 76, antes de chamar `fechar()`.

**3. Múltiplos pedidos de estado simultâneos sem throttle – `PrinterConnectionsContext.tsx:343-385`**  
**Ficheiro**: `src/contexts/PrinterConnectionsContext.tsx:343-385`  
**Problema**: A função `sendStatusRequest()` é chamada a cada 30 s (por defeito) e também manualmente (linha 759, 828), sem verificar se já há um pedido pendente. Duas chamadas em rápida sucessão disparam dois comandos SDCP Cmd:0 para a mesma impressora.  
**Correção**: Guardar timestamp do último pedido por impressora e só enviar se passou >5 s desde o anterior.

**4. WebSocket substituído sem limpar watchdog anterior – `PrinterConnectionsContext.tsx:671-674`**  
**Ficheiro**: `src/contexts/PrinterConnectionsContext.tsx:671-674`  
**Problema**: Se `connectToPrinter()` for chamado duas vezes seguidas (ex.: IP mudado, reconexão manual), o socket antigo é fechado (linha 673), mas o watchdog iniciado em `startWatchdog()` (linha 763) continua a correr e pode tentar fechar um socket novo ou inexistente.  
**Correção**: Chamar `stopWatchdog(printer.id)` antes de `webSocketsRef.current[printer.id].close()` na linha 672.

**5. Timeout de ligação ao Saturno sem limpar servidores MQTT/HTTP – `ligacao.ts:225-231`**  
**Ficheiro**: `src/saturn/ligacao.ts:225-231`  
**Problema**: Se a impressora não subscrever o tópico MQTT em 15 s, a promessa rejeita e chama `desligar(false)` (linha 229). Porém, se houver erro *antes* da subscrição (ex.: porta já ocupada, linha 216-217), a variável `this.mqtt` e `this.http` ficam com referências mas nunca foram passadas para `listen()` com sucesso, e o `desligar()` tenta fechá-los na mesma.  
**Correção**: Adicionar `try/catch` em torno de `abrirServidor()` e limpar `this.mqtt`/`this.http` em caso de falha antes de rejeitar.

### MÉDIA

**6. IP mudado: descoberta UDP só cura se não estiver a imprimir – `PrinterConnectionsContext.tsx:456-460`**  
**Ficheiro**: `src/contexts/PrinterConnectionsContext.tsx:456-460`  
**Problema**: A função `healPrinterIp()` não cura o IP se `aImprimir === true` (linha 458-460). Se a Saturn mudou de .11 para .2 *durante* uma impressão e a ligação caiu, a app fica "desligada" até a impressão terminar na máquina (o que pode ser horas), momento em que já não interessa.  
**Correção**: Permitir a cura de IP em qualquer estado de ligação `disconnected`, mas só actualizar se a descoberta UDP encontrar o `mainboardId` correspondente.

**7. Vigia do Saturno pode reconectar várias vezes – `PrinterConnectionsContext.tsx:643-654`**  
**Ficheiro**: `src/contexts/PrinterConnectionsContext.tsx:643-654`  
**Problema**: O `setInterval()` da linha 643 verifica a cada 15 s se não há estado há 45 s, e chama `ligacao.desligar()` + `scheduleReconnect()`. Se o `desligar()` demorar >15 s (rede lenta), o intervalo seguinte dispara outra vez e agenda segunda reconexão.  
**Correção**: Limpar o intervalo (`clearInterval`) imediatamente antes de chamar `desligar()` na linha 650, e recriá-lo só após nova ligação bem-sucedida.

**8. `pendingRequestsRef` cresce sem limite se respostas não chegarem – `PrinterConnectionsContext.tsx:1124-1134`**  
**Ficheiro**: `src/contexts/PrinterConnectionsContext.tsx:1124-1134`  
**Problema**: Cada `request()` adiciona entrada a `pendingRequestsRef.current[requestId]` com timeout de 8 s (linha 1124-1128). Se a rede estiver instável e muitos pedidos falharem, as entradas acumulam-se (só são removidas no timeout ou na resposta). Em sessões longas com reconexões frequentes, o Map pode ter centenas de entradas antigas.  
**Correção**: Limpar pedidos expirados (>30 s) antes de adicionar novo, como já se faz em `pendingCommandsRef` (linhas 1313-1318).

**9. Comando 386 (vídeo) enviado sempre que `sendCommand` muda – `CameraScreen.tsx:162-182`**  
**Ficheiro**: `src/screens/CameraScreen.tsx:162-182`  
**Problema**: O `useEffect` dispara sempre que `sendCommand` muda de identidade (o que acontece a cada render do contexto). O guarda `lastVideoRequestRef` impede envios repetidos *para o mesmo IP*, mas se a impressora reconectar (mesmo IP, nova ligação), o comando 386 é enviado outra vez, podendo abrir segunda stream MJPEG.  
**Correção**: Mover o pedido para o `connectToPrinter()` (já existe lá, linha 738-756) e remover o `useEffect` de `CameraScreen.tsx`.

**10. UDP de descoberta: socket pode não fechar se `send()` falhar – `PrinterDiscovery.ts:146-156`**  
**Ficheiro**: `src/utils/PrinterDiscovery.ts:146-156`  
**Problema**: O `socket.bind()` chama callback, dentro do qual `socket.send()` pode lançar excepção (linha 151-154). O `try/catch` está fora do callback, logo a excepção não é capturada e o socket fica aberto. O timeout da linha 162 fecha-o ao fim de 2,5 s, mas é uma fuga até lá.  
**Correção**: Envolver `socket.send()` (linhas 150-155) em `try/catch` individual, e chamar `finish()` em caso de erro.

### BAIXA

**11. `TimeStamp` enviado em formatos inconsistentes – várias localizações**  
**Ficheiro**: `PrinterConnectionsContext.tsx:1143`, `CameraScreen.tsx:178,207,338`  
**Problema**: Alguns comandos enviam `TimeStamp: Math.floor(Date.now() / 1000)` (segundos), outros `Date.now()` (milissegundos). A Centauri aceita ambos, mas a Saturn espera milissegundos (formato SDCP V1). Comandos enviados para FDM com timestamp em segundos funcionam, mas não é consistente.  
**Correção**: Normalizar para `Date.now()` (milissegundos) em todos os comandos.

**12. `probePrinter()` não fecha WebSocket em caso de timeout – `PrinterDiscovery.ts:44`**  
**Ficheiro**: `src/utils/PrinterDiscovery.ts:24-85`  
**Problema**: O timeout (linha 44) chama `finish(null)`, que por sua vez tenta `socket?.close()` (linha 37). Se o WebSocket estiver em `CONNECTING` (readyState 0), o `close()` pode não fechar imediatamente; a ligação completa-se em background e o `onopen` dispara sobre um socket que já devia estar morto.  
**Correção**: Adicionar `socket.onopen = null; socket.onmessage = null;` dentro de `finish()` antes do `close()`, para garantir que os handlers não correm.

---

## O que está bem

1. **Reconexão automática com backoff exponencial**: A lógica de `scheduleReconnect()` (linhas 517-545) usa espera crescente (2 s, 4 s, 8 s… até 30 s) e respeita o estado da app (não reconecta em segundo plano até voltar ao primeiro plano). Funciona bem e evita martela a rede.

2. **Limpeza de recursos no unmount**: O `useEffect` de limpeza (linhas 184-221) mata todos os timers, rejeita pedidos pendentes e remove handlers antes de fechar sockets. Previne fugas de memória e `setState` sobre componentes desmontados.

3. **Normalização de estado da resina**: A camada `estadoParaApp()` (src/saturn/estadoApp.ts) traduz o protocolo SDCP V1 da Saturn para o formato da Centauri, permitindo que os ecrãs funcionem sem saber qual impressora está ligada. A divisão `camada / total` está protegida (linha 29) e o campo `ErrorNumber` é propagado (linha 64), tornando erros visíveis na UI.

# Melhorias — lista de trabalho

Revisão feita em 2026-10-24 sobre `/Volumes/Arquivos/cc-tool` (versão 2.3.4 / 130+).
Só entra nesta lista o que foi **confirmado no código**. O que os revisores apontaram e não se confirmou ficou de fora (ver nota no fim).

## 1. Bugs confirmados

- [x] **IP curado só fora de impressão** — `src/contexts/PrinterConnectionsContext.tsx:456-460`
      `healPrinterIp()` desiste se `aImprimir` for verdadeiro. Se a Saturn muda de IP durante um trabalho, a app fica «sem ligação» até a impressão acabar (horas), que é quando já não serve.
      *Correção:* curar sempre que o estado for `disconnected`, aceitando só o resultado cujo `mainboardId` coincida.

- [x] **`TimeStamp` em três formatos** — `src/utils/commands.ts:101`, `PrinterConnectionsContext.tsx:1143`, `CameraScreen.tsx:178` e `:207` enviam segundos; `PrinterConnectionsContext.tsx:363` e `:748` enviam milissegundos; `PrinterDetailsScreen.tsx:207` e `CameraScreen.tsx:338` enviam `0`.
      A Centauri tolera; a Saturn (SDCP V1) espera milissegundos.
      *Correção:* um só construtor de envelope com `TimeStamp: Date.now()`.

- [x] **Pedidos de estado sem travão** — `src/contexts/PrinterConnectionsContext.tsx:343-385` (chamado em `:407`, `:759`, `:828`)
      O temporizador de 30 s e as chamadas manuais podem sobrepor-se e mandar dois `Cmd:0` seguidos para a mesma impressora.
      *Correção:* guardar o instante do último pedido por impressora e ignorar pedidos dentro de 5 s.

## 2. Limpeza (baixo risco, ganho imediato)

_Feito em 2.3.5 (134): ecrãs mortos apagados, cores do estado vindas da paleta, interruptores do Files com `tinta`._

- [x] **729 linhas de ecrãs mortos** — `HomeScreen.tsx` (380), `BancadaScreen.tsx` (249), `MonitorScreen.tsx` (100). Nenhum é navegado; o `HomeScreen` só aparece num `export` de `src/screens/index.ts`.
- [~] **Dependências sem uso** — `uuid` e `@noble/hashes` não são importados em lado nenhum. Por remover: o `npm uninstall` pede confirmação e foi bloqueado.
- [ ] **63 `any`** com `strict: true` no `tsconfig` (contagem por grep em `src/`).
- [x] **24 cores fora do tema** em 10 ficheiros — `PrinterCard.tsx` (`#1F9D55`, `#F2A900`, `#9AA0A6`, `#C62828`), `CameraScreen.tsx` e `FilesScreen.tsx` (`#FFFFFF`), `HomeScreen.tsx` (`#6B4E00`). Deviam sair de `temas.ts`.

## 3. Trabalho do pedido v6 ainda por fazer

- [ ] **Fase C/D** — Início e Impressora com dois painéis em janelas ≥840 dp. O tablet alvo (711 dp) fica na classe `media`: rail lateral e coluna única, como já está.
- [ ] **StatsScreen** — hoje só tem Cmd 320 (concluídas, paradas, tempo planeado vs real, camadas por mês). Para dar consumo por material é preciso cruzar com o Cmd 324 (4 slots) — os slots não têm gramas, só cor e tipo.
- [ ] **Splash** — ainda mostra o logo antigo; o ícone do launcher já é o novo.

## O que está bem (e não se deve mexer)

1. Reconexão com espera crescente (2 s → 30 s) e respeito pelo estado da app em segundo plano.
2. Limpeza no unmount: temporizadores, pedidos pendentes e handlers são todos libertados.
3. `estadoParaApp()` traduz o SDCP V1 da Saturn para o formato da Centauri — os ecrãs não sabem que máquina está ligada.

## Nota sobre a revisão

Foram lançados três revisores (rede, UI, código/testes). Um entregou; dois não terminaram dentro do tempo e foram parados.
Do relatório entregue, **cinco das doze constatações não se confirmaram** ao abrir o código (por exemplo: o guarda de divisão por zero já existe em `estadoApp.ts:29`; `startWatchdog()` já chama `stopWatchdog()`; o `socket.send()` da descoberta já está dentro de `try/catch`; os pedidos pendentes já são apagados no timeout). Essas não entraram na lista.

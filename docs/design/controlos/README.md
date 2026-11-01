# Controlos — wireframes e especificação (Fase 0)

Fonte de verdade para o redesenho da aba Controlos. A implementação segue estes
blocos; o aspeto final vem dos temas da app (não destes desenhos).

- `wireframe-tablet.svg` / `.png` — 1180×740, paisagem, painel ao lado da câmara
- `wireframe-telemovel.svg` / `.png` — 390×844, vertical
- `wireframe-saturn.svg` / `.png` — Saturn 3 Ultra (resina)
- `wireframe-home-confirmacao.svg` / `.png` — diálogo do Home
- `wireframe-estados.svg` / `.png` — o que fica ativo em cada estado

Gerados por `gerar_wireframes_controlos.py` (nesta pasta). Tons de cinzento,
contorno tracejado, números em círculo. Valores como `X 120.4`, `60%`, `0.1 mm`
são **marcadores visuais**; a app mostra `—` quando não sabe.

## O que já existe hoje (verificado no código)

O painel atual é `src/sections/PainelSection.tsx` (1287 linhas). Já envia:

| Ação | Comando | Onde |
|------|---------|------|
| Mover um eixo | `Cmd 401 { Axis, Step }` | `jogCommand()` — `src/utils/commands.ts:546` |
| Home | `Cmd 402 { Axis: 'XYZ' \| 'X' \| 'Y' \| 'Z' }` | `homeCommand()` — `commands.ts:547` |
| Luz | `Cmd 403 { LightStatus: { SecondLight: 0/1 } }` | `lightCommand()` — `commands.ts:390` |
| Velocidade | `Cmd 403 { PrintSpeedPct: 1..500 }` | `printSpeedCommand()` — `commands.ts:407` |
| Ventoinhas | `Cmd 403 { TargetFanSpeed: { ModelFan, AuxiliaryFan, BoxFan } 0..100 }` | `fanCommand()` — `commands.ts:425` |
| Temperaturas | `Cmd 403 { TempTargetNozzle 0..300, TempTargetHotbed 0..110, TempTargetBox 0..60 }` | `temperatureCommand()` — `commands.ts:454` |

Ack: `ackDaResposta(resposta)` devolve `Ack` (`commands.ts:43`). O painel já
trata `Ack 3` como «precisa de Home» (`PainelSection.tsx:247`).

Estado: `printer.status.PrintInfo` (`Status`, `Filename`, `CurrenCoord`,
`PrintSpeedPct`, `CurrentFanSpeed`, `LightStatus`); `ligada` =
`connectionStatus === 'connected'` (`PainelSection.tsx:175`).

Já resolvido hoje: D-pad XY e Z, passo 0.1/1/10/50, Home XYZ/XY/Z com
confirmação, luz, ventoinhas (passos de ±10), velocidade por predefinições
(50/100/150/200) e temperatura (PLA/PETG/ABS). O bloqueio atual é
`ocupada = aImprimir` — durante a pausa o movimento **continua ativo**.

## Blocos — tablet (1180×740)

| # | Bloco | O que mostra | Dados | Componente |
|---|-------|--------------|-------|------------|
| 1 | Cabeçalho | título, chips Centauri/Saturn, estado | `printers` + `status` | `CabecalhoControlos` |
| 2 | Câmara | vídeo 16:9 + ampliar | `htmlDoVideo`, já existe | `CameraMiniatura` |
| 3 | Posição e estado | X/Y/Z e idade do estado | `PrintInfo.CurrenCoord`, `lastUpdate` | `PosicaoAtual` |
| 4 | Aviso de bloqueio | o que está desativado e porquê | `controlosDisponiveis()` | `FaixaBloqueio` |
| 5 | Último comando | ok/erro do último envio | estado local do envio | `ResultadoComando` |
| 6 | Movimento | passo, D-pad 56 px, Z±, Home | `jogCommand`, `homeCommand` | `CartaoMovimento` |
| 7 | Luz | interruptor com estado real | `LightStatus.SecondLight`, `lightCommand` | `CartaoLuz` |
| 8 | Ventoinhas | 3 sliders (modelo/lateral/câmara), enviam ao soltar | `CurrentFanSpeed`, `fanCommand` | `CartaoVentoinhas` |
| 9 | Velocidade | 50/100/150/200 %, valor lido | `PrintInfo.PrintSpeedPct`, `printSpeedCommand` | `CartaoVelocidade` |

## Blocos — telemóvel (390×844)

Ordem: 1 cabeçalho · 2 estado · 3 câmara · 4 passo · 5 D-pad e Home ·
6 luz · scroll → 7 ventoinhas · 8 velocidade · 9 temperaturas (se suportado).

Sem painel lateral: o detalhe do bloqueio aparece como faixa acima do D-pad.

## Blocos — Saturn (resina)

| # | Bloco | O que mostra | Dados | Estado |
|---|-------|--------------|-------|--------|
| 1 | Cabeçalho | Saturn + estado | `printers` | implementar |
| 2 | Estado | Z, idade do estado | `PrintInfo.CurrenCoord` | depende do que a máquina devolver |
| 3 | Eixo Z | Z+, Z−, Home Z | `jogCommand('Z')`, `homeCommand('Z')` | **depende de confirmação na Saturn** |
| 4 | Luz/ecrã | interruptor | `lightCommand` | depende de `LightStatus` na Saturn |
| 5 | Não suportado | lista do que falta e porquê | fixo | — |
| 6 | Aviso | nenhum controlo inicia exposição UV | fixo | — |

## Matriz de capacidades

| Controlo | Centauri Carbon 1 | Saturn 3 Ultra |
|----------|-------------------|----------------|
| Movimento X/Y | suportado (Cmd 401, já usado) | **não verificado** |
| Movimento Z | suportado (Cmd 401) | depende de 401 na Saturn |
| Home XYZ | suportado (Cmd 402) | não verificado |
| Home Z | suportado (Cmd 402 Axis=Z) | depende de 402 na Saturn |
| Home por eixo (X/Y) | comando existe; UI atual faz XY em dois passos | não verificado |
| Luz | suportado (Cmd 403 SecondLight) | depende de `LightStatus` |
| Ventoinhas (modelo/lateral/câmara) | suportado (Cmd 403), 3 vias | não verificado |
| Velocidade | suportado (Cmd 403, 1–500 %) | não verificado |
| Temperatura bico/mesa | suportado (Cmd 403) | não existe (resina) |
| Temperatura câmara | suportado (Cmd 403, 0–60) | não existe |
| Aquecimento em pausa | depende de confirmação no aparelho | — |

## Estados da impressora

| Estado | Movimento/Home | Luz | Ventoinhas | Velocidade | Temperatura |
|--------|----------------|-----|------------|------------|-------------|
| Ociosa | ativo | ativo | ativo | ativo | ativo |
| A preparar | desativado (motivo) | ativo | ativo | ativo | desativado |
| A imprimir | desativado | ativo | ativo | ativo com aviso | desativado |
| Em pausa | desativado (motivo) | ativo | ativo | ativo com aviso | desativado |
| A parar | desativado | ativo | ativo | desativado | desativado |
| Erro | desativado | ativo | ativo | desativado | desativado |
| Sem ligação | desativado | desativado | desativado | desativado | desativado |
| Estado antigo (>45 s) | desativado | desativado | desativado | desativado | desativado |

`em pausa` é **derivado**: o SDCP não tem código de pausa; o painel atual deteta
`CurrentTicks` parado durante 45 s (`PainelSection.tsx:200`).

## Regras de comportamento

- **Um toque = um movimento.** Sem repetição por manter premido.
- Enquanto um comando está à espera de Ack, o bloco de movimento fica
  desativado; o resultado (ok/erro) aparece no bloco 5.
- **Home** pede sempre confirmação: «verifica que a mesa e o bico estão livres».
- **Z− com passo 10 ou 50 mm** pede confirmação; 0.1 e 1 mm não.
- **Posição** só aparece se `CurrenCoord` vier da máquina; caso contrário `—`
  (hoje o painel mostra `0.00`, o que é um valor inventado).
- **Limites de curso** não são conhecidos pela app: não se faz clamp; mostra-se
  aviso de que a máquina os aplica.
- **Rodar o ecrã** mantém o passo escolhido; o passo é guardado por impressora.
- **Fechar a app** não deixa nada a correr: não há serviço em segundo plano.

## Decisões em aberto

1. **Saturn**: confirmar no aparelho se responde a `Cmd 401/402/403`. Sem isso,
   a versão resina fica com estado + parágrafo «não suportado».
2. **Ventoinhas**: quais das três vias existem fisicamente na Centauri Carbon 1.
3. **Velocidade durante impressão**: o `PrintSpeedPct` é aceite a meio? O
   controlo fica ativo com aviso até confirmação.
4. **Home por eixo X/Y**: expor botões separados ou manter «Home XY»?
5. **Temperatura com a máquina em pausa**: bloquear sempre ou permitir após
   confirmação?
6. **Passo guardado**: por impressora ou global? Proposta: por impressora.

## Depende de X (não inventar)

- Limites de curso (X/Y/Z máximos) — não existem na app nem no Cmd 0.
- Estado de pausa real — derivado dos ticks.
- Posição na Saturn — depende do que o estado devolver.
- Ventoinhas/velocidade na Saturn — depende de confirmação no aparelho.
- Tempo de execução de um movimento — não há Ack de fim; só o Ack de aceitação.

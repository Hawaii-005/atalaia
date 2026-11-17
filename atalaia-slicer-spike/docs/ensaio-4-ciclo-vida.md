# Ensaio 4 — sobrevivência do fatiamento em segundo plano (SM-N986B)

Mesmo STL (Gengar 142 376 triângulos), perfil `Elegoo Centauri Carbon 0.4 nozzle - Cosmos AFC`
(`profile_source=system-tree`), PLA, placa do perfil. Saída de 19 093 KB em todos os ensaios.
`nativeGetCompatibleFilaments` = 36, `nativeGetCompatibleProcesses` = 6 em todos.

| Ensaio | apply | process | total (relógio de parede) | PSS pico | VmHWM | pid | resultado |
|---|---|---|---|---|---|---|---|
| A — referência, primeiro plano | 9 187 ms | 5 403 ms | 19,1 s | 574 MB | 726 MB | 5847 | concluído |
| B — HOME durante 60 s | (não registado) | — | 61,6 s | 562 MB | 708 MB | 5847 → 5847 | concluído |
| C — ecrã desligado (Dozing) 60 s | 38 360 ms | 20 070 ms | 62,7 s | 571 MB | 719 MB | 5847 → 5847 | concluído |

## Leitura

- O processo **não morre** em nenhum dos casos: pid igual antes/depois, `success=true`, G-code completo.
- O trabalho **abranda ~3,5×** (14,6 s → 58,4 s de apply+process, medido no log `SliceCore`). O ecrã desligado
  entra em Dozing e o escalonador limita as cores; não é o export, é o motor.
- `lifecycle_events` no JSON mostra `onPause`/`onStop` nos ensaios B e C. **Não mostra `onResume`** porque o
  relatório é escrito no fim do fatiamento, antes de a app voltar ao primeiro plano; a ausência não significa
  que a app não retomou (verificado com `am start` e dump de UI).
- Minimizar e desligar o ecrã não são distinguíveis em tempo: os dois ~62 s.

## Limites

- Um aparelho (SM-N986B, Android 13). S25 Ultra e Tab S10 Lite por medir.
- Sem referência de OrcaSlicer: não se afirma imprimível; `max_z_height` continua 77,00 e há 0 miniaturas.

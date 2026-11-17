# Ensaio 5 — mesmo cubo, OrcaSlicer vs Android

Modelo: cubo 25,6 mm em (128,128), gerado como STL binário de 12 triângulos (o `Cubo.stl` do Bruno ainda não
foi usado; a geometria é a mesma do G-code de referência: polígono 115,2→140,8).

Perfis forçados por intent: `Generic PLA @Elegoo Centauri`, `0.20mm Standard @Elegoo CC 0.4 nozzle`,
`curr_bed_type = Textured PEI Plate`.

## Resultado

| | OrcaSlicer 2.5.1 | Android (ElegooSlicer 1.5.3) |
|---|---|---|
| camadas | 128 | 128 |
| `max_z_height` | 25.60 | 25.60 |
| extrusão total (ΣE) | 2149.57 mm | 2149.57 mm |
| linhas executáveis | 8668 | 8669 |
| `PRINT_START` | `EXTRUDER=210 BED=60 CHAMBER=0 TOOL=0` | igual |
| `M106 P3 S200` | 1 | 1 |
| `T0` | 1 | 0 |
| miniaturas | 144x144 | 0 |

Diff das secções executáveis (sem `M73`, arredondado a 2 casas): **931 linhas de 8668 (10,7%)**, todas dentro
de blocos do mesmo tipo — 14 linhas trocam entre `Internal solid infill` e `Sparse infill`, e as coordenadas
de início de linha de preenchimento diferem alguns décimos. O volume extrudido é idêntico ao centésimo, logo
não há diferença de geometria; há diferença de ordenação/ancoragem do preenchimento.

## Correções aplicadas depois do ensaio

- `HEADER_BLOCK_END` duplicado: o motor escreve dois; a app remove o segundo em fluxo (`corrigirCabecalho`).
  Verificado no aparelho: 1 ocorrência, `; filament: 1` preservado.
- APK: execução CI 44029810386, sha256 `7b56b09d0c6c967dbb7c8455d5ab866972191204e0a7dce06f5466f4fa02d916`.

## Ensaio de doze com o APK novo (E)

`battery unplug` + `deviceidle force-idle` (`mState=IDLE`), HOME + ecrã desligado 80 s, perfil 0.20 mm:
`apply=24 917 ms`, `process=12 223 ms`, total 39,6 s, pid 2162 igual antes e depois, `onResume` presente no
JSON e `bed_type_override = Textured PEI Plate`. Não comparável com os 61,7 s anteriores (eram 0.12 mm).

## Linha de base do cubo em primeiro plano (0.20 mm)

| Condição | apply | process | total slice_call | PSS | VmHWM |
|---|---|---|---|---|---|
| App já aberta, 2.º fatiamento | 77 ms | 289 ms | 0,37 s | — | — |
| App reaberta (mesmo processo) | 92 ms | 299 ms | 0,39 s | — | — |
| **Processo novo, motor a frio** | 480 ms* | — | **0,68 s** | 168 MB | 280 MB |

*apply do processo frio inclui carregar perfis; o slice_call inteiro é < 1 s.

Leitura: o "apply ~9 s" do Gengar **não é** custo fixo de perfis — o cubo a frio custa 0,68 s total. É
proporcional ao modelo (Gengar: 142k triângulos, 641 camadas). A sugestão de manter o motor carregado poupa
pouco; o ganho possível é em cache da malha do modelo entre fatiamentos, não em manter o motor vivo.

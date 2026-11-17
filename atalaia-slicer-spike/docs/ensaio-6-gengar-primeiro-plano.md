# Ensaio F — Gengar a 0.20 mm em primeiro plano

**Objetivo:** quantificar o efeito de ter a app em primeiro plano com os mesmos parâmetros do ensaio E
(Gengar a 0.20 mm em doze forçado: `apply=24 917 ms`, `process=12 223 ms`, total 39,6 s).

## Condições

| Parâmetro | Valor |
|---|---|
| Aparelho | Samsung SM-N986B (Note 20 Ultra), Android 13, arm64-v8a |
| App | `io.github.hawaii005.slicerspike` (execução CI 44122714575, sha256 `65d5aacff0969f00b83f8c26d90e727478c18812e9fdd6c54cd9e6e351f4efc1`) |
| Modelo | `Gengar(blender-repaired).stl` — 142 376 triângulos, 100,96 × 52,61 × 78,02 mm |
| Impressora | `Elegoo Centauri Carbon 0.4 nozzle - Cosmos AFC` (encontrada no motor, `profile_source=system-tree`) |
| Filamento | `Elegoo PLA @ECC` |
| Processo | `0.20mm Standard @Elegoo CC 0.4 nozzle` (forçado por intent) |
| Ecrã | Ligado, app visível do início ao fim, sem toques durante o fatiamento |

## Resultados

| Condição | apply | process | apply+process | slice_call (app) | ficheiro estabiliza | PSS | VmHWM | G-code |
|---|---|---|---|---|---|---|---|---|
| 0.20 mm em doze (ensaio E) | 24 917 ms | 12 223 ms | 37,1 s | — | — | — | — | 385 camadas |
| **0.20 mm em primeiro plano** | **6 055 ms** | **2 941 ms** | **9,0 s** | 2,18 s | 11,5 s | 402 MB | 551 MB | 9,8 MB, 385 camadas |
| 0.20 mm em primeiro plano (repetição) | 6 001 ms | 3 034 ms | 9,0 s | 2,14 s | 11,5 s | 399 MB | 553 MB | 9,8 MB |
| 0.12 mm em primeiro plano (controlo) | 9 206 ms | 4 906 ms | 14,1 s | 2,15 s | 16,5 s | 546 MB | 688 MB | 18,6 MB |

Rácio doze/primeiro plano a 0.20 mm: **4,1×** em `apply+process` (37,1 s → 9,0 s), com duas medições
independentes a concordarem em 9,0 s. A 0.12 mm o primeiro plano é mais rápido do que o doze medido
(14,1 s), mas mais lento do que 0.20 mm porque tem cerca de 641 camadas (77 mm a 0,12 mm) contra 385.

## O que foi verificado no G-code produzido

Ficheiro `saida_Gengar_blender-repaired_cosmos_afc_20261117-161246.gcode` (10 312 583 bytes):

```
; total layer number: 385     → 77,00 mm / 0,20 mm
; max_z_height: 77.00
HEADER_BLOCK_END             → 1 ocorrência (a duplicação do motor continua corrigida)
PRINT_START EXTRUDER=210 BED=35 CHAMBER=0 TOOL=0
```

`BED=35` não vem do filamento: o bloco de configuração desse G-code diz `curr_bed_type = Cool Plate`, com
`cool_plate_temp = 35`, `cool_plate_temp_initial_layer = 35`, `textured_plate_temp = 60` e
`hot_plate_temp = 60`. O motor assume "Cool Plate" quando ninguém escolhe placa, e o perfil do filamento
tem os 60 °C para a Textured PEI. Esse fatiamento correu sem override de placa; o ensaio E (doze) tinha-o.
Verificação do override: o cubo fatiado com `--es bed 'Textured PEI Plate'` sai com
`curr_bed_type = Textured PEI Plate`, `first_layer_bed_temperature = 60` e `PRINT_START … BED=60`.
A app passou a enviar `curr_bed_type` sempre, com seleção no ecrã (omissão: Textured PEI Plate).

## Repetição com os seletores (omissões da app)

Já com os seletores no ecrã e as omissões `Generic PLA @Elegoo Centauri` + `0.20mm Standard` +
`Textured PEI Plate` (APK `31983c99…`): `apply=5 526 ms`, `process=2 982 ms` (8,5 s), PSS 400 MB,
VmHWM 556 MB. O G-code sai com `curr_bed_type = Textured PEI Plate`, `first_layer_bed_temperature = 60` e
`PRINT_START … BED=60`, mantendo 385 camadas. A duração da app passou a descontar o tempo de escolha
(`config_wait_ms` no JSON).

## Nota sobre as métricas

- `apply`, `process` e `export` vêm do motor (`SliceCore: Slice timing`), não da app.
- O motor reporta `export=0 ms`; o tempo que a app mostra como "ficheiro estabiliza" é a espera até o
  ficheiro parar de crescer depois de `nativeSlice` devolver (inclui o resto do processamento e uma
  amostragem de 500 ms), **não** é o export do motor.
- A app passou a mostrar o nome e o tamanho do G-code no ecrã e a incluir `gcode_file_name` no JSON.

## Consequência para o desenho

Manter a app em primeiro plano vale 4,1× no motor, mas o número que decide a experiencia é o do doze:
a 0.12 mm o ciclo completo medido pela app em doze foi 61,7 s, contra 19,1 s em primeiro plano na mesma
condição anterior. O utilizador pode sair da app, mas paga esse fator; não se pode prometer em segundo
plano a latência do primeiro plano.

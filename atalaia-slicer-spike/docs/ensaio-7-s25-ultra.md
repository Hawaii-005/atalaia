# Ensaio 7 — Cubo no Galaxy S25 Ultra

**Objetivo:** repetir o ensaio do cubo (ensaio 5) no S25 Ultra, segundo aparelho do gate da Fase 1.

## Condições

| Parâmetro | Valor |
|---|---|
| Aparelho | Samsung SM-S938B (S25 Ultra), Android 17 (API 37), arm64-v8a |
| App | `io.github.hawaii005.slicerspike`, APK do CI 44127905552, sha256 `31983c99ae9c91b2ae4f4046a4092e99411e582db34e9a47f73c1d4d1776c8d6` |
| Modelo | `Cubo.stl`, 684 bytes, 12 triângulos |
| Impressora | `Elegoo Centauri Carbon 0.4 nozzle - Cosmos AFC` |
| Ecrã | Ligado, app visível, sem toques durante o fatiamento |

## Resultados (relatório `benchmark_SM-S938B_1795032953822.json`)

| Métrica | Valor |
|---|---|
| `duration_ms` (chamada de fatiamento) | **376 ms** |
| `duration_post_return_ms` | 2 503 ms |
| `duration_including_export_ms` | 2 879 ms |
| `config_wait_ms` | 69 728 ms (espera pela escolha do utilizador; excluída do tempo de fatiamento) |
| Pico PSS | 211 MB |
| VmHWM | 240 MB |
| `native_error_code` | ausente (sem erro) |

Comparação com o Note 20 Ultra (ensaio 5): `apply+process` 0,68–0,80 s vs 0,38 s aqui; PSS 156 MB vs 211 MB.

## G-code produzido (`saida_Cubo_cosmos_afc_20261118-201551.gcode`)

- 97 331 bytes; `total layer number: 50`; `max_z_height: 10.00`
- `PRINT_START EXTRUDER=210 BED=60 CHAMBER=0 TOOL=0` (override de placa aplicado; sem ele cairia em `BED=35`)
- 1× `HEADER_BLOCK_END`; 0 trocas `T\d`

## Observações

1. **Aviso de página de 16 KB:** ao instalar no S25 (Android 17) o sistema mostra «app não compatível com 16 KB» — `lib/arm64-v8a/libslice_core.so: biblioteca não comprimida não alinhada`. A app arranca e fatia, mas o binário tem de ser compilado com alinhamento de 16 KB (`-Wl,-z,max_page_size=16384`, NDK r27+) antes de qualquer distribuição séria.
2. **Dimensões do STL no relatório:** o JSON indica `model_dimensions_mm` 11 × 11 × 11 para um cubo de 20 × 20 × 10 mm. A leitura de dimensões de STL binário na app de spike não é fiável; não usar este campo como verificação de volume útil.

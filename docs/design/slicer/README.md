# Fatiador Integrado no Atalaia (libslic3r + Klipper / Cosmos AFC)

## 1. Visão Geral
O Atalaia passa a suportar fatiamento local direto no dispositivo Android através do motor nativo `libslic3r` (`libslice_core.so`), eliminando a necessidade de ligar o PC ou OrcaSlicer para impressões do dia-a-dia a partir de ficheiros `.stl` ou `.3mf`.

O G-code gerado é configurado especificamente para o firmware **COSMOS (Klipper/Moonraker)** e módulo multi-material **AFC (Canvas)** da Elegoo Centauri Carbon.

---

## 2. Matriz de Capacidades do Fatiador

| Capacidade | Modo Cosmos AFC | Modo Cosmos Mono | Modo Stock (SDCP) |
|---|---|---|---|
| **Formato de Entrada** | `.stl`, `.3mf` | `.stl`, `.3mf` | `.stl`, `.3mf` |
| **G-code Flavor** | `klipper` | `klipper` | `marlin` / `elegoo` |
| **Start G-code** | Macro `PRINT_START` com parâmetros (Extruder, Bed, Chamber, Tool) | Macro `PRINT_START` padrão | G-code stock com tags M8488 |
| **End G-code** | Macro `PRINT_END` | Macro `PRINT_END` | G-code stock |
| **Multi-material / Cores** | Sim (T0..T3 para Canvas 4 vias) | Não (Apenas T0) | Limitado a trocas SDCP |
| **Purga e Transição** | Rotina `SET_MAP` + `T[n] PURGE_LENGTH=[...]` | N/A | SDCP tool change |
| **Destino de Envio** | Moonraker HTTP `POST /server/files/upload` | Moonraker HTTP `POST /server/files/upload` | SDCP TCP `:3030/uploadFile/upload` |
| **Início Imediato** | JSON-RPC `printer.print.start` | JSON-RPC `printer.print.start` | SDCP `Cmd 128` |

---

## 3. Fluxo de Interação do Utilizador (UX)
1. **Seleção do Modelo:**
   - Botão flutuante ou cartão no ecrã de Ficheiros: "Fatiar Modelo 3D".
   - Seleção de `.stl` / `.3mf` através do Seletor de Ficheiros do sistema (`expo-document-picker`).
2. **Configuração Rápida:**
   - **Perfil de Máquina:**
     - *Elegoo Centauri Carbon 0.4 nozzle - Cosmos AFC* (Predefinição)
     - *Elegoo Centauri Carbon 0.4 nozzle - Cosmos*
     - *Elegoo Centauri Carbon 0.4 nozzle - opencentauri*
   - **Material e Ranhura AFC:**
     - Escolha da cor/pista Canvas (`T0` a `T3`) e tipo (PLA, PETG, ABS).
   - **Parâmetros de Impressão:**
     - Altura de Camada: `0.12 Fina`, `0.20 Standard` (recomendada), `0.28 Rápida`.
     - Preenchimento (Infill): `10%`, `15% Grid`, `20% Gyroid`, `40%`.
     - Suportes: `Desligado`, `Árvore (Tree)`, `Normal`.
     - Aba / Bordadura (Brim): `Auto`, `Ligado`, `Desligado`.
3. **Ação:**
   - Botão primário: **"Fatiar e Imprimir"** (progresso em barra percentual no ecrã).
   - Botão secundário: **"Apenas Fatiar"** (guarda o G-code localmente).
4. **Conclusão:**
   - Transição suave para o ecrã de impressão com telemetria ativa e câmara em direto.

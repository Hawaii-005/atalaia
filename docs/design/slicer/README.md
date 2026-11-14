# Fatiador Integrado no Atalaia (libslic3r + Klipper / Cosmos AFC)

Documento de arquitetura, fluxos, acessibilidade e matriz de estados para o módulo de fatiamento local no Atalaia (`Hawaii-005/atalaia`).

---

## 1. Lista Numerada dos Blocos de Interface (Wireframes Low-Fi)

Conforme ilustrado em `wireframe-phone-390x844.svg` (6 estados de ecrã) e `wireframe-tablet-1180x740.svg`:

### [E1] Ecrã de Configuração / Seleção
1. **[1] Modelo Selecionado:** Cartão com nome do ficheiro STL/3MF, tamanho em disco, dimensões cúbicas calculadas e chevron indicando que é tocável para trocar de ficheiro via `expo-document-picker`.
2. **[2] Seletor de Perfil de Máquina:**
   - **Cosmos AFC (0.4 nozzle) [Recomendado]:** Klipper + Moonraker com suporte ao módulo Canvas multi-cor (pistas T0..T3). Start G-code passa parâmetros para a macro `PRINT_START`.
   - **Cosmos Mono (0.4 nozzle):** Klipper sem suporte multi-cor (apenas T0).
   - **OpenCentauri (0.4 nozzle):** Klipper variante comunitária OpenCentauri.
3. **[3] Seletor de Ranhura Canvas AFC:**
   - **Condição de ativação:** *Depende de:* Perfil Cosmos AFC ativo. Se selecionado Cosmos Mono ou OpenCentauri, o seletor fica desativado/oculto com nota explicativa.
   - **Opções:** Ranhuras `T0`, `T1`, `T2`, `T3` com cor e legenda coerentes (ex.: T0 Preto/PLA, T1 Branco/PLA, T2 Azul/PETG, T3 Laranja/ABS) e opção de escolha manual de filamento.
4. **[4] Parâmetros Básicos de Impressão (Touch targets >= 48px):**
   - Altura de camada segmentada: `0.12 Fina`, `0.20 Standard` (recomendado), `0.28 Rápida`.
   - Preenchimento (Infill): Cartão tocável com chevron (padrão `15% Gyroid`).
   - Suportes: Cartão tocável com chevron (`Árvore / Tree`, `Normal`, `Desligado`).
5. **[5] Estimativa Pré-Fatiamento:**
   - Mostra estritamente `Tempo: —` e `Filamento: —` antes do fatiamento.
   - Nota explícita: "Valores exatos gerados no ecrã de resultado após processamento".
6. **[6] Ação Primária:** Botão **"FATIAR"** com altura mínima de 48px. Não existe botão "Fatiar e Imprimir" nesta etapa.

### [E2] Ecrã de Fatiamento em Curso
7. **[7] Progresso do Motor Nativo (libslic3r):**
   - Percentagem numérica em destaque (ex.: `58%`).
   - Barra de progresso visual de contraste AA.
   - Subtítulo indicando a etapa atual do libslic3r (ex.: *Passo 4 de 7: Gerar infill Gyroid*).
   - Contador de tempo decorrido (`00:08`).
8. **[8] Botão Cancelar:** Área de toque de 48px que despacha `nativeCancel()` para abortar com segurança a thread C++ em segundo plano sem vazar memória.

### [E3] Ecrã de Falha no Fatiamento
9. **[9] Painel de Erro e Diagnóstico:**
   - Ícone e motivo amigável (ex.: *Geometria não-manifold detetada*).
   - Caixa com o log técnico retornado pelo `libslic3r` (`Model::repair() failed`, código de saída, facetas defeituosas).
10. **[10] Ações de Recuperação:**
    - Botão primário: **"Tentar com Auto-Reparação"** (injeta flag de reparação de malha).
    - Botão secundário: **"Escolher Outro Modelo"** (abre seletor de ficheiros).

### [E4] Ecrã de Resultado do Fatiamento
11. **[11] Vista 2D de Camadas:**
    - Pré-visualização da trajetória de ferramentas da camada ativa.
    - Slider tocável (altura >= 48px) para inspecionar camada a camada (`Camada N de Total`).
12. **[12] Dados Reais do G-code Gerado:**
    - Tempo exato calculado a partir dos movimentos (ex.: `1h 48m`).
    - Quantidade real de filamento e metros (ex.: `42.6 g • 13.8 m`).
    - Contagem final de camadas (ex.: `340 camadas`).
    - Aviso de validação de compatibilidade Klipper.
13. **[13] Destino do G-code (Ações Principais):**
    - **Enviar e Arrancar:** Despacha upload e abre confirmação de mesa limpa.
    - **Enviar e Pôr na Fila Local:** Envia via HTTP e regista na fila local do Atalaia.
    - **Apenas Enviar para Cosmos (Upload):** `POST /server/files/upload` sem arrancar.
    - **Guardar Ficheiro G-code Local:** Grava o ficheiro no telemóvel (`.gcode`).
14. **[14] Modal de Confirmação de Mesa Limpa:**
    - Pergunta obrigatória de segurança: *"A superfície da mesa está 100% desobstruída e pronta para iniciar a impressão?"*
    - Botões: `Cancelar` ou `Sim, Arrancar`.

### [E5] Ecrã de Envio (Upload Moonraker)
15. **[15] Progresso do Upload HTTP Multipart:**
    - Percentagem (ex.: `74%`), bytes enviados e velocidade em MB/s.
    - Botão para cancelar o envio HTTP.
16. **[16] Tratamento de Falha de Rede:**
    - Em caso de timeout ou falha na LAN, o ficheiro G-code local não é eliminado.
    - Opções: *Tentar Enviar Novamente* ou *Colocar na Fila Offline*.

### [E6] Ecrã de Ficheiro Guardado
17. **[17] Confirmação de Gravação Local:**
    - Nome do ficheiro, tamanho e caminho em `Documentos/Atalaia/Gcodes/`.
18. **[18] Ações Finais:**
    - *Partilhar Ficheiro* (via intent nativa do Android), *Ver na Lista de Ficheiros* ou *Voltar ao Início*.

---

## 2. Tabela de Estados da Interface

| Estado Lógico | Ecrã Ativo | Entradas Possíveis | Ação Desencadeada | Próximo Estado |
|---|---|---|---|---|
| `CONFIG_IDLE` | `[E1]` | Tocar em Modelo | Abre `DocumentPicker` | `CONFIG_IDLE` (atualizado) |
| `CONFIG_IDLE` | `[E1]` | Mudar Perfil | Altera perfil ativo; se != AFC, desativa ranhuras Canvas | `CONFIG_IDLE` |
| `CONFIG_IDLE` | `[E1]` | Mudar Ranhura Canvas | Define ranhura (`T0..T3`) e cor/material | `CONFIG_IDLE` |
| `CONFIG_IDLE` | `[E1]` | Tocar em "Fatiar" | Valida ficheiro, inicializa JNI e inicia thread de fatiamento | `SLICING_ACTIVE` |
| `SLICING_ACTIVE` | `[E2]` | Progresso JNI (0-100%) | Atualiza barra e etapa atual | `SLICING_ACTIVE` |
| `SLICING_ACTIVE` | `[E2]` | Tocar em "Cancelar" | Chama `nativeCancel()`, limpa cache temporária | `CONFIG_IDLE` |
| `SLICING_ACTIVE` | `[E2]` | JNI Erro / Falha | Lê mensagem de erro do motor C++ | `SLICING_ERROR` |
| `SLICING_ACTIVE` | `[E2]` | JNI Sucesso | Extrai metadados do G-code, gera preview 2D | `SLICING_RESULT` |
| `SLICING_ERROR` | `[E3]` | Auto-reparar | Reinicia com flag `--repair` ativa | `SLICING_ACTIVE` |
| `SLICING_ERROR` | `[E3]` | Escolher Outro | Abre seletor de ficheiros | `CONFIG_IDLE` |
| `SLICING_RESULT` | `[E4]` | Arrastar Camadas | Renderiza visualização 2D da camada selecionada | `SLICING_RESULT` |
| `SLICING_RESULT` | `[E4]` | "Enviar e Arrancar" | Abre modal de confirmação de mesa limpa | `CONFIRM_BED_CLEAN` |
| `CONFIRM_BED_CLEAN` | `[E4]` | "Sim, Arrancar" | Despacha upload multipart Moonraker com flag de arranque | `UPLOADING` |
| `SLICING_RESULT` | `[E4]` | "Pôr na Fila Local" | Adiciona à fila local e envia para a máquina | `UPLOADING` (ou Fila) |
| `SLICING_RESULT` | `[E4]` | "Guardar G-code Local" | Copia do cache temporário para pasta pública de Documentos | `SAVED_LOCAL` |
| `UPLOADING` | `[E5]` | Progresso HTTP | Atualiza percentagem de upload multipart | `UPLOADING` |
| `UPLOADING` | `[E5]` | Sucesso Upload | Se veio de arranque imediato: despacha `printer.print.start` | Ecrã de Impressão (`CameraScreen`) |
| `UPLOADING` | `[E5]` | Falha de Rede | Mostra cartão de retry e guarda na fila offline | `UPLOAD_ERROR` |
| `SAVED_LOCAL` | `[E6]` | "Partilhar" | Abre seletor de partilha Android (`ACTION_SEND`) | `SAVED_LOCAL` |

---

## 3. Matriz de Perfis e Diferenças Técnicas

| Parâmetro Técnico | Cosmos AFC (Recomendado) | Cosmos Mono | OpenCentauri |
|---|---|---|---|
| **Ficheiro de Perfil** | `Elegoo Centauri Carbon 0.4 nozzle - Cosmos AFC.json` | `Elegoo Centauri Carbon 0.4 nozzle - Cosmos.json` | `Elegoo Centauri Carbon 0.4 nozzle - opencentauri.json` |
| **G-code Flavor** | `klipper` | `klipper` | `klipper` |
| **Start G-code** | Macro `PRINT_START` com parâmetros explícitos (`EXTRUDER`, `BED`, `CHAMBER`, `TOOL`) | Macro `PRINT_START` genérica (sem atribuição dinâmica de ferramenta) | Macro de arranque OpenCentauri padrão |
| **End G-code** | `PRINT_END` | `PRINT_END` | `PRINT_END` |
| **Suporte AFC Canvas** | **Ativo (T0..T3)** com purga calibrada | **Desativado** (forçado em T0) | **Desativado** |
| **Troca de Ferramenta** | `T[next_extruder] PURGE_LENGTH=[flush_length]` | Desativado | Desativado |

---

## 4. Política de Multi-Cor e Ficheiros 3MF

- **Escopo na v1:** O fatiador v1 foca-se na atribuição de **uma ranhura ativa do módulo Canvas (`T0`, `T1`, `T2` ou `T3`)** para modelos STL mono-cor.
- **Se o utilizador carregar um 3MF com múltiplas cores:**
  - O ecrã apresentará um aviso explícito: *"Modelo com múltiplas cores detetado. Na versão v1, o modelo será fatiado usando a ranhura principal selecionada. O mapeamento avançado cor-a-ranhura está planeado para a v2."*
  - O fatiamento decorre de forma segura sem crash do motor nativo.

---

## 5. Requisitos de Acessibilidade (WCAG AA)

- **Contraste de Cores:**
  - Textos principais e títulos: `#212529` sobre `#ffffff` ou `#f8f9fa` (rácio > 12:1).
  - Textos secundários e legendas: `#495057` e `#6c757d` (mínimo garantido de 4.8:1 contra fundos claros).
  - Textos brancos sobre botões escuros: `#ffffff` sobre `#212529` (rácio > 16:1).
- **Tipografia:**
  - Nenhuma legenda ou texto no ecrã tem tamanho inferior a **12 px**.
- **Áreas de Toque (Touch Targets):**
  - Todos os botões, opções de perfil, ranhuras Canvas, cartões de infill e sliders têm altura mínima de **48 px**.
- **Indicadores de Interatividade:**
  - Cartões tocáveis incorporam bordas nítidas, contrastes de seleção bem definidos e ícones de chevron (`>`) indicando expansão ou toque.

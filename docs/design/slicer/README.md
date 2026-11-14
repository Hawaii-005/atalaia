# Fatiador Integrado no Atalaia (libslic3r + Klipper / Cosmos AFC)

Documento de arquitetura, fluxos, acessibilidade, matriz de capacidades e especificação de estados para o módulo de fatiamento local no Atalaia (`Hawaii-005/atalaia`).

---

## 1. Ficheiros de Wireframes Low-Fi (Exportados por Ecrã)

Todos os wireframes seguem a convenção low-fi estrutural do repositório (tons de cinzento, blocos numerados, tipografia mínima de 12 px, áreas de toque >= 48 px e contraste WCAG AA):

- `wireframe-tablet-1180x740.svg`: Vista master-detail do tablet (1180×740) com visualizador 3D do volume de construção e painel lateral de fatiamento.
- `wireframe-phone-01-config.svg`: `[E1]` Configurar fatiamento (STL, perfil, ranhura Canvas, parâmetros, estimativa pré-fatiamento e botão Fatiar).
- `wireframe-phone-02-viewer.svg`: `[E1B]` Visualizador 3D do modelo e volume de construção da mesa (256×256×260 mm) com estados `Cabe`, `Excede` ou `Desconhecido`.
- `wireframe-phone-03-slicing.svg`: `[E2]` Fatiamento em curso (percentagem, barra, tempo decorrido, botão cancelar com limpeza e aviso de app em primeiro plano).
- `wireframe-phone-04-error.svg`: `[E3]` Falha no fatiamento (diagnóstico, catálogo de erros tratados e ações de recuperação).
- `wireframe-phone-05-result.svg`: `[E4]` Resultado do fatiamento (pré-visualização 2D de camadas, métricas reais, aviso de perfil novo não verificado, ações de envio/guarda e modal de arranque com bloqueios da Fila).
- `wireframe-phone-06-upload.svg`: `[E5]` Upload para o Moonraker (progresso HTTP multipart, cancelamento com limpeza e tratamento de impressora ocupada, autenticação falhada ou espaço insuficiente).
- `wireframe-phone-07-saved.svg`: `[E6]` Ficheiro guardado localmente (mecanismos de armazenamento Android: pasta da app com partilha nativa vs. pasta escolhida via SAF).

---

## 2. Lista Numerada dos Blocos de Interface

### [E1] Ecrã de Configuração / Seleção (`wireframe-phone-01-config.svg`)
1. **[1] Modelo Selecionado:** Cartão tocável com nome do ficheiro STL/3MF, tamanho em disco, dimensões cúbicas e chevron indicando abertura do seletor de documentos.
2. **[2] Seletor de Perfil de Máquina (Áreas >= 48 px):**
   - **Cosmos AFC (0.4 nozzle) [Recomendado]:** Klipper + Moonraker com macro `PRINT_START` parametrizada e suporte ao módulo Canvas multi-cor (pistas T0..T3).
   - **Cosmos Mono (0.4 nozzle):** Klipper convencional mono-extrusão (forçado a T0).
   - **OpenCentauri (0.4 nozzle):** Klipper variante comunitária.
3. **[3] Seletor de Ranhura Canvas AFC:**
   - **Depende de:** Perfil Cosmos AFC ativo. Se selecionado Cosmos Mono ou OpenCentauri, o seletor fica desativado/oculto.
   - **Origem dos dados:** Consulta ao estado do Canvas AFC via Moonraker/Klipper (`printer.canvas` ou macro de status) ou seleção manual direta pelo utilizador (`T0..T3`).
   - **Opções:** Ranhuras com cor e legenda coerentes (ex.: `T0: Preto / PLA`, `T1: Branco / PLA`, `T2: Azul / PETG`, `T3: Laranja / ABS`).
4. **[4] Parâmetros Básicos de Impressão (Touch targets >= 48 px):**
   - Altura de camada segmentada: `0.12 Fina`, `0.20 Standard` (recomendado), `0.28 Rápida`.
   - Preenchimento (Infill): Cartão tocável com chevron (`15% Gyroid`).
   - Suportes: Cartão tocável com chevron (`Árvore / Tree`, `Normal`, `Desligado`).
5. **[5] Estimativa Pré-Fatiamento:**
   - Mostra estritamente `Tempo: —` e `Filamento: —` antes do fatiamento.
6. **[6] Ações Principais:**
   - Botão **"VISUALIZAR MODELO 3D (VOLUME)"**: Transita para `[E1B]`.
   - Botão **"FATIAR"**: Valida restrições e inicia o motor nativo. Não existe botão "Fatiar e Imprimir" direto.

### [E1B] Visor 3D e Volume de Construção (`wireframe-phone-02-viewer.svg`)
7. **[V1] Viewport 3D:** Representação da mesa 256×256 mm e volume útil Z=260 mm da Elegoo Centauri Carbon com a malha do modelo orientada no centro.
8. **[V2] Estado de Conformidade de Volume:**
   - **Cabe:** Dimensões dentro do limite útil (256×256×260 mm); autoriza fatiamento.
   - **Excede:** Dimensões ultrapassam o volume útil; bloqueia fatiamento e sugere rotação ou escala.
   - **Desconhecido:** Ficheiro STL com cabeçalho truncado ou dimensões não calculáveis antes do parsing total.

### [E2] Ecrã de Fatiamento em Curso (`wireframe-phone-03-slicing.svg`)
9. **[7] Progresso do Motor Nativo (libslic3r):**
   - **Depende de:** Callbacks da thread NDK C++ (`libslic3r`).
   - Mostra percentagem numérica (`58%`), barra de progresso AA, etapa atual do fatiamento (ex.: *Passo 4 de 7: Gerar infill Gyroid*) e tempo decorrido.
10. **[8] Botão Cancelar (>= 48 px):** Aborta a execução do fatiador (`nativeCancel()`) e limpa imediatamente ficheiros temporários `.tmp` em disco.
11. **Aviso de Primeiro Plano:** Alerta o utilizador para manter a aplicação aberta, pois o Android pode suspender a thread nativa C++ em background.

### [E3] Ecrã de Falha no Fatiamento (`wireframe-phone-04-error.svg`)
12. **[9] Painel de Erro e Diagnóstico:**
    - Mensagem amigável de erro (ex.: *Geometria não-manifold detetada*).
    - Caixa com exemplo ilustrativo de log do `libslic3r` (**Depende de:** suporte a exportação de logs detalhados pelo wrapper NDK; hoje retorna código de saída numérico).
    - Tratamento de erros adicionais: memória esgotada (OOM), modelo fora do volume, ficheiro truncado ou espaço insuficiente em disco.
13. **[10] Ações de Recuperação:**
    - Botão **"Tentar com Auto-Reparação"** (**Depende de:** flag `--repair` suportada pelo motor na versão compilada).
    - Botões para escolher outro modelo ou voltar ao início.

### [E4] Ecrã de Resultado do Fatiamento (`wireframe-phone-05-result.svg`)
14. **[11] Vista 2D de Camadas:** Visualização da trajetória de ferramentas e slider com touch target >= 48 px para inspecionar camadas individuais.
15. **[12] Dados Reais do G-code Gerado:**
    - Tempo real calculado (ex.: `1h 48m`), filamento real (ex.: `42.6 g • 13.8 m`) e camadas totais (`340`).
    - **Aviso de Perfil Novo:** *"Gerado com o perfil Cosmos AFC (não verificado na impressora). Primeira impressão com perfil novo: vigia as primeiras camadas e valida o nivelamento da mesa."*
16. **[13] Destino do G-code (Ações Principais):**
    - **Enviar e Arrancar:** Abre o modal de arranque com bloqueios da Fila.
    - **Enviar e Pôr na Fila Local:** Envia e regista na fila local.
    - **Apenas Enviar para Cosmos (Upload):** Upload HTTP sem arrancar.
    - **Guardar Ficheiro G-code Local:** Salva o ficheiro no armazenamento do telemóvel.
17. **[14] Modal de Arranque Imediato (Bloqueios da Fila + Mesa Limpa):**
    - Mostra os dados do que vai arrancar: Nome do ficheiro, Perfil, Ranhura Canvas ativa e Duração estimada.
    - Valida os bloqueios padrão da Fila: impressora ociosa, ligação atual ativa, ranhura compatível e filamento suficiente.
    - Exige confirmação explícita: *"A mesa de impressão está 100% limpa?"*.

### [E5] Ecrã de Upload Moonraker (`wireframe-phone-06-upload.svg`)
18. **[15] Progresso do Envio HTTP Multipart:**
    - **Depende de:** Comunicação direta com a porta 80 do Moonraker no COSMOS (ex.: `http://192.168.1.5:80/server/files/upload`).
    - Barra de progresso, velocidade de transferência e botão de cancelamento (com limpeza do ficheiro parcial no Moonraker).
    - Estado de envio concluído com sucesso e redirecionamento.
19. **[16] Erros e Bloqueios Tratados no Upload:**
    - **Impressora Ocupada:** Bloqueia arranque imediato; oferece opção de pôr na fila.
    - **Autenticação Falhada (401/403):** Token da API rejeitado.
    - **Espaço Insuficiente:** Disco eMMC da impressora sem espaço.

### [E6] Ecrã de Ficheiro Guardado (`wireframe-phone-07-saved.svg`)
20. **[17] Confirmação Local e Mecanismo de Armazenamento Android:**
    - **Opção A (Padrão):** Pasta interna da aplicação (`context.getExternalFilesDir("gcodes")`) com botão de partilha nativa (`ACTION_SEND`).
    - **Opção B:** Pasta escolhida pelo utilizador via Android Storage Access Framework (SAF / `DocumentFile`).
21. **[18] Ações Finais:** Partilhar ficheiro, guardar via SAF, ver na lista local do Atalaia ou voltar ao início.

---

## 3. Comportamento no Tablet (`wireframe-tablet-1180x740.svg`)

- **Reutilização de Estados:** O tablet reutiliza **100% da máquina de estados do telemóvel** (`[E1B]` a `[E6]`).
- **Layout Master-Detail:** No tablet, o visor 3D do volume de construção (`[T1]`) fica permanentemente visível no painel esquerdo, enquanto a configuração e perfis (`[T2]` a `[T6]`) ocupam o painel direito.
- **Modais e Ecrãs Secundários:** O fatiamento em curso, falhas, modais de confirmação de mesa limpa e bloqueios da fila surgem em caixas modais sobrepostas centradas (largura 500 px), garantindo paridade total entre telemóvel e tablet sem duplicar lógica de negócio.

---

## 4. Tabela de Estados da Interface

| Estado Lógico | Ecrã Ativo | Entradas Possíveis | Ação Desencadeada | Próximo Estado |
|---|---|---|---|---|
| `CONFIG_IDLE` | `[E1]` | Tocar em Modelo | Abre `DocumentPicker` | `CONFIG_IDLE` |
| `CONFIG_IDLE` | `[E1]` | Mudar Perfil | Altera perfil; se != AFC desativa Canvas | `CONFIG_IDLE` |
| `CONFIG_IDLE` | `[E1]` | Mudar Ranhura Canvas | Define ranhura (`T0..T3`) e filamento | `CONFIG_IDLE` |
| `CONFIG_IDLE` | `[E1]` | Tocar em "Visualizar Modelo" | Abre visualizador 3D com volume de construção | `VIEWER_3D` |
| `CONFIG_IDLE` | `[E1]` | Tocar em "Fatiar" | Valida restrições e despacha thread NDK | `SLICING_ACTIVE` |
| `VIEWER_3D` | `[E1B]` | Modelo excede mesa | Desativa botão fatiar e sugere rotação/escala | `VIEWER_3D` |
| `VIEWER_3D` | `[E1B]` | "Voltar e Fatiar" | Regressa à configuração ou inicia fatiamento | `CONFIG_IDLE` / `SLICING_ACTIVE` |
| `SLICING_ACTIVE` | `[E2]` | Callback de progresso NDK | Atualiza percentagem (0-100%) e etapa atual | `SLICING_ACTIVE` |
| `SLICING_ACTIVE` | `[E2]` | Tocar em "Cancelar" | Invoca `nativeCancel()` e remove ficheiros `.tmp` | `CONFIG_IDLE` |
| `SLICING_ACTIVE` | `[E2]` | App suspensa / Sistema | Android suspende thread nativa | `SLICING_ERROR` (aviso OOM/suspensão) |
| `SLICING_ACTIVE` | `[E2]` | Erro no motor C++ | Lê código de saída e remove ficheiro parcial | `SLICING_ERROR` |
| `SLICING_ACTIVE` | `[E2]` | Sucesso C++ | Extrai metadados do G-code e gera visualização | `SLICING_RESULT` |
| `SLICING_ERROR` | `[E3]` | "Auto-Reparação" | Reexecuta com flag de reparação (se suportado) | `SLICING_ACTIVE` |
| `SLICING_ERROR` | `[E3]` | "Escolher Outro" | Abre seletor de ficheiros | `CONFIG_IDLE` |
| `SLICING_RESULT` | `[E4]` | Arrastar slider de camadas | Atualiza renderização da camada ativa | `SLICING_RESULT` |
| `SLICING_RESULT` | `[E4]` | "Enviar e Arrancar" | Verifica bloqueios da Fila; abre modal | `CONFIRM_START_MODAL` |
| `CONFIRM_START_MODAL`| `[E4]` | "Confirmar e Arrancar" | Despacha upload multipart Moonraker com flag arranque | `UPLOADING` |
| `SLICING_RESULT` | `[E4]` | "Pôr na Fila Local" | Guarda na fila do Atalaia e envia | `UPLOADING` (ou Fila) |
| `SLICING_RESULT` | `[E4]` | "Guardar G-code Local" | Grava via pasta da app ou SAF | `SAVED_LOCAL` |
| `UPLOADING` | `[E5]` | Progresso HTTP | Atualiza percentagem e velocidade MB/s | `UPLOADING` |
| `UPLOADING` | `[E5]` | Cancelar envio | Cancela socket HTTP e remove parcial no Moonraker | `SLICING_RESULT` |
| `UPLOADING` | `[E5]` | Envio concluído com sucesso | Se arranque: dispara macro; redireciona em 3s | `PRINTING_STARTED` |
| `UPLOADING` | `[E5]` | Erro de rede / ocupada | Mostra cartão de retry e opção de fila offline | `UPLOAD_ERROR` |
| `SAVED_LOCAL` | `[E6]` | "Partilhar Ficheiro" | Despacha intent Android `ACTION_SEND` | `SAVED_LOCAL` |
| `SAVED_LOCAL` | `[E6]` | "Guardar com SAF" | Abre seletor de pastas do Android | `SAVED_LOCAL` |

---

## 5. Tabela «Depende de X» (Origem dos Dados e Bloqueios)

| Elemento / Bloco | Depende de | Estado Atual / Comportamento se Ausente |
|---|---|---|
| **Etapas de progresso do fatiamento** | Callbacks exportados pelo wrapper JNI `libslic3r` | Se o motor só reportar percentagem global, as etapas mostram *"A processar fatiamento..."*. |
| **Log técnico de erro no E3** | Suporte do `libslic3r` a capturar stdout/stderr da thread nativa | Hoje o motor retorna código de saída numérico; o log textual detalhado é assinalado como exemplo ilustrativo. |
| **Auto-reparação de malha** | Suporte à flag de reparação na compilação da biblioteca | Se indisponível na v1, o botão é ocultado ou redireciona para escolha de outro ficheiro. |
| **Porta e URL do Moonraker no COSMOS** | Configuração de rede da impressora (porta 80 HTTP no firmware COSMOS) | Predefinido para `http://<ip-impressora>:80/server/files/upload`. |
| **Origem dos dados das ranhuras Canvas** | Consulta ao Moonraker/Klipper (`printer.canvas` ou macros AFC) | Se a impressora estiver offline ou não reportar status, permite escolha manual direta (`T0..T3`). |
| **Bloqueios de arranque da Fila** | Telemetria Moonraker: estado da impressora (`idle`), ligação WebSocket ativa e inventário de filamento | O arranque imediato só é desbloqueado se todos os critérios forem estritamente cumpridos. |
| **Volume de construção e conformidade** | Dimensões calculadas do STL vs. limites da CC1 (256×256×260 mm) | STL truncado entra no estado `Desconhecido`. Se ultrapassar o limite, entra em `Excede` e bloqueia o fatiamento. |

---

## 6. Matriz de Capacidades dos Perfis

| Parâmetro Técnico | Cosmos AFC (Recomendado) | Cosmos Mono | OpenCentauri |
|---|---|---|---|
| **Ficheiro de Perfil** | `Elegoo Centauri Carbon 0.4 nozzle - Cosmos AFC.json` | `Elegoo Centauri Carbon 0.4 nozzle - Cosmos.json` | `Elegoo Centauri Carbon 0.4 nozzle - opencentauri.json` |
| **G-code Flavor** | `klipper` | `klipper` | `klipper` |
| **Start G-code** | Macro `PRINT_START EXTRUDER=... BED=... TOOL={initial_tool}` | Macro `PRINT_START` sem parâmetro de ferramenta | Macro de arranque OpenCentauri |
| **End G-code** | `PRINT_END` | `PRINT_END` | `PRINT_END` |
| **Suporte AFC Canvas** | **Ativo (T0..T3)** com purga calibrada | **Desativado** (apenas T0) | **Desativado** |
| **Troca de Ferramenta** | `T[next_extruder] PURGE_LENGTH=[flush_length]` | Desativado | Desativado |
| **Aviso de Perfil** | Requer validação e vigilância das primeiras camadas em nova máquina | Requer vigilância de nivelamento | Requer vigilância de nivelamento |

---

## 7. Política Multi-Cor (Escopo v1 vs v2)

- **Escopo na v1:** Suporte focado em modelos STL mono-cor com atribuição da **ranhura ativa do Canvas (`T0`, `T1`, `T2` ou `T3`)**.
- **Ficheiros 3MF com múltiplas cores:** O mapeamento avançado de cores para ranhuras fica **fora da v1**. Ao carregar um 3MF multi-cor na v1, a app exibe um aviso explicativo e fatia o modelo integralmente com a ranhura principal selecionada, garantindo estabilidade e prevenindo falhas no motor nativo.

# Fatiador Integrado no Atalaia (libslic3r + Klipper / Cosmos AFC)

Documento de arquitetura, fluxos, acessibilidade, matriz de capacidades e especificação de estados para o módulo de fatiamento local no Atalaia (`Hawaii-005/atalaia`).

---

## 1. Ficheiros de Wireframes Low-Fi (Exportados por Ecrã)

Todos os wireframes seguem a convenção low-fi estrutural do repositório (tons de cinzento, blocos numerados, tipografia mínima de 12 px, áreas de toque >= 48 px e contraste WCAG AA):

- `wireframe-tablet-1180x740.svg`: Vista master-detail do tablet (1180×740) com visualizador 3D do volume de construção e painel lateral de fatiamento.
- `wireframe-phone-01-config.svg`: `[E1]` Configurar fatiamento (STL, perfil, ranhura Canvas, botão visível "Escolher manualmente", parâmetros, estimativa pré-fatiamento e botão Fatiar).
- `wireframe-phone-02-viewer.svg`: `[E1B]` Visualizador 3D do modelo e volume de construção da mesa (exemplo CC1: 256×256×256 mm extraído do perfil) com estados `Cabe`, `Excede` ou `Desconhecido`.
- `wireframe-phone-03-slicing.svg`: `[E2]` Fatiamento em curso (percentagem, barra, tempo decorrido, modal de confirmação ao carregar em Voltar/Cancelar com limpeza de temporários e aviso de app em primeiro plano).
- `wireframe-phone-04-error.svg`: `[E3]` Falha no fatiamento (diagnóstico, estado de fatiamento interrompido pelo sistema/background, catálogo de erros tratados e ações de recuperação).
- `wireframe-phone-05-result.svg`: `[E4]` Resultado do fatiamento (pré-visualização 2D com slider de 48 px, métricas reais, aviso de perfil novo não verificado, ações de envio/guarda e modal de arranque com bloqueios da Fila e variante bloqueada).
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
   - *Nota de visibilidade:* O fatiador encontra-se oculto quando a impressora selecionada opera sob firmware original Elegoo SDCP.
3. **[3] Seletor de Ranhura Canvas AFC:**
   - **Condição:** Visível apenas quando o perfil Cosmos AFC está ativo.
   - **Opções rápidas:** Ranhuras com cor e legenda coerentes (`T0: Preto / PLA`, `T1: Branco / PLA`, `T2: Azul / PETG`, `T3: Laranja / ABS`).
   - **Botão explícito:** Botão com altura >= 48 px para **"ESCOLHER MANUALMENTE (T0..T3 / COR)"**.
4. **[4] Parâmetros Básicos de Impressão (Touch targets >= 48 px):**
   - Altura de camada segmentada: `0.12 Fina`, `0.20 Standard` (recomendado), `0.28 Rápida`.
   - Preenchimento (Infill): Cartão tocável com chevron (`15% Gyroid`).
   - Suportes: Cartão tocável com chevron (`Árvore / Tree`, `Normal`, `Desligado`).
5. **[5] Estimativa Pré-Fatiamento:** Mostra estritamente `Tempo: —` e `Filamento: —` antes do fatiamento.
6. **[6] Ações Principais:**
   - Botão **"VISUALIZAR MODELO 3D (VOLUME)"**: Transita para `[E1B]`.
   - Botão **"FATIAR"**: Inicia o motor nativo. Não existe atalho direto de impressão antes do resultado.

### [E1B] Visor 3D e Volume de Construção (`wireframe-phone-02-viewer.svg`)
7. **[V1] Viewport 3D:** Representação da mesa e volume útil extraídos dinamicamente do perfil de máquina (exemplo CC1: 256×256×256 mm).
8. **[V2] Estado de Conformidade de Volume:**
   - **Cabe:** Dimensões dentro dos limites do perfil; autoriza fatiamento.
   - **Excede:** Dimensões ultrapassam o volume útil; bloqueia fatiamento e sugere rotação ou escala.
   - **Desconhecido:** Ficheiro STL com cabeçalho truncado ou dimensões não calculáveis antes do parsing total.

### [E2] Ecrã de Fatiamento em Curso (`wireframe-phone-03-slicing.svg`)
9. **[7] Progresso do Motor Nativo (libslic3r):**
   - Mostra percentagem numérica (`58%`), barra de progresso AA, etapa atual do fatiamento e tempo decorrido.
10. **[8] Botão Cancelar e Interceção de Voltar:**
    - Toque no botão "Cancelar" ou no botão nativo "Voltar" do Android abre modal de confirmação: *"Cancelar fatiamento em curso? Se saíres agora, o cálculo será abortado e os ficheiros temporários .tmp serão eliminados"*.
11. **Aviso de Primeiro Plano:** Alerta o utilizador para manter a aplicação aberta, pois a suspensão pelo Android interrompe o processo NDK.

### [E3] Ecrã de Falha no Fatiamento (`wireframe-phone-04-error.svg`)
12. **[9] Painel de Erro e Diagnóstico:**
    - Mensagem amigável de erro (ex.: *Geometria não-manifold detetada*).
    - Caixa com exemplo ilustrativo de log do `libslic3r`.
    - Catálogo de erros tratados:
      - **Fatiamento interrompido pelo sistema:** Acionado se a aplicação for enviada para segundo plano pelo SO.
      - **Memória esgotada (OOM):** Proteção em modelos excessivamente densos.
      - **Modelo fora do volume:** Validação de limites geométricos.
      - **Ficheiro truncado ou corrompido.**
      - **Espaço insuficiente em disco.**
13. **[10] Ações de Recuperação:** Botão para tentar com auto-reparação, escolher outro modelo ou voltar.

### [E4] Ecrã de Resultado do Fatiamento (`wireframe-phone-05-result.svg`)
14. **[11] Vista 2D de Camadas:** Visualização da trajetória com slider de altura mínima de **48 px** para navegação precisa camada a camada.
15. **[12] Dados Reais do G-code Gerado:**
    - Tempo real calculado (ex.: `1h 48m`), filamento real (ex.: `42.6 g • 13.8 m`) e camadas totais (`340`).
    - **Aviso de Perfil:** *"Gerado com o perfil Cosmos AFC (não verificado na impressora). Primeira impressão com perfil novo: vigia as primeiras camadas e valida o nivelamento da mesa."*
16. **[13] Destino do G-code:** Enviar e Arrancar, Pôr na Fila Local, Apenas Upload HTTP ou Guardar G-code Local.
17. **[14] Modal de Arranque Imediato (Bloqueios da Fila + Mesa Limpa):**
    - Mostra nome do ficheiro, perfil, ranhura e duração estimada.
    - **Variante Bloqueada:** Se a impressora estiver ocupada, sem ligação, ranhura incompatível ou filamento insuficiente, o botão de confirmação é desativado/substituído por *"Pôr na Fila Local"*, com o motivo explícito no cartão.

### [E5] Ecrã de Upload Moonraker (`wireframe-phone-06-upload.svg`)
18. **[15] Progresso do Envio HTTP Multipart:** Barra de progresso, velocidade de transferência e botão de cancelamento com limpeza remota.
19. **[16] Erros Tratados:** Impressora ocupada, autenticação falhada (401/403) e espaço insuficiente na impressora.

### [E6] Ecrã de Ficheiro Guardado (`wireframe-phone-07-saved.svg`)
20. **[17] Mecanismos de Armazenamento Android:**
    - **Opção A (Padrão):** Pasta interna da aplicação (`context.getExternalFilesDir("gcodes")`) com partilha imediata via `ACTION_SEND`.
    - **Opção B:** Pasta escolhida pelo utilizador via Android Storage Access Framework (SAF).
21. **[18] Ações Finais:** Partilhar ficheiro, guardar via SAF, ver na lista local do Atalaia ou voltar ao início.

---

## 3. Comportamento no Tablet (`wireframe-tablet-1180x740.svg`)

- **Reutilização Integral de Estados:** O tablet reutiliza **100% da máquina de estados do telemóvel** (`[E1B]` a `[E6]`).
- **Master-Detail:** O visor 3D do volume de construção (`[T1]`) e a configuração (`[T2]` a `[T6]`) coexistem lado a lado.
- **Modais:** Confirmações, bloqueios de arranque e falhas surgem em caixas modais sobrepostas de 500 px.

---

## 4. Tabela de Estados da Interface

| Estado Lógico | Ecrã Ativo | Entradas Possíveis | Ação Desencadeada | Próximo Estado |
|---|---|---|---|---|
| `CONFIG_IDLE` | `[E1]` | Tocar em Modelo | Abre `DocumentPicker` | `CONFIG_IDLE` |
| `CONFIG_IDLE` | `[E1]` | Mudar Perfil | Altera perfil; se != AFC desativa Canvas | `CONFIG_IDLE` |
| `CONFIG_IDLE` | `[E1]` | Escolher Ranhura | Abre seletor manual ou define T0..T3 | `CONFIG_IDLE` |
| `CONFIG_IDLE` | `[E1]` | "Visualizar Modelo" | Abre visualizador 3D com volume | `VIEWER_3D` |
| `CONFIG_IDLE` | `[E1]` | "Fatiar" | Valida restrições e inicia NDK | `SLICING_ACTIVE` |
| `VIEWER_3D` | `[E1B]` | Modelo excede mesa | Desativa fatiar; avisa escala | `VIEWER_3D` |
| `VIEWER_3D` | `[E1B]` | "Voltar e Fatiar" | Regressa à configuração ou fatia | `CONFIG_IDLE` / `SLICING_ACTIVE` |
| `SLICING_ACTIVE` | `[E2]` | Callback NDK | Atualiza progresso (0-100%) | `SLICING_ACTIVE` |
| `SLICING_ACTIVE` | `[E2]` | Cancelar / Voltar | Abre modal de confirmação de saída | `CONFIRM_CANCEL_SLICING` |
| `CONFIRM_CANCEL_SLICING` | `[E2]` | "Sim, Cancelar" | `nativeCancel()` e limpa `.tmp` | `CONFIG_IDLE` |
| `CONFIRM_CANCEL_SLICING` | `[E2]` | "Continuar" | Fecha modal e retoma UI de progresso | `SLICING_ACTIVE` |
| `SLICING_ACTIVE` | `[E2]` | App em background | SO suspende NDK; limpa parciais | `SLICING_ERROR` (`background_interrupted`) |
| `SLICING_ACTIVE` | `[E2]` | Erro motor C++ | Lê código de erro e limpa `.tmp` | `SLICING_ERROR` |
| `SLICING_ACTIVE` | `[E2]` | Sucesso C++ | Extrai dados e prepara preview | `SLICING_RESULT` |
| `SLICING_ERROR` | `[E3]` | "Auto-Reparação" | Reexecuta com flag de reparação | `SLICING_ACTIVE` |
| `SLICING_ERROR` | `[E3]` | "Escolher Outro" | Abre seletor de ficheiros | `CONFIG_IDLE` |
| `SLICING_RESULT` | `[E4]` | Mover slider (48px) | Renderiza camada selecionada | `SLICING_RESULT` |
| `SLICING_RESULT` | `[E4]` | "Enviar e Arrancar" | Avalia regras da Fila; abre modal | `CONFIRM_START_MODAL` |
| `CONFIRM_START_MODAL`| `[E4]` | Impressora livre | Confirma mesa limpa e arranca | `UPLOADING` |
| `CONFIRM_START_MODAL`| `[E4]` | Impressora ocupada | Variante bloqueada: "Pôr na Fila" | `UPLOADING` (ou Fila) |
| `SLICING_RESULT` | `[E4]` | "Guardar G-code" | Grava via pasta da app ou SAF | `SAVED_LOCAL` |
| `UPLOADING` | `[E5]` | Progresso HTTP | Atualiza percentagem e velocidade | `UPLOADING` |
| `UPLOADING` | `[E5]` | Cancelar envio | Fecha socket e limpa remoto | `SLICING_RESULT` |
| `UPLOADING` | `[E5]` | Envio concluído | Se arranque: dispara impressão | `PRINTING_STARTED` |
| `SAVED_LOCAL` | `[E6]` | "Partilhar" | Despacha intent `ACTION_SEND` | `SAVED_LOCAL` |
| `SAVED_LOCAL` | `[E6]` | "Guardar com SAF" | Abre seletor de pastas Android | `SAVED_LOCAL` |

---

## 5. Perguntas «Depende de X» a Verificar na Impressora

1. **Porta e Endereço do Moonraker:**
   - *Pergunta:* O Moonraker no firmware COSMOS da CC1 responde na porta 80 HTTP direta ou na 7125 padrão do Klipper?
   - *Comportamento se não verificado:* O Atalaia tenta a porta configurada no perfil da impressora (porta 80) com fallback para 7125.
2. **Telemetria do Módulo Canvas AFC:**
   - *Pergunta:* O Klipper/Moonraker expõe as cores e filamentos das 4 ranhuras através do objeto `printer.canvas` ou via variáveis de macro salvas?
   - *Comportamento se não verificado:* Se a consulta falhar, a interface disponibiliza o botão explícito "Escolher manualmente" para o utilizador definir a ranhura ativa.
3. **Comportamento da Macro `PRINT_START` com AFC:**
   - *Pergunta:* A macro aceita os parâmetros `TOOL={initial_tool}` e `PURGE_LENGTH` exatamente como formatado pelo perfil OrcaSlicer?
   - *Comportamento se não verificado:* O ficheiro G-code gerado inclui o aviso de perfil não verificado para validação da primeira camada.
4. **Callbacks de Progresso e Logs do Motor NDK:**
   - *Pergunta:* A biblioteca C++ exporta callbacks linha a linha para etapas de fatiamento ou apenas percentagem global?
   - *Comportamento se não verificado:* A interface mostra texto genérico caso os passos específicos não sejam emitidos pelo motor.
5. **Suporte Nativo a Auto-Reparação de Malha:**
   - *Pergunta:* A compilação do `libslic3r` inclui suporte completo ao reparo de malhas não-manifold via CGAL/Boost?
   - *Comportamento se não verificado:* Na ausência de suporte no binário, a opção direciona para escolha de outro modelo.

---

## 6. Matriz de Capacidades e Perfis

| Parâmetro Técnico | Cosmos AFC (Recomendado) | Cosmos Mono | OpenCentauri | Stock Elegoo (SDCP) |
|---|---|---|---|---|
| **Visibilidade na App** | **Visível** | **Visível** | **Visível** | **Oculto (Não suportado)** |
| **Ficheiro de Perfil** | `Elegoo Centauri Carbon 0.4 nozzle - Cosmos AFC.json` | `Elegoo Centauri Carbon 0.4 nozzle - Cosmos.json` | `Elegoo Centauri Carbon 0.4 nozzle - opencentauri.json` | N/A |
| **G-code Flavor** | `klipper` | `klipper` | `klipper` | N/A |
| **Volume de Construção** | 256 × 256 × 256 mm | 256 × 256 × 256 mm | 256 × 256 × 256 mm | 256 × 256 × 256 mm |
| **Start G-code** | Macro `PRINT_START` com `TOOL={initial_tool}` | Macro `PRINT_START` sem parâmetro de ferramenta | Macro padrão OpenCentauri | N/A |
| **Suporte AFC Canvas** | **Ativo (T0..T3)** | **Desativado** | **Desativado** | N/A |
| **Troca de Ferramenta** | `T[next_extruder] PURGE_LENGTH=[flush_length]` | Desativado | Desativado | N/A |

---

## 7. Política Multi-Cor (Escopo v1 vs v2)

- **Escopo v1:** Suporte estrito a modelos STL mono-cor com atribuição a uma ranhura do Canvas (`T0..T3`).
- **Ficheiros 3MF Multi-Cor:** O mapeamento avançado de cores para ranhuras fica **fora da v1**. Ficheiros 3MF carregados na v1 são fatiados utilizando a ranhura primária selecionada, apresentando um aviso explícito de simplificação para prevenir falhas no motor nativo.

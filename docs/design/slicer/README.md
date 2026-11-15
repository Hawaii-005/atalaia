# Fatiador Integrado no Atalaia (libslic3r + Klipper / Cosmos AFC)

Documento de arquitetura, fluxos, acessibilidade, matriz de capacidades, licenciamento e especificação de estados para o módulo de fatiamento no Atalaia (`Hawaii-005/atalaia`).

---

## 1. Alternativas de Arquitetura e Licenciamento (Decisão Pendente)

O Atalaia é um fork do CC-Tool licenciado sob licença **MIT** (permissiva). O fatiamento local baseado em `libslic3r` introduz restrições legais decorrentes da licença **GNU AGPL v3**. Estão definidas três opções formais submetidas à decisão do utilizador:

- **Opção A (Atalaia sob AGPL v3):**
  - O motor `libslic3r` é integrado diretamente no APK do Atalaia via JNI/NDK (`libslice_core.so`).
  - *Implicação legal:* Toda a aplicação Atalaia passa a ser distribuída sob a GNU AGPL v3. Exige disponibilização integral e pública de todo o código-fonte correspondente (incluindo scripts de build e modificações nativas).
  - *Requisito técnico:* O ficheiro `libslice_core.so` tem de ser compilado de raiz com toolchain reproduzível NDK r25b+, nunca extraído de APKs de terceiros.
- **Opção B (Módulo / APK Companheiro Isolado via IPC):**
  - O Atalaia permanece 100% sob licença **MIT**.
  - O fatiador reside num APK separado ("Atalaia Slicer Daemon" ou serviço em background sob AGPL v3).
  - A comunicação entre o Atalaia e o fatiador é feita estritamente através de IPC do Android (AIDL / `Messenger` / UNIX domain socket local), mantendo a separação de processos e evitando a contaminação viral da licença MIT do Atalaia.
- **Opção C (App SlicePilot Separada via "Partilhar" / Intents — Zero Código/Binário no Atalaia):**
  - O Atalaia não incorpora qualquer código C++, JNI, NDK ou binário `libslice_core.so`.
  - O utilizador instala a aplicação SlicePilot independente. O Atalaia limita-se a receber o ficheiro G-code fatiado através do intent padrão de partilha (`ACTION_SEND` / "Partilhar com Atalaia"), entrando diretamente no fluxo da Fase 5 (Ficheiros / Envio Moonraker).
  - *Vantagens:* Zero risco de contaminação da licença MIT, zero megabytes adicionados ao APK do Atalaia, complexidade de compilação C++ externa à aplicação.

> **Garantia:** Nenhuma destas opções será implementada em código nem nenhum binário será introduzido no repositório até aprovação e escolha explícita do utilizador.

---

## 2. Esforço de Compilação do `libslice_core.so` e Exigências AGPL-3 (Para Opções A ou B)

Compilar o `libslice_core.so` de forma reproduzível a partir do código-fonte representa um esforço de engenharia substancial:
1. **Toolchain e Dependências:**
   - Exige Android NDK r25b+, CMake 3.22+, Ninja, e compilação cruzada para `arm64-v8a` das seguintes bibliotecas estáticas C++ pesadas:
     - Boost (system, filesystem, thread, log, locale, iostreams) com configuração em `boost-user-config.jam`
     - TBB (Intel Threading Building Blocks)
     - OpenVDB, Blosc, ZLIB
     - CGAL 5.x e Eigen 3.4
     - `libslic3r` (árvore C++ do PrusaSlicer/OrcaSlicer adaptada)
2. **Tempo e Recursos de Build:**
   - A compilação completa demora entre 45 a 90 minutos num processador multi-core moderno e consome ~25 GB de espaço em disco em artefatos intermediários.
   - O repositório SlicePilot fornece um script mestre (`android/native-build/build.sh`), mas que exige patches de caminhos para compilação fora de ambientes Linux Ubuntu específicos.
3. **Exigências Estritas da AGPL v3 (Código-Fonte Correspondente):**
   - A secção 1 da AGPL v3 define o "Código-Fonte Correspondente" como todo o código necessário para gerar, instalar e executar o binário, incluindo scripts de controlo de compilação (`build.sh`, `CMakeLists.txt`), receitas de patches e definições de dependências exatas.
   - Distribuir um binário pré-compilado sem fornecer o script e a árvore exata que o gerou viola a licença AGPL v3.

---

## 3. Ficheiros de Wireframes Low-Fi (Exportados por Ecrã)

Todos os wireframes seguem a convenção low-fi estrutural do repositório (tons de cinzento, blocos numerados, tipografia mínima de 12 px, áreas de toque >= 48 px e contraste WCAG AA):

- `wireframe-tablet-1180x740.svg`: Vista master-detail do tablet (1180×740) com visualizador 3D do volume de construção e painel lateral de fatiamento.
- `wireframe-phone-01-config.svg`: `[E1]` Configurar fatiamento (STL/3MF, perfil, ranhura Canvas, modal de confirmação para 3MF multi-cor em ranhura única, estimativa pré-fatiamento e botão Fatiar).
- `wireframe-phone-02-viewer.svg`: `[E1B]` Visualizador 3D do modelo e volume de construção da mesa (256×256×256 mm) com separação rigorosa de estados: `Cabe`, `Excede o volume útil` (bloqueio v1, sem escala nem rotação), `Volume do perfil indisponível` (avisa e permite) e `Dimensões do STL desconhecidas` (bloqueia).
- `wireframe-phone-03-slicing.svg`: `[E2]` Fatiamento em curso (flag `keepScreenOn` ativa para manter ecrã ligado, persistência de marca `.job_active` em disco, sem eliminação imediata de parciais ao minimizar).
- `wireframe-phone-04-error.svg`: `[E3]` Falha no fatiamento (diagnóstico, deteção de fatiamento interrompido através de marca gravada ao regressar com limpeza de temporários).
- `wireframe-phone-05-result.svg`: `[E4]` Resultado do fatiamento (pré-visualização 2D com slider de 48 px, ação de "Pôr na Fila Local" como item local sem envio imediato, e modal de arranque com aviso não bloqueante de filamento e revalidação de máquina ociosa).
- `wireframe-phone-05b-result-blocked.svg`: `[E4B]` Variante bloqueada do modal de arranque (motivos explícitos de segurança: impressora ocupada, sem ligação > 60s ou ranhura incompatível, com botão primário para "Pôr na Fila Local").
- `wireframe-phone-06-upload.svg`: `[E5]` Upload para o Moonraker (progresso multipart, revalidação pré-arranque imediata, estado "Apenas enviado" com botões manuais de arranque e conclusão sem timer de 3s; tratamento de timeout/sem espaço com tentativa de remoção parcial e aviso; catálogo de erros: 401/403, 507 e falha em `print.start`).
- `wireframe-phone-07-saved.svg`: `[E6]` Ficheiro guardado localmente (mecanismos Android: pasta interna com partilha vs. Storage Access Framework).

---

## 4. Lista Numerada dos Blocos de Interface

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
6. **[6] Ações Principais e Confirmação 3MF:**
   - Botão **"VISUALIZAR MODELO 3D (VOLUME)"**: Transita para `[E1B]`.
   - Botão **"FATIAR"**: Inicia o motor nativo.
   - **Modal de Confirmação 3MF Multi-Cor:** Ao carregar um 3MF com múltiplas cores, abre modal de confirmação explícita alertando que na v1 o modelo será impresso integralmente na ranhura selecionada (`T0`).

### [E1B] Visor 3D e Volume de Construção (`wireframe-phone-02-viewer.svg`)
7. **[V1] Viewport 3D:** Representação da mesa e volume útil extraídos dinamicamente do perfil de máquina (exemplo CC1: 256×256×256 mm).
8. **[V2] Estados de Conformidade de Volume Rigorosamente Separados:**
   - **Cabe:** Dimensões dentro dos limites do perfil; autoriza fatiamento.
   - **Excede o volume útil (v1):** Dimensões ultrapassam a mesa. Na v1 não há manipulação de escala nem rotação na app; o fatiamento é estritamente bloqueado.
   - **Volume do perfil indisponível (Avisar e permitir):** O JSON do perfil de máquina não contém valores válidos de `printable_area` ou `printable_height`. Apresenta aviso com risco assumido, mas permite avançar para o fatiamento.
   - **Dimensões do STL desconhecidas (Bloquear):** O ficheiro STL possui cabeçalho corrompido ou malha sem vértices mensuráveis antes da leitura completa. O fatiamento é bloqueado; exige novo ficheiro ou reparação.

### [E2] Ecrã de Fatiamento em Curso (`wireframe-phone-03-slicing.svg`)
9. **[7] Progresso do Motor Nativo (libslic3r):**
   - Mostra percentagem numérica (`58%`), barra de progresso AA, etapa atual do fatiamento e tempo decorrido.
10. **[8] Botão Cancelar e Interceção de Voltar:**
    - Toque em "Cancelar" ou no botão nativo "Voltar" abre modal de confirmação para abortar cálculo e limpar `.tmp`.
11. **Ecrã Mantido Ligado e Gestão de Background:**
    - Ativação da flag `keepScreenOn` para impedir suspensão do ecrã durante o cálculo.
    - Gravação de uma marca de trabalho persistente em disco (`.job_active`). Se a app for minimizada, os temporários **não são apagados de imediato**. A interrupção é tratada no regresso à app.

### [E3] Ecrã de Falha no Fatiamento (`wireframe-phone-04-error.svg`)
12. **[9] Painel de Erro e Diagnóstico:**
    - Mensagem amigável de erro e log resumido.
    - **Fatiamento Interrompido Detetado por Marca ao Regressar:** Se a aplicação for terminada ou a thread suspensa pelo SO durante background, a presença da marca ao reabrir a app direciona para este ecrã, realizando nesse momento a limpeza dos ficheiros parciais `.tmp`.
    - Outros erros tratados: Memória esgotada (OOM), modelo fora do volume, ficheiro corrompido e disco cheio.
13. **[10] Ações de Recuperação:** Auto-reparação, escolher outro modelo ou voltar.

### [E4] Ecrã de Resultado do Fatiamento (`wireframe-phone-05-result.svg` e `wireframe-phone-05b-result-blocked.svg`)
14. **[11] Vista 2D de Camadas:** Visualização da trajetória com slider de altura mínima de **48 px** para navegação camada a camada.
15. **[12] Dados Reais do G-code Gerado:**
    - Tempo real calculado (ex.: `1h 48m`), filamento real (ex.: `42.6 g • 13.8 m`) e total de camadas (`340`).
    - Aviso de perfil: *"Gerado com o perfil Cosmos AFC (não verificado na impressora). Primeira impressão com perfil novo: vigia as primeiras camadas."*
16. **[13] Destinos do G-code:**
    - **Enviar e Arrancar:** Transita para validação e envio imediato.
    - **Pôr na Fila Local:** Cria o item estritamente na base de dados local do Atalaia **sem efetuar qualquer envio de rede imediato** (não transita para `UPLOADING`).
    - **Apenas Upload:** Envia via Moonraker e encerra no estado `UPLOAD_ONLY_COMPLETED`.
    - **Guardar G-code:** Grava no armazenamento local Android.
17. **[14] Modal de Arranque Imediato (`[E4]` vs `[E4B]`):**
    - **Variante Regular (`[E4]`):** Confirmação de mesa 100% desobstruída. Aviso de filamento insuficiente é **meramente informativo e não bloqueia** o arranque.
    - **Variante Bloqueada (`[E4B]`):** Acionada se houver violação das regras de segurança (impressora ocupada, sem ligação > 60s ou ranhura de filamento incompatível). O botão de confirmação direta é desativado e substituído pela ação primária **"Pôr na Fila Local"** com os motivos explicitados.
    - **Revalidação de ociosidade:** A ociosidade é validada no modal e reconfirmada de imediato antes de invocar `printer.print.start`.

### [E5] Ecrã de Upload Moonraker (`wireframe-phone-06-upload.svg`)
18. **[15] Progresso do Envio HTTP Multipart:** Percentagem, velocidade de transferência e botão de cancelamento com remoção remota de ficheiro parcial.
19. **[15B] Estado "Apenas Enviado" (`UPLOAD_ONLY_COMPLETED`):**
    - Quando o upload conclui sem arranque direto, a UI apresenta botões manuais explícitos: **"ARRANCAR AGORA (MESA LIMPA)"** ou **"CONCLUIR"** (sem qualquer timer ou redirecionamento automático de 3 segundos).
20. **[16] Catálogo Completo de Erros e Estados de Envio:**
    - **Impressora Ocupada / Revalidação Falhada:** Detetado que a máquina iniciou outro trabalho antes do arranque; ficheiro é mantido no Moonraker e arranque é cancelado.
    - **Autenticação Falhada (401/403):** Token da API Moonraker rejeitado (depende de autenticação configurada).
    - **Timeout de Rede / Sem Espaço no Destino (HTTP 507):** A aplicação tenta remover o ficheiro parcial no Moonraker; se a remoção falhar, emite aviso explícito ao utilizador.
    - **Falha em `print.start`:** Ficheiro é enviado com sucesso, mas a chamada à macro Klipper é recusada.

### [E6] Ecrã de Ficheiro Guardado (`wireframe-phone-07-saved.svg`)
21. **[17] Mecanismos de Armazenamento Android:**
    - Pasta interna da aplicação com partilha direta (`ACTION_SEND`).
    - Pasta escolhida pelo utilizador via Android Storage Access Framework (SAF).

---

## 5. Comportamento no Tablet (`wireframe-tablet-1180x740.svg`)

- **Reutilização Integral:** Reutiliza 100% dos estados do telemóvel (`[E1B]` a `[E6]`).
- **Master-Detail:** Visor 3D da mesa e configuração coexistem lado a lado.
- Modais de confirmação, fila local e diagnósticos surgem como janelas sobrepostas de 500 px.

---

## 6. Tabela Completa de Estados da Interface

| Estado Lógico | Ecrã Ativo | Entradas Possíveis | Ação Desencadeada | Próximo Estado |
|---|---|---|---|---|
| `CONFIG_IDLE` | `[E1]` | Tocar em Modelo | Abre `DocumentPicker` | `CONFIG_IDLE` |
| `CONFIG_IDLE` | `[E1]` | Carrega 3MF multi-cor | Deteta cores múltiplas; abre modal | `CONFIRM_3MF_MONO` |
| `CONFIRM_3MF_MONO` | `[E1]` | Cancelar | Rejeita ficheiro ou volta | `CONFIG_IDLE` |
| `CONFIRM_3MF_MONO` | `[E1]` | Confirmar T0 | Aceita modelo simplificado a uma ranhura | `CONFIG_IDLE` |
| `CONFIG_IDLE` | `[E1]` | Mudar Perfil | Altera perfil; se != AFC desativa Canvas | `CONFIG_IDLE` |
| `CONFIG_IDLE` | `[E1]` | Escolher Ranhura | Abre seletor manual ou define T0..T3 | `CONFIG_IDLE` |
| `CONFIG_IDLE` | `[E1]` | "Visualizar Modelo" | Abre visualizador 3D com volume | `VIEWER_3D` |
| `CONFIG_IDLE` | `[E1]` | "Fatiar" | Valida restrições e inicia NDK | `SLICING_ACTIVE` |
| `VIEWER_3D` | `[E1B]` | Modelo cabe | Habilita botão de fatiamento | `VIEWER_3D` |
| `VIEWER_3D` | `[E1B]` | Modelo excede mesa | Desativa fatiar (v1 sem escala/rotação) | `VIEWER_3D` |
| `VIEWER_3D` | `[E1B]` | Perfil sem volume | Alerta volume indisponível; permite fatiar | `VIEWER_3D` |
| `VIEWER_3D` | `[E1B]` | STL não mensurável | Alerta dimensões desconhecidas; bloqueia | `VIEWER_3D` |
| `VIEWER_3D` | `[E1B]` | "Voltar e Fatiar" | Regressa à configuração e fatia | `SLICING_ACTIVE` |
| `SLICING_ACTIVE` | `[E2]` | Início do cálculo | Liga flag `keepScreenOn` e grava marca | `SLICING_ACTIVE` |
| `SLICING_ACTIVE` | `[E2]` | Callback NDK | Atualiza percentagem (0-100%) | `SLICING_ACTIVE` |
| `SLICING_ACTIVE` | `[E2]` | Cancelar / Voltar | Abre modal de confirmação de saída | `CONFIRM_CANCEL_SLICING` |
| `CONFIRM_CANCEL_SLICING` | `[E2]` | "Sim, Cancelar" | Aborta NDK, remove marca e limpa `.tmp` | `CONFIG_IDLE` |
| `CONFIRM_CANCEL_SLICING` | `[E2]` | "Continuar" | Fecha modal e mantém fatiamento | `SLICING_ACTIVE` |
| `SLICING_ACTIVE` | `[E2]` | App minimizada | `keepScreenOn` tenta manter; marca fica | `SLICING_ACTIVE` |
| `SLICING_ACTIVE` | `[E2]` | Reabertura com job morto | SO matou processo; deteta marca e limpa | `SLICING_ERROR` (`interrupted`) |
| `SLICING_ACTIVE` | `[E2]` | Erro motor C++ | Lê erro, remove marca e limpa `.tmp` | `SLICING_ERROR` |
| `SLICING_ACTIVE` | `[E2]` | Sucesso C++ | Remove marca, gera preview e transita | `SLICING_RESULT` |
| `SLICING_ERROR` | `[E3]` | "Auto-Reparação" | Reexecuta com flag de reparação | `SLICING_ACTIVE` |
| `SLICING_ERROR` | `[E3]` | "Escolher Outro" | Abre seletor de ficheiros | `CONFIG_IDLE` |
| `SLICING_RESULT` | `[E4]` | Mover slider (48px) | Renderiza camada selecionada | `SLICING_RESULT` |
| `SLICING_RESULT` | `[E4]` | "Pôr na Fila Local" | Cria registo na BD local (sem envio) | `QUEUE_SAVED_LOCAL` |
| `SLICING_RESULT` | `[E4]` | "Apenas Upload" | Inicia upload multipart sem arranque | `UPLOADING_ONLY` |
| `SLICING_RESULT` | `[E4]` | "Enviar e Arrancar" | Avalia regras de segurança da Fila | `CHECK_PRINT_RULES` |
| `CHECK_PRINT_RULES` | `[E4]` | Regras cumpridas | Abre modal de confirmação regular | `CONFIRM_START_MODAL` |
| `CHECK_PRINT_RULES` | `[E4B]`| Violação de regras | Abre modal com arranque bloqueado | `CONFIRM_START_BLOCKED` |
| `CONFIRM_START_BLOCKED`| `[E4B]`| "Pôr na Fila Local" | Guarda na BD local (item local, sem envio) | `QUEUE_SAVED_LOCAL` |
| `CONFIRM_START_BLOCKED`| `[E4B]`| "Cancelar" | Fecha modal e regressa ao resultado | `SLICING_RESULT` |
| `CONFIRM_START_MODAL`| `[E4]` | Filamento baixo | Mostra aviso informativo não bloqueante | `CONFIRM_START_MODAL` |
| `CONFIRM_START_MODAL`| `[E4]` | Confirmar arranque | Inicia envio Moonraker | `UPLOADING_FOR_PRINT` |
| `UPLOADING_ONLY` | `[E5]` | Upload concluído | Ficheiro gravado na Centauri Carbon | `UPLOAD_ONLY_COMPLETED` |
| `UPLOAD_ONLY_COMPLETED`| `[E5]`| "Arrancar Agora" | Revalida ociosidade e mesa limpa | `PRE_PRINT_VERIFY` |
| `UPLOAD_ONLY_COMPLETED`| `[E5]`| "Concluir" | Regressa à lista de ficheiros / início | `CONFIG_IDLE` |
| `UPLOADING_FOR_PRINT`| `[E5]` | Upload concluído | Revalida imediatamente se ociosa | `PRE_PRINT_VERIFY` |
| `PRE_PRINT_VERIFY` | `[E5]` | Impressora ocupada | Cancela disparo; avisa utilizador | `ERROR_PRINTER_BUSY` |
| `PRE_PRINT_VERIFY` | `[E5]` | Impressora ociosa | Dispara chamada `printer.print.start` | `DISPATCHING_PRINT` |
| `DISPATCHING_PRINT` | `[E5]` | Sucesso macro Klipper | Arranca e redireciona para monitor | `PRINTING_STARTED` |
| `DISPATCHING_PRINT` | `[E5]` | Erro no `print.start` | Ficheiro enviado mas macro recusada | `ERROR_PRINT_START_FAILED` |
| `UPLOADING_*` | `[E5]` | Erro 401/403 | Falha de autenticação por token | `ERROR_UPLOAD_AUTH` |
| `UPLOADING_*` | `[E5]` | Erro 507 / Sem espaço | Tenta apagar parcial; se falhar avisa | `ERROR_UPLOAD_NO_SPACE` |
| `UPLOADING_*` | `[E5]` | Timeout de socket | Tenta apagar parcial; se falhar avisa | `ERROR_UPLOAD_TIMEOUT` |
| `UPLOADING_*` | `[E5]` | Cancelar upload | Aborta requisição e remove parcial | `SLICING_RESULT` |
| `SLICING_RESULT` | `[E4]` | "Guardar G-code" | Grava via pasta da app ou SAF | `SAVED_LOCAL` |
| `SAVED_LOCAL` | `[E6]` | "Partilhar" | Despacha intent `ACTION_SEND` | `SAVED_LOCAL` |
| `SAVED_LOCAL` | `[E6]` | "Guardar com SAF" | Abre seletor de pastas Android | `SAVED_LOCAL` |

---

## 7. Perguntas «Depende de X» a Validar na Impressora

1. **Porta e Protocolo Moonraker:**
   - *Pergunta:* O firmware COSMOS da CC1 expõe o Moonraker na porta 80 ou na 7125?
   - *Fallback:* Tentativa prioritária na porta configurada com fallback automático.
2. **Telemetria de Ranhuras Canvas AFC:**
   - *Pergunta:* O Klipper expõe o estado de filamento/cor das 4 ranhuras através do objeto `printer.canvas` ou variáveis salvas?
   - *Fallback:* Disponibilização obrigatória do botão "Escolher manualmente" para seleção de T0..T3.
3. **Parâmetros da Macro `PRINT_START`:**
   - *Pergunta:* A macro aceita os parâmetros `TOOL={initial_tool}` e `PURGE_LENGTH` gerados pelo fatiador?
   - *Fallback:* Alerta explícito de primeira impressão com perfil não verificado.
4. **Callbacks de Progresso do libslic3r:**
   - *Pergunta:* O motor exporta passos detalhados ou apenas percentagem global?
   - *Fallback:* Exibição de barra genérica e percentagem quando não houver detalhe.
5. **Suporte Nativo a Auto-Reparação de Malha:**
   - *Pergunta:* O binário compilado tem CGAL/Boost ativado para reparação de geometrias não-manifold?
   - *Fallback:* Se ausente, aviso para substituição do ficheiro STL.
6. **Resposta HTTP 507 e Gestão de Espaço:**
   - *Pergunta:* O Moonraker da CC1 emite código HTTP 507 quando o disco eMMC está cheio e permite remoção imediata de uploads parciais abortados?
   - *Fallback:* Aplicação tenta remover o ficheiro parcial; se a chamada falhar ou der timeout, alerta expressamente o utilizador para verificar o armazenamento da impressora.
7. **Autenticação por Token / Chave de API:**
   - *Pergunta:* O Moonraker no COSMOS está configurado com autenticação restrita (`trusted_clients` vs tokens de utilizador nos endpoints HTTP)?
   - *Fallback:* Se receber HTTP 401/403, a interface encaminha para configuração de credenciais nas definições de máquina do Atalaia.

---

## 8. Matriz de Capacidades dos Perfis

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

## 9. Política Multi-Cor (Escopo v1 vs v2)

- **Escopo v1:** Suporte estrito a modelos STL mono-cor atribuídos a uma ranhura (`T0..T3`). Ficheiros 3MF multi-cor exigem confirmação explícita para fatiamento com cor única na ranhura selecionada.
- **Escopo v2:** Mapeamento visual avançado de corpos/cores do 3MF para as ranhuras do módulo Canvas AFC.

# ADR 0002: Integração do Fatiador libslic3r no Atalaia sob Licença AGPL-3 (Opção A)

* **Status**: **Aceite** (2026-11-19) — Fase 1 concluída com teste físico aprovado; Fase 2 autorizada pelo decisor
* **Data**: 2026-11-15
* **Decisor**: Bruno Rocha (`Hawaii-005/atalaia`)
* **Decisão Tomada**: Adoção da **Opção A** (motor `libslic3r` nativo integrado via NDK/JNI num módulo desacoplado `modules/atalaia-slicer/`).

---

## 1. Contexto e Motivação
O utilizador pretende fatiar ficheiros STL/3MF, enviar o G-code resultante para a impressora Elegoo Centauri Carbon CC1 (firmware COSMOS/Klipper com Moonraker e módulo multi-material Canvas AFC) e acompanhar a execução da impressão diretamente dentro do Atalaia, sem depender de computadores externos ou de aplicações terceiras com contas cloud.

O motor de fatiamento de código aberto de referência para este ecossistema é o `libslic3r` (base do Slic3r, PrusaSlicer e OrcaSlicer), compilado em C++ para a arquitetura `arm64-v8a`.

No entanto, o núcleo do `libslic3r` é estritamente licenciado sob a **GNU Affero General Public License v3.0 (AGPL-3.0)**. O Atalaia é um fork do CC-Tool licenciado sob a licença permissiva **MIT**.

---

## 2. Decisão

Adotar a **Opção A**:
1. O fatiador será integrado como um submódulo nativo autónomo em `modules/atalaia-slicer/` (Kotlin + JNI/NDK ligando estaticamente a `libslice_core.so`).
2. O módulo `modules/atalaia-slicer/` será licenciado sob **GNU AGPL v3.0 (ou posterior)**.
3. Serão geradas duas variantes distintas da aplicação via Gradle:
   * **Variante `lite`:** Mantém o Atalaia puramente sob licença MIT. Exclui o módulo `modules/atalaia-slicer/`, não empacota o binário `libslice_core.so` e oculta a interface de fatiamento.
   * **Variante `completa`:** Empacota o fatiador nativo e, nos termos da AGPL-3, a distribuição combinada é disponibilizada integralmente sob AGPL-3.0.
4. Nenhuma alteração ao ficheiro `LICENSE` raiz do repositório será efetuada sem validação e aprovação explícita por escrito do utilizador.

---

## 3. Consequências e Exigências Legais da AGPL-3

A licença GNU AGPL-3.0 impõe um dever de copyleft forte ("viral"):
* **Código-Fonte Correspondente (Corresponding Source):** Em cada release da variante completa, o Atalaia é obrigado a disponibilizar o código-fonte completo de todos os módulos que compõem o binário final distribuído, incluindo:
  - Todo o código TypeScript, React Native e Kotlin da aplicação;
  - O código C++ dos wrappers JNI (`slice_jni.cpp`);
  - Os patches aplicados às dependências de terceiros;
  - Os scripts de compilação reproduzíveis (`build.sh`, `Dockerfile`, `CMakeLists.txt`) que geraram o binário `libslice_core.so`.
* **Proibição de Binários Órfãos:** É expressamente proibido extrair binários `.so` de APKs pré-compilados de terceiros sem fornecer o código-fonte exato e o ambiente de build correspondente. O binário tem de ser compilável de forma auditável e reproduzível.
* **Preservação de Avisos de Autoria:** Todos os cabeçalhos de copyright do CC-Tool (MIT), SlicePilot (MIT) e libslic3r/PrusaSlicer (AGPL-3) têm de ser preservados no ficheiro `NOTICE`.

---

## 4. Alternativas Rejeitadas

### Opção B: Módulo / APK Companheiro Isolado via IPC (Rejeitada)
* *Desenho:* Criar uma segunda app instalada à parte ("Atalaia Slicer Daemon") sob AGPL-3 que executaria o fatiamento e responderia ao Atalaia via IPC Android (AIDL ou sockets UNIX locais).
* *Motivo da rejeição:* 
  1. Experiência de utilizador degradada (obriga o utilizador a instalar e gerir duas aplicações separadas no Android).
  2. Risco de segurança e permissões acrescidas (gestão de ciclo de vida de daemons em background no Android moderno é agressivamente limitada pelo SO).
  3. Não oferece garantia jurídica absoluta de proteção contra contaminação por dependência funcional estrita sem consulta especializada a advogados de propriedade intelectual.

### Opção C: Integração Externa com App SlicePilot via Intents / Partilhar (Rejeitada)
* *Desenho:* Manter o Atalaia 100% sem motor de fatiamento e receber o G-code final fatiado na aplicação SlicePilot através de `ACTION_SEND`.
* *Motivo da rejeição:*
  1. Quebra do requisito de fluxo unificado e integrado: o utilizador pretendia fatiar, enviar e monitorizar a impressão diretamente dentro do Atalaia num ciclo contínuo (ecrãs E1 a E6), sem saltos entre aplicações nem perda de contexto.
  2. A aplicação SlicePilot é de código aberto (licença MIT com libslic3r sob AGPL-3), mas inclui dependências de telemetria (Firebase/Crashlytics) e autenticação cloud que não coincidem com os princípios de operação 100% local do Atalaia. Contudo, o motivo determinante para a rejeição foi a exigência de um fluxo de fatiamento e acompanhamento unificado dentro do Atalaia.

---

## 5. Próximos Passos (Transição para Fase 2)
A implementação em código nativo só terá início após a validação do relatório de viabilidade do spike, aprovação da estratégia de variantes e consentimento explícito do utilizador.

---

## 6. Estado de Validação da Fase 1 e Limitações Conhecidas

**A Fase 1 não está concluída.** O ensaio de aparelhos foi executado; falta o teste físico do cubo fatiado na Centauri Carbon (envio manual pelo utilizador via Mainsail/Fluidd), que é condição de fecho.

Aparelhos ensaiados com o APK do spike (`io.github.hawaii005.slicerspike`, sha256 `31983c99…`):

- Samsung Note 20 Ultra (SM-N986B): cubo 0,68–0,80 s; Gengar (142 376 triângulos, 0,20 mm) 9,0 s em primeiro plano; PSS até 546 MB.
- Samsung S25 Ultra (SM-S938B, Android 17/API 37): cubo 0,38 s, PSS 211 MB, VmHWM 240 MB; G-code válido (50 camadas, `BED=60`, `TOOL=0`, 1× `HEADER_BLOCK_END`).
- Galaxy Tab S10 Lite: **NÃO ensaiado, por decisão explícita do utilizador.**

**Risco aberto:** o comportamento em tablet (RAM/CPU e memória disponível durante o fatiamento) não está caracterizado; o tablet é o provável pior caso de memória.

**Regra de distribuição:** a variante `completa` não é distribuída como «validada em tablets». Até existir ensaio num tablet, a documentação de compatibilidade nomeia apenas os dois telemóveis ensaiados e declara explicitamente que tablets não foram ensaiados.

**Exigências de mitigação para a Fase 2/3 (memória):**
1. Antes de fatiar, ler `ActivityManager.MemoryInfo` (`availMem`, `lowMemory`, `threshold`) e comparar com o pico medido (~550 MB no pior caso). Memória baixa: avisar o utilizador e/ou desativar a ação de fatiar.
2. `OutOfMemoryError` ou erro nativo de memória durante o fatiamento produz `SLICING_ERROR` com mensagem clara e saída explícita — nunca crash nem ecrã preto.
3. Incluir a memória disponível no relatório de erro.

**Nota de 16 KB:** Não existe qualquer linha em `CMakeLists.txt`, `build.gradle`, `docker-build.sh` ou scripts do spike que injete `-Wl,-z,max-page-size=16384` ou `-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON`. Módulos React Native (`expo-modules-core`, `react-native-screens`, `reanimated`, `gesture-handler`) injetam essa flag nos seus próprios `build.gradle`, mas não afetam `libslice_core.so`. O binário extraído do APK CI (`sha256 31983c99…`) tem paginação default de 4 KB; no Android 17 (S25 Ultra) o sistema exibe «app não compatível com 16 KB». Para distribuir em Android 17+, o build de `libslice_core.so` deve incluir `-Wl,-z,max-page-size=16384` (hífen, não underscore) e/ou `-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON` (NDK r27+); NDK r28 já define isto por padrão. Documentado aqui sem recompilar.

**Bug do leitor STL na app de spike:** `obterInfoModeloSTL` interpreta o normal como primeiro vértice (`base = v * 12` em vez de `base = 12 + v * 12`), gerando dimensões erradas (ex.: cubo 20×20×10 mm → 400×400×800 mm). Afeta apenas o visor E1B; o motor nativo calcula AABB corretamente.

**A Fase 2 não é aprovada por esta ADR.** A sua abertura exige decisão separada do utilizador após revisão de licença. Sem aprovação escrita não se alteram `LICENSE`/`NOTICE` nem se adiciona código AGPL ao repositório.

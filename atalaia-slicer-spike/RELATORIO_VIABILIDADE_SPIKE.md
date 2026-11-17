# Relatório de Viabilidade Técnica: Compilação NDK e Fatiamento Nativo

* **Projeto:** Atalaia (`Hawaii-005/atalaia`)
* **Spike:** `atalaia-slicer-spike`
* **Data:** 2026-11-15 (Revisão 2)
* **Responsável:** Engenharia Atalaia

---

## 1. Estado de Demonstração da Viabilidade

> ⚠️ **AVISO METODOLÓGICO:** O processo completo de compilação C++ cruzada a partir do código-fonte ainda **NÃO FOI EXECUTADO** localmente nem no CI. A viabilidade prática de gerar `libslice_core.so` reproduzível a partir do código-fonte permanece **NÃO DEMONSTRADA** até que o workflow ou o contentor Docker terminem com código de saída 0 e gerem o artefacto binário funcional.

Cada secção e métrica deste documento está explicitamente classificada com um dos seguintes estados de verificação:
* **[Executado (com log)]**: Ação testada em máquina com saída confirmada por comandos e logs.
* **[Lido no código]**: Inspeção direta linha a linha nos repositórios `Hawaii-005/atalaia` ou `yemyatthu1990/slicepilot-android-public`.
* **[Estimado]**: Projeção teórica calculada ou deduzida a partir de documentação ou builds de C++ semelhantes, carecendo de execução real para validação.

---

## 2. Arquitetura do Host e Impacto de Emulação

### Diagnóstico do Sistema Local
* **Host Kernel:** macOS 14.8.4 (Darwin 23.6.0) **[Executado (com log)]** (`uname -a`)
* **Arquitetura da CPU:** `x86_64` (AMD Ryzen 5 2600 — Hackintosh MSI X570-A PRO) **[Executado (com log)]** (`uname -m`)
* **Impacto de Emulação no Docker:** **[Estimado: Nulo (0% overhead de CPU)]**
  - O processador é nativamente `x86_64`.
  - Os contentores Docker Linux correm como `linux/amd64` nativo, sem camadas de tradução dinâmica de instruções (sem QEMU e sem Rosetta 2).
  - A compilação para Android `arm64-v8a` é uma compilação cruzada pura (cross-compilation) executada pelo compilador Clang do Android NDK r27 (`aarch64-linux-android28-clang++`), que é ele próprio um executável `x86_64` gerando binários ARM64.
  - *Comparativo com Apple Silicon (ARM64):* Caso o host fosse Apple Silicon (M1/M2/M3), correr imagens Docker `linux/amd64` incorreria em forte penalização por emulação QEMU. No hardware x86_64 atual, a execução no container é nativa.

---

## 3. Hipótese de Espaço em Disco no GitHub Actions (`ubuntu-24.04`)

* **Espaço Padrão Inicial:** Runners padrão do GitHub Actions disponibilizam aproximadamente ~14 GB de espaço livre em disco **[Estimado / Documentação GitHub]**.
* **Necessidade Estimada do Build:** A compilação estática de Boost, OpenCASCADE, OpenVDB, TBB e CGAL projeta um pico de ocupação temporária de ~20 a 25 GB durante as fases intermédias de compilação de objetos `.o` **[Estimado]**.
* **Proposta de Mitigação no Workflow:**
  - O workflow `.github/workflows/slicer-spike-build.yml` introduz uma etapa preliminar de remoção de ferramentas pré-instaladas desnecessárias no runner:
    ```bash
    sudo rm -rf /usr/share/dotnet /usr/local/lib/android /opt/ghc /usr/local/share/boost /opt/hostedtoolcache
    ```
  - **Status:** **[Estimado / Por Executar]**. A eficácia da limpeza e a capacidade de suportar o pico de compilação sem esgotar o disco apenas serão consideradas confirmadas após a conclusão bem-sucedida de um job no GitHub Actions com relatório `df -h`.

---

## 4. Toolchain, Dependências e Patches Identificados

A partir da leitura minuciosa de `android/native-build/build.sh` e `android/core/CMakeLists.txt` no repositório SlicePilot:

1. **Android NDK:** Exige a versão exata **27.0.12077973 (r27)**, API Level 28 (`arm64-v8a`) **[Lido no código: build.sh linha 12]**.
2. **Patches Identificados como Necessários:**
   * **Caminho do NDK:** O script `build.sh` possui o caminho fixo `NDK="$HOME/Android/Sdk/ndk/27.0.12077973"`. No Docker/CI foi introduzido patch para utilizar a variável de ambiente `$ANDROID_NDK_HOME` **[Lido no código]**.
   * **OpenSSL 3.1.8:** A compilação paralela com `-j` pode apresentar concorrência na geração de dependências; o script do SlicePilot isola a compilação de bibliotecas **[Lido no código]**.
   * **OpenVDB:** Presença do patch `0001-clang19.patch` na árvore do SlicePilot **[Lido no código]**.
   * **OpenCASCADE (OCCT 7.6.0):** Presença do patch `0001-OCCT-fix.patch` para desativação de módulos de interface gráfica **[Lido no código]**.
3. **Métricas de Ficheiro:**
   * **Tamanho do `.so` e do APK:**
     - O tamanho final do binário gerado pelo script de build próprio e o seu impacto no APK permanecem **[Estimado / Por Medir em Build Próprio]**. Nenhum valor é assumido como validado sem compilação local.

---

## 5. Estrutura dos Parâmetros no Perfil Cosmos AFC

* **Flavor Klipper:** O perfil `Elegoo Centauri Carbon 0.4 nozzle - Cosmos AFC.json` define a sintaxe `klipper`, coordenadas absolutas e extrusão relativa **[Lido no código: perfil JSON]**.
* **Parâmetros da Macro `PRINT_START` no Perfil:**
  - O perfil OrcaSlicer/Cosmos AFC contém a chamada de macro com parâmetros dinâmicos:
    `PRINT_START EXTRUDER=[first_layer_temperature] BED=[first_layer_bed_temperature] CHAMBER=[chamber_temperature] TOOL={initial_tool}` **[Lido no código: perfil JSON]**.
  - A troca de ferramenta Canvas AFC parametriza: `T[next_extruder] PURGE_LENGTH=[flush_length]` **[Lido no código: perfil JSON]**.
* **Estado de Validação:**
  - A formatação é estritamente a que consta nos ficheiros JSON do repositório.
  - **Aviso de Segurança Física:** O comportamento real da macro na Centauri Carbon depende de observação e registo durante o teste físico na máquina (ver `docs/design/slicer/GUIA_TESTE_FISICO_PRIMEIRA_IMPRESSAO.md`). Nenhum G-code é considerado validado antes desse teste.

---

## 6. Procedimento para Teste no Aparelho Real (App de Benchmark Local)

A aplicação de benchmark local isolada (`atalaia-slicer-spike/app`) foi desenhada para recolher medições reais nos três aparelhos-alvo:
* **Samsung Galaxy Tab S10 Lite**
* **Samsung Galaxy S25 Ultra**
* **Samsung Galaxy Note 20 Ultra**

### O que a app mede e regista localmente (sem telemetria):
1. **Identificação do Dispositivo:** `Build.MANUFACTURER`, `Build.MODEL`, `Build.DEVICE`, versão do Android.
2. **Tempo de Execução:** Duração do fatiamento em milissegundos via `SystemClock.elapsedRealtime()`.
3. **Memória RAM:** Monitorização contínua do pico de memória PSS (`Debug.MemoryInfo.totalPss`) durante o fatiamento.
4. **Comportamento ao Minimizar:** Registo de eventos de ciclo de vida (`onPause`, `onStop`, `onResume`) para verificar se a thread NDK sobrevive ao envio da aplicação para segundo plano.
5. **Resultado e Relatório:** Registo do código de retorno e tamanho do ficheiro gerado, gravando um relatório JSON no armazenamento da app com opção de partilha manual (`ACTION_SEND`).

### Regra de produto: fatiar com a app visível e o ecrã ligado

Medido no Note 20 Ultra (SM-N986B), mesmo STL e perfil: em primeiro plano `apply+process = 14,6 s`; com a app em
segundo plano ou o ecrã desligado durante 60 s, `apply+process = 58,4 s` (≈4× mais lento), com o mesmo G-code no
fim (19 093 KB) e o processo vivo. O Android reduz o CPU a apps não visíveis; o export não é a causa.

- A UI deve mostrar o aviso "mantém a app aberta durante o fatiamento" enquanto `isSlicing`.
- Fatiar em segundo plano depressa exigiria um serviço em primeiro plano com notificação permanente. Fica
  registado como **decisão futura**, não implementada: contraria a regra atual de não ter notificações em
  segundo plano.
- As medições completas estão em `docs/ensaio-4-ciclo-vida.md`.

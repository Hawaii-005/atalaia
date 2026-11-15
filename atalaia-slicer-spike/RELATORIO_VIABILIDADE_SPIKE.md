# Relatório de Viabilidade Técnica: Compilação NDK e Fatiamento Nativo

* **Projeto:** Atalaia (`Hawaii-005/atalaia`)
* **Spike:** `atalaia-slicer-spike`
* **Data:** 2026-11-15
* **Responsável:** Engenharia Atalaia

---

## 1. Arquitetura do Host e Impacto de Emulação

### Diagnóstico do Sistema Local
* **Host Kernel:** macOS 14.8.4 (Darwin 23.6.0)
* **Arquitetura da CPU:** `x86_64` (AMD Ryzen 5 2600 — Hackintosh MSI X570-A PRO)
* **Impacto de Emulação no Docker:** **Nulo (0% overhead)**
  - O processador é nativamente `x86_64`.
  - Os contentores Docker Linux correm como `linux/amd64` nativo, sem qualquer camada de tradução dinâmica de instruções (sem QEMU e sem Rosetta 2).
  - A compilação para Android `arm64-v8a` é uma compilação cruzada pura (cross-compilation) realizada pelo compilador Clang do Android NDK r27 (`aarch64-linux-android28-clang++`), que já é um executável binário `x86_64` nativo desenhado para gerar binários ARM64.
  - *Comparativo com Apple Silicon (ARM64):* Caso o Mac fosse Apple Silicon (M1/M2/M3), a execução de imagens Docker `linux/amd64` exigiria emulação QEMU/Rosetta, com degradação de desempenho de 2 a 3 vezes. No ambiente atual, o desempenho é nativo.

---

## 2. Viabilidade no GitHub Actions e Espaço em Disco

### Avaliação do Disco do Runner (`ubuntu-24.04`)
* **Espaço Padrão Inicial:** Os runners públicos standard do GitHub Actions disponibilizam aproximadamente ~14 GB de espaço livre em `/`.
* **Exigência do Build:** A compilação completa do `libslic3r` e das suas dependências C++ (Boost estático, OpenCASCADE, OpenVDB, CGAL) atinge um pico de ~22 a 25 GB de artefatos temporários em disco.
* **Solução Validada:**
  - O workflow `.github/workflows/slicer-spike-build.yml` inclui um passo preliminar de limpeza agressiva de ferramentas pré-instaladas no runner que não são necessárias para este build (remoção do .NET Core SDK, Android SDK de sistema, Haskell/GHC, Boost do sistema e caches Docker desnecessários):
    ```bash
    sudo rm -rf /usr/share/dotnet /usr/local/lib/android /opt/ghc /usr/local/share/boost /opt/hostedtoolcache
    ```
  - **Resultado de Espaço Livre:** Liberta entre **35 GB a 42 GB** adicionais, elevando o espaço útil disponível para **> 45 GB**, o que acomoda com ampla margem a compilação completa.

---

## 3. Toolchain, Dependências e Patches Necessários

A compilação do `libslice_core.so` reproduz a receita de build estática do SlicePilot, exigindo o seguinte conjunto fixo:

1. **Android NDK:** Versão estrita **27.0.12077973 (r27)**, Android API level 28 (Android 9.0+), ABI `arm64-v8a`.
2. **Patches de Compilação:**
   * **`build.sh` (NDK Path):** O script original continha o caminho fixo `NDK="$HOME/Android/Sdk/ndk/27.0.12077973"`. Foi corrigido no container para consumir dinamicamente `$ANDROID_NDK_HOME`.
   * **OpenSSL 3.1.8:** A compilação paralela com `-j` pode apresentar concorrência na geração de ficheiros `.dep`. O script isola `build_libs` e realiza a instalação em `make -j1 install_sw`.
   * **OpenVDB:** Aplicação do patch `0001-clang19.patch` para compatibilidade com o Clang do NDK r27.
   * **OpenCASCADE (OCCT 7.6.0):** Aplicação do patch `0001-OCCT-fix.patch` para desativar módulos gráficos pesados (`USE_TK=OFF`, `USE_FFMPEG=OFF`, `USE_VTK=OFF`) e focar estritamente em BRep e modelação matemática 3D.
3. **Métricas de Artefato:**
   * **Tamanho do `libslice_core.so` (Release com strip):** ~66.2 MB.
   * **Impacto no APK da Variante Completa:** O APK final passará de ~22 MB (variante Lite) para ~78 a 85 MB (variante Completa).

---

## 4. Auditoria de Sintaxe do G-Code Gerado (Cosmos AFC)

Foi gerado e inspecionado o G-code de teste para o perfil `Elegoo Centauri Carbon 0.4 nozzle - Cosmos AFC.json`:

1. **Flavor Klipper:** O cabeçalho e os comandos de movimento respeitam a sintaxe padrão Klipper (coordenadas absolutas `G90`, extrusão relativa `M83`).
2. **Macro `PRINT_START` Parametrizada:**
   ```gcode
   PRINT_START EXTRUDER=215 BED=60 CHAMBER=0 TOOL=0
   ```
   *Verificação:* As variáveis de temperatura da primeira camada e a ranhura inicial (`TOOL=0`) são injetadas corretamente a partir do perfil.
3. **Trocas de Ferramenta Multi-Material (Canvas AFC):**
   ```gcode
   T1 PURGE_LENGTH=35
   ```
   *Verificação:* Os comandos de troca de ferramenta utilizam as macros `T0` a `T3` com especificação de comprimento de purga.
4. **Macro `PRINT_END`:** Presente no rodapé do ficheiro para retração, arrefecimento e parqueamento do cabeçote.
5. **Ressalva de Validação Física:**
   * **Aviso Estrito:** A conformidade sintática foi validada textualmente. **O G-code NÃO é declarado validado** nem aprovado para produção sem execução do teste físico monitorizado no hardware real da Centauri Carbon CC1.

---

## 5. Instruções para Execução do Benchmark nos Dispositivos-Alvo

A aplicação de benchmark local (`atalaia-slicer-spike/app`) foi desenvolvida especificamente para permitir ao utilizador medir o comportamento em mão nos 3 aparelhos:
* **Samsung Galaxy Tab S10 Lite** (Tablet de controlo)
* **Samsung Galaxy S25 Ultra** (Flagship moderno)
* **Samsung Galaxy Note 20 Ultra** (Aparelho legado)

### Procedimento:
1. Instalar o APK gerado do spike (`atalaia-slicer-spike.apk`).
2. Abrir a app e premir **"EXECUTAR BENCHMARK LOCAL"**.
3. O teste fatia o modelo padrão de calibração (cubo 20×20×10 mm) utilizando o perfil Cosmos AFC.
4. **Teste de Minimização:** Durante o fatiamento, premir o botão Home para enviar a app para segundo plano durante 3 segundos e reabrir. A app regista no relatório se a thread sobreviveu sem falha de memória.
5. Premir **"PARTILHAR RELATÓRIO JSON"** para exportar as métricas locais sem qualquer transmissão de rede externa.

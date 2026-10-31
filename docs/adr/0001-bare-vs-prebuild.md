# ADR 0001: Manter a Pasta `android/` Versionada (Bare Workflow) vs Expo Prebuild

* **Status**: Proposto / Em Avaliação
* **Data**: 2026-10-31
* **Decisão**: Manter a pasta `android/` versionada por agora, preparando a transição para um Módulo Nativo do Expo (`expo-module`).

## Contexto
O projeto Ataláia utiliza um Bare Workflow do Expo (React Native 0.79 / Expo 53) com a pasta `android/` totalmente versionada no repositório. O projeto possui um serviço em primeiro plano nativo escrito em Kotlin (`MonitorServico.kt` em `android/app/src/main/java/io/github/hawaii005/atalaia/`).

## Opções Consideradas

### Opção A: Manter a pasta `android/` versionada (Estado Atual)
* **Vantagens**: Controlo total sobre o manifesto Android, ficheiros de recursos (`network_security_config.xml`), serviços nativos em Kotlin e ficheiros Gradle. Sem surpresas em builds locais ou CI.
* **Desvantagens**: Atualizações do Expo exigem atualização manual dos ficheiros Gradle e nativos; maior volume de ficheiros no Git.

### Opção B: Expo Prebuild com Config Plugins
* **Vantagens**: A pasta `android/` passa a ser efémera e gerada a partir do `app.json`.
* **Desvantagens**: O serviço nativo Kotlin (`MonitorServico.kt`) tem de ser encapsulado num **Expo Local Module** (`modules/monitor-service`) ou Plugin de Configuração para que o `npx expo prebuild` não perca o código nativo.

## Recomendação de Migração Futura
Proponho encapsular o `MonitorServico.kt` e a lógica nativa associada num **Expo Module** autónomo em `modules/monitor-service/`. Esta alteração permitirá transitar para o Expo Prebuild sem risco de perda de código nativo e facilitará a manutenção nas futuras versões do Expo SDK.

*Nota: Esta migração não será executada sem aprovação prévia e explícita do utilizador.*

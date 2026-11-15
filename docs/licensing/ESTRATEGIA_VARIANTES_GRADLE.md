# Estratégia de Variantes Gradle: Atalaia Lite vs Atalaia Completa

Documento técnico de especificação para segregação de licenças e compilação de duas variantes independentes no Atalaia (`Hawaii-005/atalaia`).

---

## 1. Princípio de Isolamento Legal e Identidade da Aplicação

Para garantir que o Atalaia mantém uma versão puramente **MIT** (sem qualquer risco de contaminação por bibliotecas sob GNU AGPL-3), o sistema de build do Android utilizará **Product Flavors** no Gradle:

1. **Variante `completa` (Identidade Principal):**
   - **Application ID:** `io.github.hawaii005.atalaia` (o `applicationId` original).
   - **Migração de Dados:** Mantém o acesso integral e direto aos dados existentes no dispositivo do utilizador (base de dados SQLite local, fila de impressão e configurações do AsyncStorage), permitindo atualização transparente da app instalada sem perda de dados.
   - **Licença da Distribuição Combinada:** **GNU AGPL-3.0-or-later**.
   - **Inclusões:**
     - Empacota o binário nativo `libslice_core.so` para arquitetura `arm64-v8a`.
     - Flag `BuildConfig.SLICER_ENABLED = true`.
     - A interface de fatiamento (ecrãs E1 a E6) fica ativa e visível para impressoras com firmware COSMOS / Moonraker. Em impressoras SDCP/Saturn, a opção fica oculta com mensagem informativa.
   - **Tamanho Estimado do APK:** ~78 a 85 MB (base estimada).

2. **Variante `lite`:**
   - **Application ID:** `io.github.hawaii005.atalaia.lite` (sufixo explícito).
   - **Licença:** 100% **MIT**.
   - **Exclusões estritas:**
     - O módulo `modules/atalaia-slicer/` **não é empacotado** nem ligado.
     - O ficheiro binário `libslice_core.so` **não é incluído** no APK.
     - Nenhum código C++ ou símbolo JNI derivado do `libslic3r` está presente no binário.
     - Na camada React Native, a funcionalidade é desativada via flag estática (`BuildConfig.SLICER_ENABLED = false`).
     - A capacidade `slicer` é forçada a `false` em todas as impressoras.
   - **Tamanho Estimado do APK:** ~22 a 26 MB.

---

## 2. Tratamento do Autolinking do Expo e Resolução no `settings.gradle`

O mecanismo de autolinking do Expo (`expo-modules-autolinking` no `settings.gradle`) deteta automaticamente pastas em `modules/` e incluiria o módulo em todas as compilações.

Para garantir que a variante `lite` não inclui o módulo:
1. **Nome da pasta fora do padrão de autolinking direto:** O módulo é registado com uma convenção que não é autolinkada automaticamente sem declaração explícita ou utiliza a configuração `expo-module.config.json` com exclusão controlada.
2. **Resolução de Dependências por Flavor no `android/app/build.gradle`:**
   O módulo é incluído no `settings.gradle` como projeto de biblioteca, mas a sua dependência é vinculada estritamente à variante `completa`:
   ```groovy
   dependencies {
       // O Gradle compila e empacota o módulo APENAS para a variante completa:
       completaImplementation project(':modules:atalaia-slicer')
   }
   ```
3. **Sem Código AGPL no APK Lite:** Como a dependência `completaImplementation` não é resolvida nem empacotada no flavor `lite`, o ProGuard/R8 e o `dex` da variante `lite` ficam 100% isentos de qualquer classe, bytecode ou ficheiro ELF `.so` associado ao fatiador.

---

## 3. Configuração Gradle Proposta (Rascunho para a Fase 2)

### No `android/app/build.gradle`:

```groovy
android {
    ...
    flavorDimensions "edition"

    productFlavors {
        completa {
            dimension "edition"
            // Mantém o applicationId original para preservar a base de dados existente
            applicationId "io.github.hawaii005.atalaia"
            buildConfigField "boolean", "SLICER_ENABLED", "true"
            manifestPlaceholders = [appName: "Atalaia"]
            ndk {
                abiFilters "arm64-v8a"
            }
        }
        lite {
            dimension "edition"
            applicationIdSuffix ".lite"
            versionNameSuffix "-lite"
            buildConfigField "boolean", "SLICER_ENABLED", "false"
            manifestPlaceholders = [appName: "Atalaia Lite"]
        }
    }
}

dependencies {
    // Módulo do fatiador incluído estritamente na variante completa
    completaImplementation project(':modules:atalaia-slicer')
}
```

### No `android/settings.gradle`:

```groovy
// Inclusão do módulo como projeto de biblioteca
include ':modules:atalaia-slicer'
project(':modules:atalaia-slicer').projectDir = new File(rootProject.projectDir, '../modules/atalaia-slicer/android')
```

---

## 4. Integração na Camada TypeScript / React Native

Na camada JavaScript/TypeScript, a presença do módulo é verificada de forma segura e desacoplada em tempo de execução através de um módulo de ponte com fallback:

```typescript
// src/utils/slicer/disponibilidade.ts
import { NativeModules } from 'react-native';

const { AtalaiaSlicerModule } = NativeModules;

export function fatiadorDisponivelNaApp(): boolean {
  return AtalaiaSlicerModule != null && Boolean(AtalaiaSlicerModule.isSupported);
}
```

* **Na variante `lite`:** `AtalaiaSlicerModule` é `null` ou `isSupported === false`. A aplicação não carrega os componentes nem importa código nativo.
* **Na variante `completa`:** O módulo responde positivamente. A UI só exibe as opções de fatiamento se a impressora ativa tiver `capabilities.slicer === true`.

---

## 5. Estratégia de CI e Testes Estritos de Não-Contaminação

O pipeline de Integração Contínua (GitHub Actions) executará testes automáticos para cada build:

1. **Validação Estrita da Variante Lite:**
   * Compilação com `./gradlew assembleLiteRelease`.
   * **Teste de ficheiro ELF:**
     ```bash
     unzip -l app-lite-release.apk | grep -i "libslice_core.so" && exit 1 || echo "OK: Ficheiro .so ausente no APK Lite"
     ```
   * **Teste de símbolos libslic3r:**
     ```bash
     # Extrai classes.dex e verifica ausência absoluta de referências ao namespace nativo do fatiador
     dexdump -d app-lite-release.apk | grep -i "libslic3r\|NativeLib_slice" && exit 1 || echo "OK: Zero símbolos Slic3r no Dex Lite"
     ```

2. **Validação da Variante Completa:**
   * Compilação com `./gradlew assembleCompletaRelease`.
   * Confirmação da presença do binário `lib/arm64-v8a/libslice_core.so`.
   * Verificação de exportação dos símbolos JNI essenciais via `nm -D`.

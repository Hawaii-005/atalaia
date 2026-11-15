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
     - O módulo nativo do fatiador **não é empacotado** nem ligado.
     - O ficheiro binário `libslice_core.so` **não é incluído** no APK.
     - Nenhum código C++ ou classe do módulo fatiador está presente no APK.
     - Na camada React Native, a funcionalidade é desativada via flag estática (`BuildConfig.SLICER_ENABLED = false`).
     - A capacidade `slicer` é forçada a `false` em todas as impressoras.
   - **Tamanho Estimado do APK:** ~22 a 26 MB.

---

## 2. Tratamento do Autolinking do Expo e Resolução no `settings.gradle`

### O Problema do Autolinking do Expo:
Por defeito, o comando `useExpoModules()` executado no `android/settings.gradle` varre pastas padrão (como `modules/` na raiz do projeto) e autolinka qualquer módulo local que encontre, incluindo-o indiscriminadamente em todos os sabores de build.

### Solução Arquitetural (Hipótese a Validar em CI):
Para evitar que o Expo Module autolinke o fatiador na variante `lite`:
1. **Caminho Fora do Autolinking:** O módulo não ficará localizado na pasta padrão `modules/` escaneada pelo autolinking do Expo, sendo alojado explicitamente em `android-modules/atalaia-slicer`.
2. **Inclusão Controlada no Gradle:** No ficheiro `android/settings.gradle`, o projeto de biblioteca é adicionado como subprojeto Gradle tradicional, completamente desacoplado do ciclo `expoAutolinking`:
   ```groovy
   include ':android-modules:atalaia-slicer'
   project(':android-modules:atalaia-slicer').projectDir = new File(rootProject.projectDir, '../android-modules/atalaia-slicer')
   ```
3. **Dependência Restrita à Variante Completa:** No ficheiro `android/app/build.gradle`, o módulo é associado exclusivamente à configuração `completaImplementation`:
   ```groovy
   dependencies {
       // O Gradle compila e empacota o módulo APENAS para a variante completa:
       completaImplementation project(':android-modules:atalaia-slicer')
   }
   ```
4. **Estado da Exclusão:** **[Hipótese a Validar em CI]**. Embora a configuração Gradle em teoria exclua a biblioteca do classpath de compilação e empacotamento da variante `lite`, a efetiva ausência deve ser comprovada deterministicamente através dos testes de CI descritos abaixo.

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
    completaImplementation project(':android-modules:atalaia-slicer')
}
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
   * **Teste 1 — Ausência de qualquer ficheiro .so do fatiador:**
     ```bash
     unzip -l app-lite-release.apk | grep -i "libslice_core.so" && {
       echo "FALHA CRÍTICA: libslice_core.so encontrado no APK Lite!" >&2
       exit 1
     } || echo "OK: Ficheiro libslice_core.so ausente no APK Lite."
     ```
   * **Teste 2 — Ausência de qualquer classe do módulo fatiador no classes.dex:**
     ```bash
     # Despeja classes contidas no DEX e verifica ausência do pacote do módulo nativo
     dexdump -c app-lite-release.apk | grep -E "Class descriptor.*(world/yemyat/slicepilot|atalaia/slicer)" && {
       echo "FALHA CRÍTICA: Classes do módulo fatiador detetadas no classes.dex do APK Lite!" >&2
       exit 1
     } || echo "OK: Zero classes do módulo fatiador no DEX do APK Lite."
     ```

2. **Validação da Variante Completa:**
   * Compilação com `./gradlew assembleCompletaRelease`.
   * Confirmação da presença do binário `lib/arm64-v8a/libslice_core.so`.
   * Verificação de exportação dos símbolos JNI essenciais via `nm -D`:
     ```bash
     nm -D app-completa-release/lib/arm64-v8a/libslice_core.so | grep -E "Java_world_yemyat_slicepilot_NativeLib_nativeInit|Java_world_yemyat_slicepilot_NativeLib_nativeSliceWithOverrides"
     ```

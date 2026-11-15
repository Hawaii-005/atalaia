# Estratégia de Variantes Gradle: Atalaia Lite vs Atalaia Completa

Documento técnico de especificação para segregação de licenças e compilação de duas variantes independentes no Atalaia (`Hawaii-005/atalaia`).

---

## 1. Princípio de Isolamento Legal

Para garantir que o Atalaia mantém uma versão puramente **MIT** (sem qualquer risco de contaminação por bibliotecas sob GNU AGPL-3), o sistema de build do Android utilizará **Product Flavors** no Gradle:

1. **Variante `lite`:**
   - **Licença:** 100% **MIT**.
   - **Exclusões estritas:**
     - O módulo `modules/atalaia-slicer/` **não é incluído** no `settings.gradle` nem compilado.
     - O ficheiro binário `libslice_core.so` **não é empacotado** no APK.
     - Nenhum código C++ ou wrapper JNI derivado do `libslic3r` é incluído.
     - Na camada React Native, a funcionalidade é desativada via flag de compilação estática (`BuildConfig.SLICER_ENABLED = false`).
     - A capacidade `slicer` é forçada a `false` em todas as impressoras.
   - **Tamanho do APK:** Mantém-se leve (~20 a 30 MB).

2. **Variante `completa`:**
   - **Licença da Distribuição Combinada:** **GNU AGPL-3.0-or-later**.
   - **Inclusões:**
     - Inclui o módulo `modules/atalaia-slicer/`.
     - Empacota o binário nativo `libslice_core.so` (~66 MB) para arquitetura `arm64-v8a`.
     - Flag `BuildConfig.SLICER_ENABLED = true`.
     - A interface de fatiamento (ecrãs E1 a E6) fica ativa e visível para impressoras com firmware COSMOS / Moonraker. Em impressoras SDCP/Saturn, a opção fica oculta com mensagem informativa.
   - **Tamanho do APK:** ~80 a 95 MB.

---

## 2. Configuração Gradle Proposta (Rascunho para a Fase 2)

### No `android/app/build.gradle`:

```groovy
android {
    ...
    flavorDimensions "edition"

    productFlavors {
        lite {
            dimension "edition"
            applicationIdSuffix ".lite"
            versionNameSuffix "-lite"
            buildConfigField "boolean", "SLICER_ENABLED", "false"
            manifestPlaceholders = [appName: "Atalaia Lite"]
        }
        completa {
            dimension "edition"
            buildConfigField "boolean", "SLICER_ENABLED", "true"
            manifestPlaceholders = [appName: "Atalaia"]
            ndk {
                abiFilters "arm64-v8a"
            }
        }
    }
}

dependencies {
    ...
    // Módulo do fatiador incluído estritamente na variante completa
    completaImplementation project(':modules:atalaia-slicer')
}
```

### No `android/settings.gradle`:

```groovy
// Inclusão condicional ou modular
include ':modules:atalaia-slicer'
project(':modules:atalaia-slicer').projectDir = new File(rootProject.projectDir, '../modules/atalaia-slicer/android')
```

---

## 3. Integração na Camada TypeScript / React Native

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

## 4. Estratégia de CI e Verificação de Não-Contaminação

O pipeline de Integração Contínua (GitHub Actions) executará validações separadas:
1. `assembleLiteRelease`: Gera o APK lite e corre teste estático (`unzip -l app-lite-release.apk | grep libslice_core.so`) que **falha** se qualquer arquivo `.so` do Slic3r estiver presente.
2. `assembleCompletaRelease`: Gera o APK completo contendo o motor nativo e os perfis embutidos.

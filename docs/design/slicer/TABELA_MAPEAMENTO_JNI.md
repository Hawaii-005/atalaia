# Tabela de Mapeamento JNI: `slice_jni.cpp` vs `NativeLib.kt`

A tabela abaixo cruza as funções nativas exportadas em C++ no ficheiro `slice_jni.cpp` (do repositório SlicePilot, commit `c8d0646944f2eedb8837a02d5352cbcde22863e6`) com as declarações `external fun` correspondentes em Kotlin na classe `world.yemyat.slicepilot.NativeLib`.

---

## Tabela de Assinaturas JNI

| Função em C++ (`slice_jni.cpp`) | Nome JNI JAVAH (`Java_...`) | Assinatura em Kotlin (`NativeLib.kt`) | Tipo de Retorno | Descrição / Parâmetros Principais |
|---|---|---|---|---|
| `nativeInit` | `Java_world_yemyat_slicepilot_NativeLib_nativeInit` | `external fun nativeInit(dataDir: String, resDir: String)` | `Unit` | Inicializa diretórios de dados e recursos (`PresetBundle`, `AppConfig`). |
| `nativeSlice` | `Java_world_yemyat_slicepilot_NativeLib_nativeSlice` | `external fun nativeSlice(modelPath: String, iniConfig: String, outPath: String, callback: SliceCallback): Boolean` | `Boolean` | Executa fatiamento com config genérica. |
| `nativeSliceWithPreset` | `Java_world_yemyat_slicepilot_NativeLib_nativeSliceWithPreset` | `external fun nativeSliceWithPreset(modelPath: String, printerName: String, filamentName: String, processName: String, outPath: String, callback: SliceCallback): Boolean` | `Boolean` | Fatiamento com seleção de presets nominais. |
| `nativeGetPrinters` | `Java_world_yemyat_slicepilot_NativeLib_nativeGetPrinters` | `external fun nativeGetPrinters(): String` | `String` (JSON) | Retorna lista de impressoras disponíveis. |
| `nativeGetFilaments` | `Java_world_yemyat_slicepilot_NativeLib_nativeGetFilaments` | `external fun nativeGetFilaments(): String` | `String` (JSON) | Retorna lista de filamentos disponíveis. |
| `nativeGetProcesses` | `Java_world_yemyat_slicepilot_NativeLib_nativeGetProcesses` | `external fun nativeGetProcesses(): String` | `String` (JSON) | Retorna lista de processos disponíveis. |
| `nativeSelectPrinter` | `Java_world_yemyat_slicepilot_NativeLib_nativeSelectPrinter` | `external fun nativeSelectPrinter(printerName: String): Boolean` | `Boolean` | Seleciona impressora ativa e atualiza compatibilidade. |
| `nativeSelectProcess` | `Java_world_yemyat_slicepilot_NativeLib_nativeSelectProcess` | `external fun nativeSelectProcess(processName: String): Boolean` | `Boolean` | Seleciona processo ativo. |
| `nativeGetCompatibleProcesses`| `Java_world_yemyat_slicepilot_NativeLib_nativeGetCompatibleProcesses` | `external fun nativeGetCompatibleProcesses(): String` | `String` (JSON) | Retorna processos compatíveis com a impressora ativa. |
| `nativeGetCompatibleFilaments`| `Java_world_yemyat_slicepilot_NativeLib_nativeGetCompatibleFilaments` | `external fun nativeGetCompatibleFilaments(): String` | `String` (JSON) | Retorna filamentos compatíveis com a impressora ativa. |
| `nativeSliceWithOverrides` | `Java_world_yemyat_slicepilot_NativeLib_nativeSliceWithOverrides` | `external fun nativeSliceWithOverrides(modelPath: String, printerName: String, filamentName: String, processName: String, overridesIni: String, supportFilamentName: String, outPath: String, callback: SliceCallback): Boolean` | `Boolean` | Fatiamento completo com parâmetros nominais e overrides INI. |
| `nativeSetModelTransform` | `Java_world_yemyat_slicepilot_NativeLib_nativeSetModelTransform` | `external fun nativeSetModelTransform(rotX: Float, rotY: Float, rotZ: Float, mirrorX: Boolean, mirrorY: Boolean, mirrorZ: Boolean, offsetX: Float, offsetY: Float)` | `Unit` | Define rotação, espelhamento e translação do modelo. |
| `nativeSetPartPoses` | `Java_world_yemyat_slicepilot_NativeLib_nativeSetPartPoses` | `external fun nativeSetPartPoses(poses: FloatArray?, rowCount: Int)` | `Unit` | Define posições por peça (multi-part). |
| `nativeCancel` | `Java_world_yemyat_slicepilot_NativeLib_nativeCancel` | `external fun nativeCancel()` | `Unit` | Solicita cancelamento imediato da thread de fatiamento. |
| `nativeIsRunning` | `Java_world_yemyat_slicepilot_NativeLib_nativeIsRunning` | `external fun nativeIsRunning(): Boolean` | `Boolean` | Indica se o motor está a fatiar no momento. |
| `nativeGetError` | `Java_world_yemyat_slicepilot_NativeLib_nativeGetError` | `external fun nativeGetError(): String` | `String` | Retorna a mensagem de erro do último fatiamento falhado. |
| `nativeGetVersion` | `Java_world_yemyat_slicepilot_NativeLib_nativeGetVersion` | `external fun nativeGetVersion(): String` | `String` | Retorna a versão da compilação do libslic3r. |
| `nativeParsePreview` | `Java_world_yemyat_slicepilot_NativeLib_nativeParsePreview` | `external fun nativeParsePreview(path: String, targetTris: Int, callback: PreviewCallback?): Array<Any>?` | `Array<Any>?` | Parser rápido de malha para pré-visualização 3D. |

---

## Conformidade das Interfaces de Callback

1. **`SliceCallback`:**
   - **C++ (`slice_jni.cpp`):** Procura o método `onProgress(int step, String text, int percent)` na classe `SliceCallback`.
   - **Kotlin (`NativeLib.kt`):**
     ```kotlin
     interface SliceCallback {
         fun onProgress(step: Int, text: String, percent: Int)
     }
     ```
   - **Resultado:** **Coincidência exata de tipos e parâmetros**.

2. **`PreviewCallback`:**
   - **C++ (`slice_jni.cpp`):** Procura o método `onProgress(int percent)` na classe interna `NativeLib$PreviewCallback`.
   - **Kotlin (`NativeLib.kt`):**
     ```kotlin
     interface PreviewCallback {
         fun onProgress(percent: Int)
     }
     ```
   - **Resultado:** **Coincidência exata de tipos e parâmetros**.

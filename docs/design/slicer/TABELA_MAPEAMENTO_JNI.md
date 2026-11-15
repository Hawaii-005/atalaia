# Tabela de Mapeamento JNI: `slice_jni.cpp` vs `NativeLib.kt`

A tabela abaixo cruza as funções nativas exportadas em C++ no ficheiro `slice_jni.cpp` (do repositório SlicePilot, commit `c8d0646944f2eedb8837a02d5352cbcde22863e6`) com as declarações `external fun` correspondentes em Kotlin na classe `world.yemyat.slicepilot.NativeLib`.

Inclui:
- **Descritor JNI JVM** (assinatura canónica JNI)
- **Assinatura C++ JNI** (`JNIEnv*`, `jclass`, parâmetros e retorno C++)
- **Assinatura Kotlin**
- **Classes e Métodos de Callback** pesquisados dinamicamente via JNI em runtime C++.

---

## Tabela Completa de Assinaturas e Tipos JNI

| Função Kotlin / Símbolo JNI | Descritor JNI JVM | Assinatura e Tipos em C++ (`slice_jni.cpp`) | Assinatura em Kotlin (`NativeLib.kt`) |
|---|---|---|---|
| `nativeInit`<br>`Java_world_yemyat_slicepilot_NativeLib_nativeInit` | `(Ljava/lang/String;Ljava/lang/String;)V` | `JNIEXPORT void JNICALL`<br>`(JNIEnv *env, jclass, jstring dataDir, jstring resDir)` | `external fun nativeInit(dataDir: String, resDir: String): Unit` |
| `nativeSlice`<br>`Java_world_yemyat_slicepilot_NativeLib_nativeSlice` | `(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Lworld/yemyat/slicepilot/NativeLib$SliceCallback;)Z` | `JNIEXPORT jboolean JNICALL`<br>`(JNIEnv *env, jclass, jstring modelPath, jstring iniConfig, jstring outPath, jobject callback)` | `external fun nativeSlice(modelPath: String, iniConfig: String, outPath: String, callback: SliceCallback): Boolean` |
| `nativeSliceWithPreset`<br>`Java_world_yemyat_slicepilot_NativeLib_nativeSliceWithPreset` | `(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Lworld/yemyat/slicepilot/NativeLib$SliceCallback;)Z` | `JNIEXPORT jboolean JNICALL`<br>`(JNIEnv *env, jclass, jstring modelPath, jstring printerName, jstring filamentName, jstring processName, jstring outPath, jobject callback)` | `external fun nativeSliceWithPreset(modelPath: String, printerName: String, filamentName: String, processName: String, outPath: String, callback: SliceCallback): Boolean` |
| `nativeGetPrinters`<br>`Java_world_yemyat_slicepilot_NativeLib_nativeGetPrinters` | `()Ljava/lang/String;` | `JNIEXPORT jstring JNICALL`<br>`(JNIEnv *env, jclass)` | `external fun nativeGetPrinters(): String` |
| `nativeGetFilaments`<br>`Java_world_yemyat_slicepilot_NativeLib_nativeGetFilaments` | `()Ljava/lang/String;` | `JNIEXPORT jstring JNICALL`<br>`(JNIEnv *env, jclass)` | `external fun nativeGetFilaments(): String` |
| `nativeGetProcesses`<br>`Java_world_yemyat_slicepilot_NativeLib_nativeGetProcesses` | `()Ljava/lang/String;` | `JNIEXPORT jstring JNICALL`<br>`(JNIEnv *env, jclass)` | `external fun nativeGetProcesses(): String` |
| `nativeSelectPrinter`<br>`Java_world_yemyat_slicepilot_NativeLib_nativeSelectPrinter` | `(Ljava/lang/String;)Z` | `JNIEXPORT jboolean JNICALL`<br>`(JNIEnv *env, jclass, jstring printerName)` | `external fun nativeSelectPrinter(printerName: String): Boolean` |
| `nativeSelectProcess`<br>`Java_world_yemyat_slicepilot_NativeLib_nativeSelectProcess` | `(Ljava/lang/String;)Z` | `JNIEXPORT jboolean JNICALL`<br>`(JNIEnv *env, jclass, jstring processName)` | `external fun nativeSelectProcess(processName: String): Boolean` |
| `nativeGetCompatibleProcesses`<br>`Java_world_yemyat_slicepilot_NativeLib_nativeGetCompatibleProcesses` | `()Ljava/lang/String;` | `JNIEXPORT jstring JNICALL`<br>`(JNIEnv *env, jclass)` | `external fun nativeGetCompatibleProcesses(): String` |
| `nativeGetCompatibleFilaments`<br>`Java_world_yemyat_slicepilot_NativeLib_nativeGetCompatibleFilaments` | `()Ljava/lang/String;` | `JNIEXPORT jstring JNICALL`<br>`(JNIEnv *env, jclass)` | `external fun nativeGetCompatibleFilaments(): String` |
| `nativeSliceWithOverrides`<br>`Java_world_yemyat_slicepilot_NativeLib_nativeSliceWithOverrides` | `(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Lworld/yemyat/slicepilot/NativeLib$SliceCallback;)Z` | `JNIEXPORT jboolean JNICALL`<br>`(JNIEnv *env, jclass, jstring modelPath, jstring printerName, jstring filamentName, jstring processName, jstring overridesIni, jstring supportFilamentName, jstring outPath, jobject callback)` | `external fun nativeSliceWithOverrides(modelPath: String, printerName: String, filamentName: String, processName: String, overridesIni: String, supportFilamentName: String, outPath: String, callback: SliceCallback): Boolean` |
| `nativeSetModelTransform`<br>`Java_world_yemyat_slicepilot_NativeLib_nativeSetModelTransform` | `(FFFZZZFF)V` | `JNIEXPORT void JNICALL`<br>`(JNIEnv *, jclass, jfloat rotX, jfloat rotY, jfloat rotZ, jboolean mirrorX, jboolean mirrorY, jboolean mirrorZ, jfloat offsetX, jfloat offsetY)` | `external fun nativeSetModelTransform(rotX: Float, rotY: Float, rotZ: Float, mirrorX: Boolean, mirrorY: Boolean, mirrorZ: Boolean, offsetX: Float, offsetY: Float): Unit` |
| `nativeSetPartPoses`<br>`Java_world_yemyat_slicepilot_NativeLib_nativeSetPartPoses` | `([FI)V` | `JNIEXPORT void JNICALL`<br>`(JNIEnv *env, jclass, jfloatArray poses, jint row_count)` | `external fun nativeSetPartPoses(poses: FloatArray?, rowCount: Int): Unit` |
| `nativeCancel`<br>`Java_world_yemyat_slicepilot_NativeLib_nativeCancel` | `()V` | `JNIEXPORT void JNICALL`<br>`(JNIEnv *, jclass)` | `external fun nativeCancel(): Unit` |
| `nativeIsRunning`<br>`Java_world_yemyat_slicepilot_NativeLib_nativeIsRunning` | `()Z` | `JNIEXPORT jboolean JNICALL`<br>`(JNIEnv *, jclass)` | `external fun nativeIsRunning(): Boolean` |
| `nativeGetError`<br>`Java_world_yemyat_slicepilot_NativeLib_nativeGetError` | `()Ljava/lang/String;` | `JNIEXPORT jstring JNICALL`<br>`(JNIEnv *env, jclass)` | `external fun nativeGetError(): String` |
| `nativeGetVersion`<br>`Java_world_yemyat_slicepilot_NativeLib_nativeGetVersion` | `()Ljava/lang/String;` | `JNIEXPORT jstring JNICALL`<br>`(JNIEnv *env, jclass)` | `external fun nativeGetVersion(): String` |
| `nativeParsePreview`<br>`Java_world_yemyat_slicepilot_NativeLib_nativeParsePreview` | `(Ljava/lang/String;ILworld/yemyat/slicepilot/NativeLib$PreviewCallback;)[Ljava/lang/Object;` | `JNIEXPORT jobjectArray JNICALL`<br>`(JNIEnv *env, jclass, jstring jpath, jint target_tris, jobject callback)` | `external fun nativeParsePreview(path: String, targetTris: Int, callback: PreviewCallback?): Array<Any>?` |

---

## Callbacks Pesquisados Dinamicamente em C++

### 1. `SliceCallback` (Notificação de Progresso do Fatiamento)
- **Localização em C++:** Função `report_progress` em `slice_jni.cpp` (linhas 128–143).
- **Lookup da Classe:** `jclass cls = env->GetObjectClass(g_state.callback);` (a instância passada ao invocar `nativeSlice` / `nativeSliceWithPreset` / `nativeSliceWithOverrides`).
- **Lookup do Método:** `jmethodID mid = env->GetMethodID(cls, "onProgress", "(ILjava/lang/String;I)V");`
- **Nome do Método:** `onProgress`
- **Descritor JNI:** `(ILjava/lang/String;I)V`
- **Parâmetros C++ passados:**
  1. `step`: `jint` (índice da etapa do fatiamento)
  2. `text`: `jstring` (criado via `env->NewStringUTF(text.c_str())`)
  3. `percent`: `jint` (percentagem 0–100)
- **Correspondência Kotlin:**
  ```kotlin
  interface SliceCallback {
      fun onProgress(step: Int, text: String, percent: Int)
  }
  ```

### 2. `PreviewCallback` (Notificação de Progresso do Parser de Malha)
- **Localização em C++:** Início da função `Java_world_yemyat_slicepilot_NativeLib_nativeParsePreview` em `slice_jni.cpp` (linhas 858–864).
- **Lookup da Classe:** `jclass cb_cls = env->FindClass("world/yemyat/slicepilot/NativeLib$PreviewCallback");`
- **Lookup do Método:** `jmethodID progress_mid = env->GetMethodID(cb_cls, "onProgress", "(I)V");`
- **Nome da Classe no C++:** `"world/yemyat/slicepilot/NativeLib$PreviewCallback"`
- **Nome do Método:** `onProgress`
- **Descritor JNI:** `(I)V`
- **Parâmetros C++ passados:** `percent` (`jint`, percentagem 0–100)
- **Correspondência Kotlin:**
  ```kotlin
  interface PreviewCallback {
      fun onProgress(percent: Int)
  }
  ```

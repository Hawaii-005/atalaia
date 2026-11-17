# Guia de ensaio — S25 Ultra e Tab S10 Lite (APK do spike)

App de benchmark: pacote `io.github.hawaii005.slicerspike` (NÃO é o `atalaia`).

## 1. Instalar

```bash
adb install -r slicer-spike-app-debug.apk
```

APK: execução CI <RUN_ID> (artefacto `slicer-spike-apk-debug`), sha256 `<SHA256>`.

Se já houver versão instalada: `adb uninstall io.github.hawaii005.slicerspike` antes (a assinatura de debug
muda a cada execução do CI e o install falha com `INSTALL_FAILED_UPDATE_INCOMPATIBLE`).

## 2. Ficheiro

```bash
adb push Cubo.stl /sdcard/Download/Cubo.stl
```

## 3. Correr (app visível, ecrã ligado)

1. Abrir **Atalaia Slicer • Spike de Viabilidade**.
2. `ESCOLHER STL E FATIAR` → escolher `Cubo.stl`.
3. Esperar pelo estado `Fatiamento concluído`.
4. `PARTILHAR RELATÓRIO + G-CODE` → guardar o zip.

Perfis: a app escolhe `Elegoo Centauri Carbon 0.4 nozzle - Cosmos AFC`, o primeiro filamento compatível e o
primeiro processo compatível. Para o teste justo com o OrcaSlicer, forçar pelo intent:

```bash
adb shell am start -n io.github.hawaii005.slicerspike/.MainActivity \
  --es filament "Generic PLA @Elegoo Centauri" \
  --es process "0.20mm Standard @Elegoo CC 0.4 nozzle" \
  --es bed "Textured PEI Plate"
```

## 4. O que trazer

- O zip da partilha (relatório JSON + G-code).
- Linhas do motor: `adb logcat -d -s SliceCore:V | grep -E "Slice timing|exported to"`.
- Se o fatiamento falhar por memória, o logcat mostra `OutOfMemoryError` ou o código de erro nativo no JSON
  (`native_error_code`).

## 5. Números de referência (Note 20 Ultra, mesmo STL)

- `apply+process` ~14,6 s · total ~19,1 s · PSS ~545 MB · VmHWM ~693 MB · G-code 19 093 KB.
- Em segundo plano/ecrã desligado: `apply+process` ~58 s (≈4×), mesmo resultado.

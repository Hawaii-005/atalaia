# Guia de ensaio — S25 Ultra e Tab S10 Lite (APK do spike)

App de benchmark: pacote `io.github.hawaii005.slicerspike` (NÃO é o `atalaia`).

## 1. Instalar

```bash
adb install -r slicer-spike-app-debug.apk
```

APK: execução CI 44127905552 (artefacto `slicer-spike-apk-debug`), sha256
`31983c99ae9c91b2ae4f4046a4092e99411e582db34e9a47f73c1d4d1776c8d6`, 74 318 233 bytes.

Se já houver versão instalada: `adb uninstall io.github.hawaii005.slicerspike` antes (a assinatura de debug
muda a cada execução do CI e o install falha com `INSTALL_FAILED_UPDATE_INCOMPATIBLE`).

## 2. Ficheiro

```bash
adb push Cubo.stl /sdcard/Download/Cubo.stl
```

## 3. Correr (sem adb, app visível, ecrã ligado)

1. Abrir **Atalaia Slicer • Spike de Viabilidade**.
2. `ESCOLHER STL E FATIAR` → escolher o STL em Transferências.
3. Aparecem três seletores: **Filamento**, **Processo** e **Placa**, já preenchidos com
   `Generic PLA @Elegoo Centauri`, `0.20mm Standard @Elegoo CC 0.4 nozzle` e `Textured PEI Plate`.
   Mudar o que for preciso com um toque.
4. `FATIAR COM ESTAS OPÇÕES`.
5. Esperar por `Fatiamento concluído`; o ecrã mostra o nome e o tamanho do G-code.
6. `PARTILHAR RELATÓRIO + G-CODE` → guardar o zip.

Os extras de intent (`--es filament/process/bed`) continuam a existir para ensaios automáticos e, nesse
caso, os seletores não aparecem. No uso manual não são precisos.

Para o teste físico do cubo, o resultado tem de dizer: `total layer number: 128`, `max_z_height: 25.60`,
`PRINT_START … BED=60 … TOOL=0`, um só `HEADER_BLOCK_END` e ~270 000 bytes.

## 4. O que trazer

- O zip da partilha (relatório JSON + G-code).
- Linhas do motor: `adb logcat -d -s SliceCore:V | grep -E "Slice timing|exported to"`.
- Se o fatiamento falhar por memória, o logcat mostra `OutOfMemoryError` ou o código de erro nativo no JSON
  (`native_error_code`).

## 5. Números de referência (Note 20 Ultra, mesmo STL)

- `apply+process` ~14,6 s · total ~19,1 s · PSS ~545 MB · VmHWM ~693 MB · G-code 19 093 KB.
- Em segundo plano/ecrã desligado: `apply+process` ~58 s (≈4×), mesmo resultado.
- Gengar a 0.20 mm, primeiro plano: `apply=6 055 ms`, `process=2 941 ms`, slice_call 2,18 s · PSS 402 MB ·
  VmHWM 551 MB · G-code 9,8 MB (385 camadas). Ver `docs/ensaio-6-gengar-primeiro-plano.md`.

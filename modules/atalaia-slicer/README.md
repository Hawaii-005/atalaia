# modules/atalaia-slicer

Motor de fatiamento nativo do Atalaia (`libslic3r`), exposto ao TypeScript via Kotlin/JNI.

**Licença: GNU AGPL-3.0-or-later.** Este módulo incorpora `libslic3r` (AGPL-3.0) e por isso
todo o binário que o inclui é distribuído sob AGPL-3.0. Ver `LICENSE` nesta pasta e `NOTICE`
na raiz do repositório. O código-fonte correspondente está neste repositório.

## Onde entra

| Edição | Módulo | applicationId | Licença da distribuição |
|---|---|---|---|
| `lite` | não incluído | `io.github.hawaii005.atalaia` | MIT |
| `completa` | incluído | `io.github.hawaii005.atalaia.completa` | AGPL-3.0-or-later |

A escolha faz-se no Gradle (`flavorDimensions "edicao"` em `android/app/build.gradle`);
o código TypeScript nunca importa este módulo diretamente na edição `lite`.

## Binário nativo

`src/main/jniLibs/arm64-v8a/libslice_core.so` **não** está versionado (68 MB). É compilado
pelo workflow `.github/workflows/slicer-spike-build.yml` e copiado para aqui antes do build
do APK. Compilação local:

```bash
cd atalaia-slicer-spike
docker build -t atalaia-slicer-builder:latest .
mkdir -p output/arm64-v8a
docker run --rm -v "$(pwd)/output:/workspace/output" atalaia-slicer-builder:latest
cp output/arm64-v8a/libslice_core.so ../modules/atalaia-slicer/src/main/jniLibs/arm64-v8a/
```

O binário tem de estar alinhado a 16 KB (`-Wl,-z,max-page-size=16384`, já no
`docker-build.sh`) e ser compilável a partir do código — nunca extraído de APKs de terceiros.

## API

`io.github.hawaii005.atalaia.slicer.SlicerEngine` — `inicializar(ctx)`, `impressoras()`,
`filamentos()`, `processos()`, `fatiar(modelo, perfil, saida)`, `cancelar()`, `ultimoErro()`.

A camada JNI (`world.yemyat.slicepilot.NativeLib`, adaptada do SlicePilot, MIT) mantém
deliberadamente o package original: os símbolos exportados no `.so` chamam-se
`Java_world_yemyat_slicepilot_NativeLib_*`. Mudar o package obriga a recompilar o binário.

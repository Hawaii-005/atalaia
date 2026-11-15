#!/usr/bin/env bash
# Script de Compilação do libslice_core.so dentro do Container Docker
set -euo pipefail

# Commit fixo e auditado do SlicePilot:
SLICEPILOT_COMMIT="c8d0646944f2eedb8837a02d5352cbcde22863e6"

# Limitar paralelismo para evitar esgotamento de memória RAM durante compilações C++
NUM_PROCS=$(nproc)
MAX_JOBS=$(( NUM_PROCS > 4 ? 4 : NUM_PROCS ))

echo "=========================================================="
echo "Iniciando compilação do libslice_core.so"
echo "Host: $(uname -s) $(uname -m)"
echo "Android NDK: ${ANDROID_NDK_HOME}"
echo "Target ABI: arm64-v8a (Android API 28)"
echo "SlicePilot Commit SHA: ${SLICEPILOT_COMMIT}"
echo "Paralelismo máximo (jobs): ${MAX_JOBS} (de ${NUM_PROCS} CPUs detetadas)"
echo "=========================================================="

OUTPUT_DIR="/workspace/output/arm64-v8a"
mkdir -p "$OUTPUT_DIR"

SRC_DIR="/workspace/slicepilot-src"
if [ ! -d "$SRC_DIR" ]; then
    echo ">>> Clonando repositório SlicePilot..."
    git clone https://github.com/yemyatthu1990/slicepilot-android-public.git "$SRC_DIR"
    cd "$SRC_DIR"
    git checkout "$SLICEPILOT_COMMIT"
    echo ">>> Confirmado commit no repositório: $(git rev-parse HEAD)"
else
    cd "$SRC_DIR"
    git checkout "$SLICEPILOT_COMMIT"
fi

# Preparar dependências de terceiros (fontes nativas)
echo ">>> Preparando fontes das dependências nativas via scripts/ci_prepare_native_src.sh..."
cd "$SRC_DIR"
chmod +x scripts/ci_prepare_native_src.sh
./scripts/ci_prepare_native_src.sh

cd "$SRC_DIR/android/native-build"

# 1. Patch de NDK: substituir NDK hardcoded para usar ANDROID_NDK_HOME
echo ">>> Aplicando patch no caminho do NDK em build.sh..."
sed -i "s|NDK=\"\$HOME/Android/Sdk/ndk/.*\"|NDK=\"${ANDROID_NDK_HOME}\"|g" build.sh

# 2. Patch de paralelismo: respeitar MAX_JOBS em vez de JOBS=$(nproc)
sed -i "s|JOBS=\$(nproc)|JOBS=${MAX_JOBS}|g" build.sh

# 3. Verificação com grep após o sed (falha o script se o patch não foi aplicado)
echo ">>> Verificando substituição no build.sh..."
grep -F "NDK=\"${ANDROID_NDK_HOME}\"" build.sh || {
    echo "ERRO: O patch do NDK no build.sh falhou!" >&2
    exit 1
}
grep -F "JOBS=${MAX_JOBS}" build.sh || {
    echo "ERRO: O patch de limitação de JOBS no build.sh falhou!" >&2
    exit 1
}
echo ">>> Verificação do build.sh concluída com sucesso."

# 4. Executar compilação das dependências estáticas C++
echo ">>> Compilando dependências nativas C++ (build.sh all)..."
chmod +x build.sh
./build.sh all

# 5. Compilar o alvo slice_core via CMake
echo ">>> Configurando e compilando alvo CMake 'slice_core'..."
cd "$SRC_DIR/android/core"
mkdir -p build-arm64
cd build-arm64

cmake -DCMAKE_TOOLCHAIN_FILE="${ANDROID_NDK_HOME}/build/cmake/android.toolchain.cmake" \
    -DANDROID_ABI=arm64-v8a \
    -DANDROID_PLATFORM=android-28 \
    -DANDROID_STL=c++_static \
    -DCMAKE_BUILD_TYPE=Release \
    ..

cmake --build . -j"${MAX_JOBS}" --target slice_core

# 6. Validação do binário gerado e cálculo de SHA256
SO_PATH="$SRC_DIR/android/core/build-arm64/libslice_core.so"
if [ ! -f "$SO_PATH" ]; then
    echo "ERRO: Artefato ${SO_PATH} não foi encontrado após o build!" >&2
    exit 1
fi

cp "$SO_PATH" "$OUTPUT_DIR/libslice_core.so"

echo "=========================================================="
echo "Compilação concluída!"
ls -lh "$OUTPUT_DIR/libslice_core.so"
echo "SHA256 do binário compilado:"
sha256sum "$OUTPUT_DIR/libslice_core.so" | tee "$OUTPUT_DIR/libslice_core.so.sha256"
echo "=========================================================="

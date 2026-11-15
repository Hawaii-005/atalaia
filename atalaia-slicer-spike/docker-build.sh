#!/usr/bin/env bash
# Script de Compilação do libslice_core.so dentro do Container Docker
set -euo pipefail

echo "=========================================================="
echo "Iniciando compilação reproduzível do libslice_core.so"
echo "Host Kernel: $(uname -s) $(uname -m)"
echo "Android NDK: ${ANDROID_NDK_HOME}"
echo "Target ABI: arm64-v8a (Android API 28)"
echo "=========================================================="

OUTPUT_DIR="/workspace/output/arm64-v8a"
mkdir -p "$OUTPUT_DIR"

SRC_DIR="/workspace/slicepilot-src"
if [ ! -d "$SRC_DIR" ]; then
    echo ">>> Clonando repositório SlicePilot (commit auditado)..."
    git clone --depth 1 https://github.com/yemyatthu1990/slicepilot-android-public.git "$SRC_DIR"
fi

cd "$SRC_DIR/android/native-build"

# Patch para garantir que o build.sh usa a variável de ambiente $ANDROID_NDK_HOME
sed -i "s|NDK=\"\$HOME/Android/Sdk/ndk/.*\"|NDK=\"${ANDROID_NDK_HOME}\"|g" build.sh

echo ">>> Executando build de dependências estáticas C++ (Boost, TBB, CGAL, OpenVDB)..."
./build.sh all

echo ">>> Compilando e ligando libslice_core.so via CMake..."
cd "$SRC_DIR/android/core"
mkdir -p build-arm64
cd build-arm64

cmake -DCMAKE_TOOLCHAIN_FILE="${ANDROID_NDK_HOME}/build/cmake/android.toolchain.cmake" \
    -DANDROID_ABI=arm64-v8a \
    -DANDROID_PLATFORM=android-28 \
    -DANDROID_STL=c++_static \
    -DCMAKE_BUILD_TYPE=Release \
    ..

cmake --build . -j$(nproc) --target slice_core

echo ">>> Copiando binário final para pasta de saída..."
cp libslice_core.so "$OUTPUT_DIR/libslice_core.so"

echo "=========================================================="
echo "Compilação concluída com sucesso!"
ls -lh "$OUTPUT_DIR/libslice_core.so"
sha256sum "$OUTPUT_DIR/libslice_core.so"
echo "=========================================================="

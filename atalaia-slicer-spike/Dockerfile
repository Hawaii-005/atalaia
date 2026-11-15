# Dockerfile para Compilação Reproduzível do libslice_core.so (arm64-v8a)
# Imagem base fixa por digest (Ubuntu 22.04 LTS linux/amd64)
FROM ubuntu:22.04@sha256:45e9ddc6895604674618a409ca9f73d301da8fdb75fe330e8e9a27b3b219e4ad

ENV DEBIAN_FRONTEND=noninteractive
ENV ANDROID_HOME=/opt/android-sdk
ENV ANDROID_NDK_VERSION=27.0.12077973
ENV ANDROID_NDK_HOME=/opt/android-sdk/ndk/${ANDROID_NDK_VERSION}
ENV ANDROID_NDK_ROOT=/opt/android-sdk/ndk/${ANDROID_NDK_VERSION}
ENV PATH=${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:${ANDROID_NDK_HOME}/toolchains/llvm/prebuilt/linux-x86_64/bin:${PATH}

# 1. Dependências do sistema de build Linux (x86_64 nativo)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    ninja-build \
    git \
    curl \
    unzip \
    tar \
    pkg-config \
    python3 \
    python3-pip \
    openjdk-17-jdk-headless \
    bison \
    flex \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 2. Instalação do Android SDK Command-Line Tools e NDK r27 fixo
RUN mkdir -p ${ANDROID_HOME}/cmdline-tools && \
    curl -sSL -o /tmp/cmdline-tools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip && \
    unzip -q /tmp/cmdline-tools.zip -d ${ANDROID_HOME}/cmdline-tools && \
    mv ${ANDROID_HOME}/cmdline-tools/cmdline-tools ${ANDROID_HOME}/cmdline-tools/latest && \
    rm /tmp/cmdline-tools.zip

RUN yes | sdkmanager --licenses > /dev/null && \
    sdkmanager "ndk;${ANDROID_NDK_VERSION}" "cmake;3.22.1" > /dev/null

WORKDIR /workspace

# 3. Script de entrada para executar a compilação
COPY docker-build.sh /workspace/docker-build.sh
RUN chmod +x /workspace/docker-build.sh

ENTRYPOINT ["/workspace/docker-build.sh"]

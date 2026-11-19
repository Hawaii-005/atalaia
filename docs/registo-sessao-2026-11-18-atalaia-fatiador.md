# Registo de Sessão — Atalaia Fatiador (18–19 Nov 2026)

## Contexto

Retomada do projeto no repositório `Hawaii-005/atalaia` (CC Tool), ramo `fatiador-1-viabilidade-licenca`. Fase 1: viabilidade do fatiador libslic3r nativo via spike Android.

---

## 1. Estado inicial da Fase 1

O spike (`atalaia-slicer-spike`) estava em fase de ensaios de aparelhos. Resultados anteriores disponíveis:

| Aparelho | Cubo | Gengar 0.20 mm | PSS | Fonte |
|---|---|---|---|---|
| Note 20 Ultra (SM-N986B) | 0,68–0,80 s apply | 9,0 s primeiro plano | 402–546 MB | `ensaio-5-cubo.md`, `ensaio-6-gengar-primeiro-plano.md` |
| Tab S10 Lite | não ensaiado | — | — | adiados pelo utilizador |

CI GitHub Actions a compilar bem: run 441279055552, APK debug74,3 MB, sha256 `31983c99…`.

---

## 2. ADB WiFi — S25 Ultra

### Emparelhamento

- IP TV (192.168.1.249:5555) identificado como Mi TV, não S25 — desconectado.
- IP fornecido pelo utilizador: **192.168.1.254:40499** — porta de emparelhamento Wi-Fi.
- Código de emparelhamento: **108770**.
- `adb connect 192.168.1.254:40499` → conectado. Dispositivo: SM-S938B (pa3q).

### Instalação do APK e teste

- APK descarregado do CI: `/Volumes/Arquivos/slicer-spike-apk/app-debug.apk` (sha256 verificado).
- STL cubo gerado localmente e enviado para o aparelho (`/sdcard/Download/Cubo.stl`).
- App aberta, botão "ESCOLHER STL E FATIAR" pressionado, ficheiro selecionado, fatiado.

### Resultado Ensaio 7 (S25 Ultra)

| Métrica | Valor |
|---|---|
| Slice call | **0,38 s** |
| Pico PSS | 211 MB |
| VmHWM | 240 MB |
| Camadas | 50 |
| max_z | 10,00 mm |
| G-code | 97 KB, BED=60, TOOL=0, 1× HEADER_BLOCK_END, 0 trocas T |

O S25 Ultra foi o mais rápido dos três aparelhos testados.

---

## 3. Documentação da Fase 1

### Condições do utilizador para fecho

1. Fase 1 só fecha com o **teste físico do cubo** na Centauri Carbon (pendente).
2. Tab S10 Lite **não ensaiado por decisão do utilizador** — registado como risco aberto.
3. Variante completa **nunca distribuída como "validada em tablets"**.
4. Mitigação de memória exigida na Fase 2/3: `ActivityManager.MemoryInfo` antes de fatiar; OOM → `SLICING_ERROR` sem crash.
5. **Fase 2 não aprovada.** ADR 0002 mantém-se «Proposto». Sem aprovação escrita: nenhum alter ao LICENSE/NOTICE, nenhum código AGPL adicionado.

### Ficheiros atualizados

- `docs/design/slicer/README.md` — nova secção 0 com estado, aparelhos ensaiados, risco tablet, bug STL, mitigação memória.
- `docs/adr/0002-integracao-fatiador-libslic3r-agpl3.md` — status atualizado, secção 6 com limitações e regras.
- `atalaia-slicer-spike/docs/ensaio-7-s25-ultra.md` — relatório completo do ensaio no S25.
- Commit `9857709`.

---

## 4. Investigação 16 KB

### Pergunta do utilizador

Antes disse que o CMakeLists injetava `-Wl,-z,max-page-size=16384`; agora o binário não está alinhado. Mostrar linha exata e saída de `readelf`.

### Resultado

- **Nenhuma linha** em `CMakeLists.txt`, `docker-build.sh`, `build.gradle` ou scripts do spike injeta a flag.
- Os únicos lugares onde aparece `-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON` são módulos React Native nos seus próprios `build.gradle`:
  - `expo-modules-core/android/build.gradle`
  - `react-native/ReactAndroid/build.gradle.kts`
  - `react-native/hermes-engine/build.gradle.kts`
  - `react-native-gesture-handler/android/build.gradle`
  - `react-native-reanimated/android/build.gradle`
  - `react-native-screens/android/build.gradle`
- Nenhum destes afeta `libslice_core.so`.
- Binário extraído do APK CI tem paginação default de 4 KB. No Android 17 (S25) o sistema mostra aviso «app não compatível com 16 KB».
- Solução para distribuir em Android 17+: `-Wl,-z,max-page-size=16384` (**hífen**, não underscore) ou `-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON` (NDK r27+). NDK r28 já define isto por padrão.
- `readelf` indisponível no host macOS (sem toolchain binutils); documentado sem executar `readelf -lW`.

### Documentado em

- Secção 0 do README do fatiador.
- Secção 6 do ADR 0002.
- Nota 1 do ensaio-7.
- Commit `4c81ccd`.

---

## 5. Investigação bug das dimensões STL

### Pergunta do utilizador

Se as dimensões do STL não são fiáveis, a altura do Gengar (78,02 mm) deixa de servir de referência. Dar a caixa envolvente real por via fiável e explicar o erro.

### Análise do código Kotlin

Método `obterInfoModeloSTL` (`MainActivity.kt:721–783`):

```kotlin
val buf = ByteArray(48)
for (i in 0 until triangulos) {
    raf.readFully(buf)  // lê 48 bytes
    for (v in 0 until 3) {
        val base = v * 12  // BUG: começa em 0
        ...
    }
    raf.seek(raf.filePointer + 2)
}
```

Estrutura real do STL binário:
```
normal (12 bytes) + v1 (12) + v2 (12) + v3 (12) + atributo (2) = 50 bytes
```

O loop começa em `base = 0`, interpretando o **normal** como primeiro vértice. Deveria começar em `base = 12`.

### Reprodução com Python

Teste com cubo 20×20×10 mm (12 triângulos):

| Versão | Dimensões |
|---|---|
| CORRETO (`base =12 + v*12`, 50 bytes) | 20,00 × 20,00 × 10,00 mm |
| BUGGY (`base = v*12`, 48 bytes) | 400,00 × 400,00 × 800,00 mm |

O bug desalinha todos os vértices seguintes, gerando dimensões completamente erradas.

### Impacto

- Afeta apenas o visor E1B (caixa envolvente) da app de spike.
- O motor nativo (`libslic3r`) calcula AABB corretamente.
- A app de spike não usa `nativeParsePreview` para dimensões — usa o parser Kotlin.

### Correção necessária

```kotlin
val buf = ByteArray(50)
...
for (v in 0 until 3) {
    val base = 12 + v * 12  // saltar normal
    ...
}
```

### Documentado em

- Secção 0 do README do fatiador ("Bugs conhecidos no leitor de STL").
- Secção 6 do ADR 0002.
- Nota 2 do ensaio-7.
- Commit `4c81ccd`.

---

## 6. Commits desta sessão

| Commit | Mensagem |
|---|---|
| `9857709` | docs: estado da fase 1 (Note 20 + S25; Tab nao ensaiado), risco de tablet e mitigacao de memoria [skip ci] |
| `4c81ccd` | docs: nota 16 KB (max-page-size, sem recompilar) e bug leitor STL [skip ci] |

Suite de testes: 51 suites / 599 testes verdes em ambos.

---

## 7. Pendências

| Item | Estado |
|---|---|
| Teste físico do cubo na Centauri Carbon | Pendente (envio manual pelo utilizador via Mainsail/Fluidd) |
| Tab S10 Lite ensaio | Adiado pelo utilizador |
| Bug leitor STL (Kotlin) | Documentado, correção pendente |
| Alinhamento 16 KB (`libslice_core.so`) | Documentado, recompilação pendente |
| Aprovação da Fase 2 | Pendente (ADR 0002 ainda «Proposto») |
| Alteração LICENSE/NOTICE | Bloqueada até aprovação escrita |

---

## 8. Notas operacionais

- ADB WiFi funciona com portas antigas de depuração Wi-Fi já emparelhadas (S25: `192.168.1.254:40499`). Porta de emparelhamento ≠ porta de `adb connect`.
- APK spike: `io.github.hawaii005.slicerspike`, sha256 `31983c99ae9c91b2ae4f4046a4092e99411e582db34e9a47f73c1d4d1776c8d6`.
- Clonar/descarregar sempre para `/Volumes/Arquivos` (SSD interno enche).
- Nunca enviar upload nem `printer.print.start` sem autorização explícita do utilizador.

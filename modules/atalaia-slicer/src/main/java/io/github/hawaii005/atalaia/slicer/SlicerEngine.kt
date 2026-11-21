// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Bruno Rocha
package io.github.hawaii005.atalaia.slicer

import android.content.Context
import java.io.File
import world.yemyat.slicepilot.NativeLib

/**
 * Fachada do motor de fatiamento nativo (libslic3r) para o Atalaia.
 *
 * Só está disponível na edição 'completa': na 'lite' esta classe não chega ao APK.
 * O binário (libslice_core.so, arm64-v8a) é compilado fora do Gradle pelo CI.
 */
object SlicerEngine {

    /** Muda quando os perfis/assets mudarem, para forçar a reinstalação. */
    private const val VERSION = "2"

    data class Perfil(
        val impressora: String,
        val filamento: String,
        val processo: String,
        /** Chapa física escolhida no ecrã; o motor assume Cool Plate (35 °C) sem isto. */
        val placa: String = "Textured PEI Plate",
    )

    data class Progresso(
        val passo: Int = 0,
        val etapa: String = "",
        val percentagem: Int = 0,
    )

    /** Actualizado na thread do motor; lido pela sonda de progresso da UI. */
    @Volatile
    private var _progresso = Progresso()
    /** Callback opcional invocado na thread do motor a cada atualização de progresso. */
    @Volatile
    var onProgresso: ((Progresso) -> Unit)? = null

    /** O motor avisou que escreveu o G-code. Zerado a cada fatiamento. */
    @Volatile
    private var exportado = false

    fun progressoAtual(): Progresso = _progresso
    @Volatile
    private var inicializado = false

    /** Caminhos onde o libslic3r guarda dados e recursos de perfis. */
    private fun dirs(ctx: Context): Pair<File, File> {
        val base = ctx.getExternalFilesDir(null) ?: ctx.filesDir
        val data = File(base, "slic3r_data").apply { mkdirs() }
        val res = File(base, "slic3r_res").apply { mkdirs() }
        return data to res
    }

    /** Raiz dos presets, guardada na inicialização para a leitura de perfis. */
    @Volatile
    private var dataDir: File? = null

    /**
     * O motor não traz presets embutidos: sem os perfis copiados, `perfis()`
     * vem vazio e a UI fica sem nada para escolher. Copia os assets uma vez
     * (marcador VERSION) — são 4,4 MB, não vale a pena a cada arranque.
     */
    private fun instalarPerfis(ctx: Context, data: File, res: File) {
        val marca = File(data, ".perfis-${VERSION}")
        if (marca.exists()) return
        copiarAssets(ctx, "profiles", File(res, "profiles"))
        copiarAssets(ctx, "profiles", File(data, "system"))
        // Presets próprios: a impressora Cosmos AFC e o par PLA + 0.20 mm que
        // lhe é compatível (o pack Elegoo não os declara para este nome).
        listOf("printer", "filament", "process").forEach { tipo ->
            val destino = File(data, "user/default/$tipo").apply { mkdirs() }
            ctx.assets.list("user_profiles/$tipo")?.forEach { nome ->
                File(destino, nome).outputStream().use { saida ->
                    ctx.assets.open("user_profiles/$tipo/$nome").use { it.copyTo(saida) }
                }
            }
        }
        marca.writeText("")
    }

    private fun copiarAssets(ctx: Context, origem: String, destino: File) {
        val filhos = ctx.assets.list(origem) ?: return
        if (filhos.isEmpty()) {
            destino.parentFile?.mkdirs()
            ctx.assets.open(origem).use { entrada ->
                destino.outputStream().use { entrada.copyTo(it) }
            }
            return
        }
        destino.mkdirs()
        filhos.forEach { copiarAssets(ctx, "$origem/$it", File(destino, it)) }
    }

    /** Inicializa o motor. Devolve false se o binário não estiver no APK ou falhar a carregar. */
    fun inicializar(ctx: Context): Boolean {
        if (inicializado) return true
        if (!NativeLib.loadLibrary()) return false
        val (data, res) = dirs(ctx)
        return try {
            instalarPerfis(ctx, data, res)
            NativeLib.nativeInit(data.absolutePath, res.absolutePath)
            dataDir = data
            inicializado = true
            true
        } catch (e: Throwable) {
            android.util.Log.e("SlicerEngine", "Falha a inicializar o motor", e)
            false
        }
    }

    fun versao(): String = if (inicializado) NativeLib.nativeGetVersion() else ""

    fun impressoras(): List<String> = jsonLista(NativeLib.nativeGetPrinters())

    /**
     * Lista de filamentos compatíveis com a impressora activa. `nativeGetFilaments`
     * devolve o conjunto do preset bundle (219), grande parte incompatível com a
     * máquina escolhida; o getter de compatibilidade é o que a UI deve mostrar.
     */
    fun filamentos(): List<String> =
        jsonLista(NativeLib.nativeGetCompatibleFilaments())
            .ifEmpty { jsonLista(NativeLib.nativeGetFilaments()) }

    fun processos(): List<String> =
        jsonLista(NativeLib.nativeGetCompatibleProcesses())
            .ifEmpty { jsonLista(NativeLib.nativeGetProcesses()) }

    fun selecionarImpressora(nome: String): Boolean =
        if (inicializado) NativeLib.nativeSelectPrinter(nome) else false

    fun selecionarProcesso(nome: String): Boolean =
        if (inicializado) NativeLib.nativeSelectProcess(nome) else false

    /**
     * Chapa da máquina. Sem isto o motor assume "Cool Plate" e manda
     * `first_layer_bed_temperature = 35` no PRINT_START — PLA não agarra numa
     * Textured PEI a 35 °C. A Centauri Carbon usa Textured PEI a 60 °C.
     */
    private fun overrides(placa: String): String = "curr_bed_type = $placa\n"

    /**
     * Fatia [modelo] (STL/3MF) para [saida]. Bloqueante: chamar fora da thread principal.
     * Devolve true quando o motor reporta sucesso **e** o ficheiro está completo.
     */
    fun fatiar(modelo: File, perfil: Perfil, saida: File): Boolean {
        if (!inicializado) return false
        exportado = false
        onProgresso?.invoke(Progresso())
        val callback = object : NativeLib.SliceCallback {
            override fun onProgress(step: Int, text: String, percent: Int) {
                if (text.contains("exported", ignoreCase = true) || percent >= 100) {
                    exportado = true
                }
                _progresso = Progresso(step, text, percent)
                onProgresso?.invoke(_progresso)
            }
        }
        return try {
            val ok = NativeLib.nativeSliceWithOverrides(
                modelo.absolutePath,
                perfil.impressora,
                perfil.filamento,
                perfil.processo,
                overrides(perfil.placa),
                "",
                saida.absolutePath,
                callback,
            )
            if (!ok) return false
            esperarExport(saida)
            corrigirCabecalho(saida)
            // Tamanho lido só depois do export: antes disso dava 0 bytes e o
            // ecrã anunciava sucesso com «0 B».
            saida.exists() && saida.length() > 0L
        } catch (e: Throwable) {
            android.util.Log.e("SlicerEngine", "Falha no fatiamento", e)
            false
        }
    }

    /**
     * A chamada nativa retorna antes de o motor acabar de escrever o ficheiro.
     * Sinal principal: o callback «exported» ou o motor parado. Alternativa: o
     * tamanho repetir-se em quatro amostras. Limite de 5 minutos, para não
     * deixar a promessa pendurada.
     */
    private fun esperarExport(saida: File) {
        val limite = android.os.SystemClock.elapsedRealtime() + 300_000
        var anterior = -1L
        var estaveis = 0
        while (android.os.SystemClock.elapsedRealtime() < limite) {
            val tamanho = if (saida.exists()) saida.length() else 0L
            if (tamanho > 0L && (exportado || !NativeLib.nativeIsRunning())) return
            if (tamanho > 0L && tamanho == anterior) {
                estaveis += 1
                if (estaveis >= 4) return
            } else {
                estaveis = 0
            }
            anterior = tamanho
            try {
                Thread.sleep(250)
            } catch (e: InterruptedException) {
                return
            }
        }
    }

    fun cancelar() {
        if (inicializado) NativeLib.nativeCancel()
    }

    /**
     * Volume útil em mm, lido do preset da máquina e das heranças que ele
     * declara (`inherits`): o Cosmos AFC só traz start/end G-code e herda
     * `printable_area`/`printable_height` do perfil base. Devolve "null" quando
     * não consegue provar o valor — o ecrã avisa em vez de inventar.
     */
    fun volume(nome: String): String {
        val base = dataDir ?: return "null"
        val proprio = procurarPerfil(base, nome) ?: return "null"
        val campos = resolverPerfil(base, proprio, HashSet())
        // O preset traz a área como lista de pontos; alguns packs usam uma string.
        val area = when (val v = campos["printable_area"]) {
            is org.json.JSONArray -> (0 until v.length()).joinToString(",") { v.optString(it) }
            is String -> v
            else -> return "null"
        }
        val altura = when (val v = campos["printable_height"]) {
            is Number -> v.toDouble()
            is String -> v.toDoubleOrNull()
            else -> null
        } ?: return "null"
        // Formato do preset: "0x0","256x0","256x256","0x256"
        val pontos = area.split(",").mapNotNull { p ->
            val xy = p.trim().split("x")
            if (xy.size != 2) null else {
                val x = xy[0].toDoubleOrNull()
                val y = xy[1].toDoubleOrNull()
                if (x != null && y != null) x to y else null
            }
        }
        if (pontos.size < 2) return "null"
        val largura = pontos.maxOf { it.first } - pontos.minOf { it.first }
        val fundo = pontos.maxOf { it.second } - pontos.minOf { it.second }
        if (largura <= 0.0 || fundo <= 0.0 || altura <= 0.0) return "null"
        return "{\"x\":$largura,\"y\":$fundo,\"z\":$altura}"
    }

    /**
     * Preset do utilizador primeiro; senão, o de sistema com esse nome. Os
     * presets de sistema vivem em `system/<fabricante>/machine/<série>/`, por
     * isso a procura é pelo nome do ficheiro e não pela pasta.
     */
    private fun procurarPerfil(base: File, nome: String): File? {
        val ficheiro = if (nome.endsWith(".json")) nome else "$nome.json"
        File(base, "user/default/printer/$ficheiro").takeIf { it.isFile }?.let { return it }
        return base.walkTopDown()
            .filter { it.isFile && it.name == ficheiro }
            .sortedBy { if (it.path.contains("/machine/")) 0 else 1 }
            .firstOrNull()
    }

    /** Junta o preset com a cadeia `inherits`; o filho sobrepõe-se ao pai. */
    private fun resolverPerfil(
        base: File,
        ficheiro: File,
        vistos: MutableSet<String>,
    ): Map<String, Any?> {
        if (!vistos.add(ficheiro.absolutePath)) return emptyMap()
        val proprio = try {
            org.json.JSONObject(ficheiro.readText())
        } catch (e: Throwable) {
            return emptyMap()
        }
        val campos = mutableMapOf<String, Any?>()
        val pai = proprio.optString("inherits", "")
        if (pai.isNotEmpty()) {
            procurarPerfil(base, pai)?.let { campos.putAll(resolverPerfil(base, it, vistos)) }
        }
        proprio.keys().forEach { chave ->
            if (chave != "inherits" && !proprio.isNull(chave)) campos[chave] = proprio.get(chave)
        }
        return campos
    }

    /**
     * O motor emite dois "; HEADER_BLOCK_END" (o segundo antes de `; filament: N`).
     * Remove os repetidos, como já fazia o spike, para o cabeçalho ficar válido.
     */
    private fun corrigirCabecalho(f: File) {
        if (!f.exists() || f.length() < 4096) return
        val cab = ByteArray(4096)
        java.io.RandomAccessFile(f, "r").use { it.readFully(cab) }
        if (String(cab).split("HEADER_BLOCK_END").size <= 2) return
        val tmp = File(f.parentFile, f.name + ".tmp")
        var vistos = 0
        try {
            f.bufferedReader().use { entrada ->
                tmp.bufferedWriter().use { saida ->
                    var linha = entrada.readLine()
                    while (linha != null) {
                        if (linha.startsWith("; HEADER_BLOCK_END")) {
                            vistos += 1
                            if (vistos > 1) {
                                linha = entrada.readLine()
                                continue
                            }
                        }
                        saida.write(linha)
                        saida.newLine()
                        linha = entrada.readLine()
                    }
                }
            }
            if (tmp.length() > 0L) {
                f.delete()
                tmp.renameTo(f)
            }
        } catch (e: Throwable) {
            android.util.Log.e("SlicerEngine", "Falha a corrigir o cabeçalho", e)
            tmp.delete()
        }
    }

    fun estaEmCurso(): Boolean = inicializado && NativeLib.nativeIsRunning()

    fun ultimoErro(): String = if (inicializado) NativeLib.nativeGetError() else ""

    // O motor devolve listas em JSON (array de strings ou de objetos com "name").
    private fun jsonLista(json: String): List<String> = try {
        val arr = org.json.JSONArray(json)
        (0 until arr.length()).map { i ->
            when (val v = arr.get(i)) {
                is String -> v
                is org.json.JSONObject -> v.optString("name", v.toString())
                else -> v.toString()
            }
        }
    } catch (e: Throwable) {
        emptyList()
    }
}

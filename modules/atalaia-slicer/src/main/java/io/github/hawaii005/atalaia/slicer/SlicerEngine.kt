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
    private const val OVERRIDES = "curr_bed_type = Textured PEI Plate\n"

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
                OVERRIDES,
                "",
                saida.absolutePath,
                callback,
            )
            if (!ok) return false
            esperarExport(saida)
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

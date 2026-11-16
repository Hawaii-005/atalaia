package io.github.hawaii005.slicerspike

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Debug
import android.os.SystemClock
import android.view.WindowManager
import android.widget.Button
import android.widget.ProgressBar
import android.widget.TextView
import androidx.core.content.FileProvider
import org.json.JSONArray
import org.json.JSONObject
import world.yemyat.slicepilot.NativeLib
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.concurrent.thread

/**
 * Aplicação de Benchmark e Teste de Viabilidade do Fatiador Atalaia.
 * Opera 100% offline, sem contas, sem telemetria e sem rede.
 *
 * NOTA METODOLÓGICA:
 * O pico de RAM medido é aproximado: a amostragem periódica de Debug.MemoryInfo.totalPss
 * reflete a memória proporcional (PSS) observada a cada intervalo de amostragem (200 ms),
 * não correspondendo ao pico absoluto instantâneo de alocação ao nível do kernel.
 */
class MainActivity : Activity() {

    private lateinit var tvDeviceInfo: TextView
    private lateinit var tvStatus: TextView
    private lateinit var tvMetrics: TextView
    private lateinit var progressBar: ProgressBar
    private lateinit var btnStart: Button
    private lateinit var btnShare: Button

    @Volatile
    private var isSlicing: Boolean = false

    private var lastReportFile: File? = null
    private var lastGcodeFile: File? = null
    private val lifecycleEvents = mutableListOf<String>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Manter o ecrã ativo durante o fatiamento
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        setContentView(R.layout.activity_main)

        tvDeviceInfo = findViewById(R.id.tvDeviceInfo)
        tvStatus = findViewById(R.id.tvStatus)
        tvMetrics = findViewById(R.id.tvMetrics)
        progressBar = findViewById(R.id.progressBar)
        btnStart = findViewById(R.id.btnStart)
        btnShare = findViewById(R.id.btnShare)

        val deviceDesc = "Aparelho: ${Build.MANUFACTURER} ${Build.MODEL} (${Build.DEVICE})\n" +
                "Android: ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT}) • ABI: ${Build.SUPPORTED_ABIS.firstOrNull()}"
        tvDeviceInfo.text = deviceDesc

        btnStart.setOnClickListener {
            if (!isSlicing) pickStl()
        }

        btnShare.setOnClickListener {
            shareFiles()
        }
    }

    override fun onPause() {
        super.onPause()
        lifecycleEvents.add("onPause at ${System.currentTimeMillis()} (App minimizada)")
    }

    override fun onStop() {
        super.onStop()
        lifecycleEvents.add("onStop at ${System.currentTimeMillis()}")
    }

    override fun onResume() {
        super.onResume()
        lifecycleEvents.add("onResume at ${System.currentTimeMillis()} (App retomada)")
    }

    /** Abre o seletor de ficheiros do Android para escolher um STL do aparelho. */
    private fun pickStl() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            putExtra(
                Intent.EXTRA_MIME_TYPES,
                arrayOf("model/stl", "application/sla", "application/vnd.ms-pki.stl", "application/octet-stream")
            )
        }
        startActivityForResult(Intent.createChooser(intent, "Escolher modelo STL"), REQ_PICK_STL)
    }

    @Deprecated("API de resultado clássica, suficiente para o spike")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQ_PICK_STL) return
        val uri = data?.data
        if (resultCode != RESULT_OK || uri == null) {
            tvStatus.text = "Nenhum STL escolhido. Benchmark não iniciado."
            return
        }
        try {
            contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        } catch (_: SecurityException) {
            // Nem todos os providers concedem persistência; a leitura imediata continua válida.
        }
        runBenchmark(uri)
    }

    /** Copia o STL escolhido para o armazenamento interno e devolve o ficheiro local. */
    private fun copiarStlParaInterno(uri: Uri): File {
        val testDir = File(filesDir, "spike_run")
        testDir.mkdirs()
        val nomeOriginal = queryDisplayName(uri) ?: "modelo.stl"
        val nomeSeguro = nomeOriginal.replace(Regex("[^A-Za-z0-9._-]"), "_")
        val destino = File(testDir, nomeSeguro)
        contentResolver.openInputStream(uri).use { input ->
            requireNotNull(input) { "Não foi possível abrir o STL escolhido" }
            FileOutputStream(destino).use { output -> input.copyTo(output) }
        }
        return destino
    }

    private fun queryDisplayName(uri: Uri): String? {
        return try {
            contentResolver.query(uri, arrayOf(android.provider.OpenableColumns.DISPLAY_NAME), null, null, null)
                ?.use { c -> if (c.moveToFirst()) c.getString(0) else null }
        } catch (_: Exception) {
            null
        }
    }

    private fun runBenchmark(uri: Uri) {
        isSlicing = true
        btnStart.isEnabled = false
        btnShare.isEnabled = false
        progressBar.progress = 0
        tvStatus.text = "A preparar diretório de perfis de sistema e utilizador..."

        lifecycleEvents.clear()
        lifecycleEvents.add("startBenchmark at ${System.currentTimeMillis()}")

        thread {
            val startTime = SystemClock.elapsedRealtime()
            var peakMemoryBytes: Long = 0

            // 1. Preparar diretórios conforme nativeInit(dataDir, resDir) do libslic3r
            val slicerDataDir = File(filesDir, "slic3r_data")
            val slicerResDir = File(filesDir, "slic3r_res")
            slicerDataDir.mkdirs()
            slicerResDir.mkdirs()

            // Copiar perfis de sistema do SlicePilot para resDir/profiles e dataDir/system
            val resProfilesDir = File(slicerResDir, "profiles")
            val dataSystemDir = File(slicerDataDir, "system")
            copiarPastaAssetsRecursiva("profiles", resProfilesDir)
            copiarPastaAssetsRecursiva("profiles", dataSystemDir)

            // Copiar perfil de utilizador Cosmos AFC para a pasta de impressoras de utilizador
            val dataUserPrinterDir = File(slicerDataDir, "printer")
            dataUserPrinterDir.mkdirs()
            val cosmosUserFile = File(dataUserPrinterDir, "Elegoo Centauri Carbon 0.4 nozzle - Cosmos AFC.json")
            assets.open("user_profiles/Elegoo Centauri Carbon 0.4 nozzle - Cosmos AFC.json").use { input ->
                FileOutputStream(cosmosUserFile).use { output -> input.copyTo(output) }
            }

            // 2. Materializar o STL escolhido pelo utilizador
            val stlFile: File
            val modelInfo: ModelInfo
            try {
                stlFile = copiarStlParaInterno(uri)
                modelInfo = obterInfoModeloSTL(stlFile)
            } catch (e: Exception) {
                runOnUiThread {
                    tvStatus.text = "ERRO ao ler o STL escolhido: ${e.message}"
                    btnStart.isEnabled = true
                    isSlicing = false
                }
                return@thread
            }

            runOnUiThread {
                tvStatus.text = "Modelo: ${modelInfo.nome}\n" +
                        "Triângulos: ${modelInfo.triangulos}\n" +
                        "Dimensões: ${modelInfo.dimensoesFormatadas()} mm • ${modelInfo.tamanhoBytes / 1024} KB"
            }

            // 3. O .gcode e o relatório vão para a pasta partilhável (FileProvider)
            val reportsDir = getExternalFilesDir("benchmarks") ?: filesDir
            reportsDir.mkdirs()
            val gcodeFile = File(reportsDir, "saida_cosmos_afc.gcode")
            if (gcodeFile.exists()) gcodeFile.delete()

            runOnUiThread {
                tvStatus.text = "A carregar libslice_core.so e inicializar motor..."
            }

            val libLoaded = NativeLib.loadLibrary()
            if (!libLoaded) {
                runOnUiThread {
                    tvStatus.text = "ERRO: libslice_core.so não encontrado no pacote!"
                    tvMetrics.text = "Coloque o binário libslice_core.so em app/src/main/jniLibs/arm64-v8a/"
                    btnStart.isEnabled = true
                }
                isSlicing = false
                return@thread
            }

            NativeLib.nativeInit(slicerDataDir.absolutePath, slicerResDir.absolutePath)

            val engineVersion = try {
                NativeLib.nativeGetVersion()
            } catch (e: Throwable) {
                "indisponível: ${e.message}"
            }

            // 4. Confirmar impressora via nativeGetPrinters() e selecionar
            val printersJsonRaw = NativeLib.nativeGetPrinters()
            val printersArray = try { JSONArray(printersJsonRaw) } catch (e: Exception) { JSONArray() }

            val targetPrinter = "Elegoo Centauri Carbon 0.4 nozzle - Cosmos AFC"
            val printerNames = nomesDe(printersArray)
            val printerFound = printerNames.contains(targetPrinter)

            // Se o perfil de utilizador não aparecer diretamente pelo nome, selecionar o perfil base de sistema
            val activePrinter = if (printerFound) targetPrinter else "Elegoo Centauri Carbon 0.4 nozzle"
            NativeLib.nativeSelectPrinter(activePrinter)

            // 5. Obter filamento e processo compatíveis via funções nativas
            val compatibleFilamentsRaw = NativeLib.nativeGetCompatibleFilaments()
            val compatibleProcessesRaw = NativeLib.nativeGetCompatibleProcesses()

            val filamentsArray = try { JSONArray(compatibleFilamentsRaw) } catch (e: Exception) { JSONArray() }
            val processesArray = try { JSONArray(compatibleProcessesRaw) } catch (e: Exception) { JSONArray() }

            val chosenFilament = nomesDe(filamentsArray).firstOrNull() ?: "Generic PLA @Elegoo Centauri"
            val chosenProcess = nomesDe(processesArray).firstOrNull() ?: "0.20mm Standard @Elegoo CC 0.4 nozzle"

            runOnUiThread {
                tvStatus.text = "A fatiar: Impressora='$activePrinter'\nFilamento='$chosenFilament'\nProcesso='$chosenProcess'"
            }

            // Monitorização de memória PSS aproximada
            val monitorThread = thread {
                while (isSlicing) {
                    val memInfo = Debug.MemoryInfo()
                    Debug.getMemoryInfo(memInfo)
                    val totalPssBytes = memInfo.totalPss * 1024L
                    if (totalPssBytes > peakMemoryBytes) {
                        peakMemoryBytes = totalPssBytes
                    }
                    runOnUiThread {
                        tvMetrics.text = "RAM PSS Aprox.: ${totalPssBytes / (1024 * 1024)} MB"
                    }
                    try {
                        Thread.sleep(200)
                    } catch (e: InterruptedException) {
                        break
                    }
                }
            }

            // Executar fatiamento com callback oficial de progresso
            val callback = object : NativeLib.SliceCallback {
                override fun onProgress(step: Int, text: String, percent: Int) {
                    runOnUiThread {
                        progressBar.progress = percent
                        tvStatus.text = "Fatiamento: $percent% ($text)"
                    }
                }
            }

            val success = NativeLib.nativeSliceWithOverrides(
                modelPath = stlFile.absolutePath,
                printerName = activePrinter,
                filamentName = chosenFilament,
                processName = chosenProcess,
                overridesIni = "",
                supportFilamentName = "",
                outPath = gcodeFile.absolutePath,
                callback = callback
            )

            val durationMs = SystemClock.elapsedRealtime() - startTime
            isSlicing = false
            monitorThread.interrupt()
            monitorThread.join()

            // O export do G-code corre depois de nativeSliceWithOverrides devolver:
            // esperar que o ficheiro estabilize antes de medir (senão fica 0 bytes).
            var gcodeEstavel = 0L
            val limiteEspera = SystemClock.elapsedRealtime() + 180_000
            while (success && SystemClock.elapsedRealtime() < limiteEspera) {
                val atual = if (gcodeFile.exists()) gcodeFile.length() else 0L
                if (atual > 0 && atual == gcodeEstavel) break
                gcodeEstavel = atual
                try { Thread.sleep(1000) } catch (e: InterruptedException) { break }
            }
            val gcodeSize = if (gcodeFile.exists()) gcodeFile.length() else 0L
            val exportDurationMs = SystemClock.elapsedRealtime() - startTime

            // nativeGetError devolve código + texto; tentar JSON e cair para texto cru
            val errorRaw = try {
                NativeLib.nativeGetError()
            } catch (e: Throwable) {
                "indisponível: ${e.message}"
            }
            var errorCode: Any = JSONObject.NULL
            var errorText = errorRaw
            try {
                val errObj = JSONObject(errorRaw)
                errorCode = errObj.opt("code") ?: JSONObject.NULL
                errorText = errObj.optString("message", errorRaw)
            } catch (_: Exception) {
                // Texto simples: mantém-se como texto, código fica nulo
            }

            val reportJson = JSONObject().apply {
                put("manufacturer", Build.MANUFACTURER)
                put("model", Build.MODEL)
                put("device", Build.DEVICE)
                put("android_release", Build.VERSION.RELEASE)
                put("android_sdk", Build.VERSION.SDK_INT)
                put("abi", Build.SUPPORTED_ABIS.firstOrNull() ?: "")
                put("engine_version", engineVersion)
                put("model_file", stlFile.name)
                put("model_size_bytes", modelInfo.tamanhoBytes)
                put("triangle_count", modelInfo.triangulos)
                put("model_dimensions_mm", JSONObject().apply {
                    put("x", modelInfo.dimensoes[0])
                    put("y", modelInfo.dimensoes[1])
                    put("z", modelInfo.dimensoes[2])
                })
                put("duration_ms", durationMs)
                put("duration_including_export_ms", exportDurationMs)
                put("peak_ram_pss_mb_approx", peakMemoryBytes / (1024 * 1024))
                put("memory_measurement_method", "Debug.MemoryInfo.totalPss sampled every 200ms (approximate PSS)")
                put("active_printer", activePrinter)
                put("printers_available", JSONArray(printerNames))
                put("chosen_filament", chosenFilament)
                put("chosen_process", chosenProcess)
                put("success", success)
                put("native_error_code", errorCode)
                put("native_error_text", errorText)
                put("gcode_path", if (gcodeFile.exists()) gcodeFile.absolutePath else "")
                put("gcode_size_bytes", gcodeSize)
                put("lifecycle_events", lifecycleEvents)
                put("timestamp", SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date()))
            }

            val reportFile = File(reportsDir, "benchmark_${Build.MODEL}_${System.currentTimeMillis()}.json")
            FileOutputStream(reportFile).use { it.write(reportJson.toString(2).toByteArray()) }
            lastReportFile = reportFile
            lastGcodeFile = if (gcodeFile.exists()) gcodeFile else null

            runOnUiThread {
                btnStart.isEnabled = true
                btnShare.isEnabled = true
                progressBar.progress = if (success) 100 else 0
                tvStatus.text = if (success) "Fatiamento concluído (resultado reportado pelo motor)."
                else "Falha no fatiamento: $errorText"
                tvMetrics.text = "Duração: ${durationMs / 1000.0} s\nPico RAM PSS (aprox.): ${peakMemoryBytes / (1024 * 1024)} MB\n" +
                        "Triângulos: ${modelInfo.triangulos} • Dimensões: ${modelInfo.dimensoesFormatadas()} mm\n" +
                        "G-code: ${gcodeSize / 1024} KB\nRelatório e G-code prontos para partilha."
            }
        }
    }

    /** As listas nativas vêm ora como ["nome"], ora como [{"name":"nome"}]. Aceita as duas formas. */
    private fun nomesDe(array: JSONArray): List<String> {
        val nomes = mutableListOf<String>()
        for (i in 0 until array.length()) {
            when (val item = array.opt(i)) {
                is String -> nomes.add(item)
                is JSONObject -> item.optString("name").takeIf { it.isNotEmpty() }?.let { nomes.add(it) }
            }
        }
        return nomes
    }

    private fun copiarPastaAssetsRecursiva(assetPath: String, destDir: File) {
        val list = assets.list(assetPath) ?: return
        if (list.isEmpty()) {
            destDir.parentFile?.mkdirs()
            assets.open(assetPath).use { input ->
                FileOutputStream(destDir).use { output -> input.copyTo(output) }
            }
            return
        }
        destDir.mkdirs()
        for (item in list) {
            val subAsset = if (assetPath.isEmpty()) item else "$assetPath/$item"
            copiarPastaAssetsRecursiva(subAsset, File(destDir, item))
        }
    }

    /** Partilha o relatório JSON e, se existir, o .gcode gerado. */
    private fun shareFiles() {
        val files = listOfNotNull(lastReportFile, lastGcodeFile).filter { it.exists() }
        if (files.isEmpty()) return
        val uris = files.map { FileProvider.getUriForFile(this, "${packageName}.provider", it) }
        val intent = if (uris.size == 1) {
            Intent(Intent.ACTION_SEND).apply { putExtra(Intent.EXTRA_STREAM, uris[0]) }
        } else {
            Intent(Intent.ACTION_SEND_MULTIPLE).apply { putParcelableArrayListExtra(Intent.EXTRA_STREAM, ArrayList(uris)) }
        }.apply {
            type = "*/*"
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        startActivity(Intent.createChooser(intent, "Partilhar relatório e G-code (sem telemetria)"))
    }

    private data class ModelInfo(
        val nome: String,
        val triangulos: Int,
        val dimensoes: DoubleArray,
        val tamanhoBytes: Long,
    ) {
        fun dimensoesFormatadas(): String =
            String.format(Locale.US, "%.2f × %.2f × %.2f", dimensoes[0], dimensoes[1], dimensoes[2])
    }

    /**
     * Lê o STL (binário ou ASCII) e devolve nº de triângulos e caixa envolvente em mm.
     * Não interpreta unidades: assume mm, como o resto do pipeline.
     */
    private fun obterInfoModeloSTL(file: File): ModelInfo {
        val tamanho = file.length()
        var triangulos = 0
        val min = doubleArrayOf(Double.MAX_VALUE, Double.MAX_VALUE, Double.MAX_VALUE)
        val max = doubleArrayOf(-Double.MAX_VALUE, -Double.MAX_VALUE, -Double.MAX_VALUE)

        RandomAccessFile(file, "r").use { raf ->
            val cabecalho = ByteArray(84)
            val lidos = if (tamanho >= 84) raf.read(cabecalho) else -1
            val declarado = if (lidos == 84) {
                (cabecalho[80].toLong() and 0xFF) or
                        ((cabecalho[81].toLong() and 0xFF) shl 8) or
                        ((cabecalho[82].toLong() and 0xFF) shl 16) or
                        ((cabecalho[83].toLong() and 0xFF) shl 24)
            } else -1L
            val binario = declarado > 0 && tamanho == 84 + declarado * 50

            if (binario) {
                triangulos = declarado.toInt()
                raf.seek(84)
                val buf = ByteArray(48)
                for (i in 0 until triangulos) {
                    raf.readFully(buf)
                    for (v in 0 until 3) {
                        val base = v * 12
                        for (eixo in 0 until 3) {
                            val bits = (buf[base + eixo * 4].toInt() and 0xFF) or
                                    ((buf[base + eixo * 4 + 1].toInt() and 0xFF) shl 8) or
                                    ((buf[base + eixo * 4 + 2].toInt() and 0xFF) shl 16) or
                                    ((buf[base + eixo * 4 + 3].toInt() and 0xFF) shl 24)
                            val valor = Float.fromBits(bits).toDouble()
                            if (valor < min[eixo]) min[eixo] = valor
                            if (valor > max[eixo]) max[eixo] = valor
                        }
                    }
                    raf.seek(raf.filePointer + 2) // atributo de 2 bytes no fim de cada faceta
                }
            } else {
                // ASCII: contar "facet normal" e ler "vertex x y z"
                file.bufferedReader().useLines { linhas ->
                    linhas.forEach { linha ->
                        val t = linha.trim()
                        when {
                            t.startsWith("facet normal") -> triangulos++
                            t.startsWith("vertex") -> {
                                val p = t.split(Regex("\\s+"))
                                if (p.size >= 4) {
                                    for (eixo in 0 until 3) {
                                        val valor = p[eixo + 1].toDoubleOrNull() ?: continue
                                        if (valor < min[eixo]) min[eixo] = valor
                                        if (valor > max[eixo]) max[eixo] = valor
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        val dims = if (triangulos > 0) DoubleArray(3) { max[it] - min[it] } else DoubleArray(3)
        return ModelInfo(file.name, triangulos, dims, tamanho)
    }

    companion object {
        private const val REQ_PICK_STL = 1001
    }
}

package io.github.hawaii005.slicerspike

import android.app.Activity
import android.content.Context
import android.content.Intent
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
            if (!isSlicing) {
                runBenchmark()
            }
        }

        btnShare.setOnClickListener {
            shareReport()
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

    private fun runBenchmark() {
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

            // 2. Criar modelo de teste: Cubo fechado 20x20x10 mm (12 triângulos, malha fechada manifold)
            val testDir = File(filesDir, "spike_run")
            testDir.mkdirs()
            val stlFile = File(testDir, "cubo_fechado_20x20x10.stl")
            criarStlCuboFechado20x20x10(stlFile)

            val gcodeFile = File(testDir, "saida_cosmos_afc.gcode")
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

            // 3. Confirmar impressora via nativeGetPrinters() e selecionar
            val printersJsonRaw = NativeLib.nativeGetPrinters()
            val printersArray = try { JSONArray(printersJsonRaw) } catch (e: Exception) { JSONArray() }
            
            val targetPrinter = "Elegoo Centauri Carbon 0.4 nozzle - Cosmos AFC"
            var printerFound = false
            for (i in 0 until printersArray.length()) {
                val p = printersArray.getJSONObject(i).optString("name")
                if (p == targetPrinter) {
                    printerFound = true
                    break
                }
            }

            // Se o perfil de utilizador não aparecer diretamente pelo nome, selecionar o perfil base de sistema
            val activePrinter = if (printerFound) targetPrinter else "Elegoo Centauri Carbon 0.4 nozzle"
            NativeLib.nativeSelectPrinter(activePrinter)

            // 4. Obter filamento e processo compatíveis via funções nativas
            val compatibleFilamentsRaw = NativeLib.nativeGetCompatibleFilaments()
            val compatibleProcessesRaw = NativeLib.nativeGetCompatibleProcesses()

            val filamentsArray = try { JSONArray(compatibleFilamentsRaw) } catch (e: Exception) { JSONArray() }
            val processesArray = try { JSONArray(compatibleProcessesRaw) } catch (e: Exception) { JSONArray() }

            val chosenFilament = if (filamentsArray.length() > 0) {
                filamentsArray.getJSONObject(0).optString("name", "Generic PLA @Elegoo Centauri")
            } else {
                "Generic PLA @Elegoo Centauri"
            }

            val chosenProcess = if (processesArray.length() > 0) {
                processesArray.getJSONObject(0).optString("name", "0.20mm Standard @Elegoo CC 0.4 nozzle")
            } else {
                "0.20mm Standard @Elegoo CC 0.4 nozzle"
            }

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

            val gcodeSize = if (gcodeFile.exists()) gcodeFile.length() else 0L

            val reportJson = JSONObject().apply {
                put("manufacturer", Build.MANUFACTURER)
                put("model", Build.MODEL)
                put("device", Build.DEVICE)
                put("android_release", Build.VERSION.RELEASE)
                put("android_sdk", Build.VERSION.SDK_INT)
                put("duration_ms", durationMs)
                put("peak_ram_pss_mb_approx", peakMemoryBytes / (1024 * 1024))
                put("memory_measurement_method", "Debug.MemoryInfo.totalPss sampled every 200ms (approximate PSS)")
                put("active_printer", activePrinter)
                put("chosen_filament", chosenFilament)
                put("chosen_process", chosenProcess)
                put("success", success)
                put("gcode_size_bytes", gcodeSize)
                put("lifecycle_events", lifecycleEvents)
                put("timestamp", SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date()))
            }

            val reportsDir = getExternalFilesDir("benchmarks") ?: filesDir
            reportsDir.mkdirs()
            val reportFile = File(reportsDir, "benchmark_${Build.MODEL}_${System.currentTimeMillis()}.json")
            FileOutputStream(reportFile).use { it.write(reportJson.toString(2).toByteArray()) }
            lastReportFile = reportFile

            runOnUiThread {
                btnStart.isEnabled = true
                btnShare.isEnabled = true
                progressBar.progress = if (success) 100 else 0
                tvStatus.text = if (success) "Fatiamento concluído com SUCESSO!" else "Falha no fatiamento: ${NativeLib.nativeGetError()}"
                tvMetrics.text = "Duração: ${durationMs / 1000.0} s\nPico RAM PSS (aprox.): ${peakMemoryBytes / (1024 * 1024)} MB\nG-code gerado: ${gcodeSize / 1024} KB\nRelatório guardado localmente."
            }
        }
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

    private fun shareReport() {
        val file = lastReportFile ?: return
        val uri = FileProvider.getUriForFile(this, "${packageName}.provider", file)
        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "application/json"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        startActivity(Intent.createChooser(shareIntent, "Partilhar Relatório de Benchmark (Sem Telemetria)"))
    }

    /**
     * Gera um cubo fechado e estanque (watertight manifold) de 20x20x10 mm com exatamente 12 triângulos (2 por face).
     */
    private fun criarStlCuboFechado20x20x10(file: File) {
        val asciiStl = """
solid cubo_20x20x10_fechado
  facet normal 0 0 -1
    outer loop
      vertex 0 0 0
      vertex 20 20 0
      vertex 20 0 0
    endloop
  endfacet
  facet normal 0 0 -1
    outer loop
      vertex 0 0 0
      vertex 0 20 0
      vertex 20 20 0
    endloop
  endfacet
  facet normal 0 0 1
    outer loop
      vertex 0 0 10
      vertex 20 0 10
      vertex 20 20 10
    endloop
  endfacet
  facet normal 0 0 1
    outer loop
      vertex 0 0 10
      vertex 20 20 10
      vertex 0 20 10
    endloop
  endfacet
  facet normal 0 -1 0
    outer loop
      vertex 0 0 0
      vertex 20 0 0
      vertex 20 0 10
    endloop
  endfacet
  facet normal 0 -1 0
    outer loop
      vertex 0 0 0
      vertex 20 0 10
      vertex 0 0 10
    endloop
  endfacet
  facet normal 1 0 0
    outer loop
      vertex 20 0 0
      vertex 20 20 0
      vertex 20 20 10
    endloop
  endfacet
  facet normal 1 0 0
    outer loop
      vertex 20 0 0
      vertex 20 20 10
      vertex 20 0 10
    endloop
  endfacet
  facet normal 0 1 0
    outer loop
      vertex 20 20 0
      vertex 0 20 0
      vertex 0 20 10
    endloop
  endfacet
  facet normal 0 1 0
    outer loop
      vertex 20 20 0
      vertex 0 20 10
      vertex 20 20 10
    endloop
  endfacet
  facet normal -1 0 0
    outer loop
      vertex 0 20 0
      vertex 0 0 0
      vertex 0 0 10
    endloop
  endfacet
  facet normal -1 0 0
    outer loop
      vertex 0 20 0
      vertex 0 0 10
      vertex 0 20 10
    endloop
  endfacet
endsolid cubo_20x20x10_fechado
        """.trimIndent()
        FileOutputStream(file).use { it.write(asciiStl.toByteArray()) }
    }
}

package io.github.hawaii005.slicerspike

import android.app.Activity
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
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.concurrent.thread

/**
 * Aplicação de Benchmark e Teste de Viabilidade do Fatiador Atalaia.
 * Opera 100% offline, sem contas, sem telemetria e sem rede.
 */
class MainActivity : Activity() {

    private lateinit var tvDeviceInfo: TextView
    private lateinit var tvStatus: TextView
    private lateinit var tvMetrics: TextView
    private lateinit var progressBar: ProgressBar
    private lateinit var btnStart: Button
    private lateinit var btnShare: Button

    private var isSlicing = false
    private var lastReportFile: File? = null
    private val lifecycleEvents = mutableListOf<String>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Flag keepScreenOn ativa para manter o ecrã ligado em primeiro plano
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
        tvStatus.text = "A preparar ficheiro de teste e perfil Cosmos AFC..."

        lifecycleEvents.clear()
        lifecycleEvents.add("startBenchmark at ${System.currentTimeMillis()}")

        thread {
            val startTime = SystemClock.elapsedRealtime()
            var peakMemoryBytes: Long = 0

            // Preparar ficheiro STL e Perfil na cache local da app
            val testDir = File(filesDir, "spike_run")
            testDir.mkdirs()
            val stlFile = File(testDir, "calibracao_cubo_20mm.stl")
            if (!stlFile.exists()) {
                criarStlMinimoExemplo(stlFile)
            }
            val gcodeFile = File(testDir, "saida_cosmos_afc.gcode")
            if (gcodeFile.exists()) gcodeFile.delete()

            val profileJson = """
                {
                  "name": "Elegoo Centauri Carbon 0.4 nozzle - Cosmos AFC",
                  "gcode_flavor": "klipper",
                  "printable_area": ["0x0", "256x0", "256x256", "0x256"],
                  "printable_height": "256",
                  "initial_tool": 0
                }
            """.trimIndent()

            runOnUiThread {
                tvStatus.text = "A inicializar motor nativo libslic3r..."
            }

            NativeSlicerSpike.init(profileJson)

            // Thread de monitorização de memória e progresso
            var progress = 0
            val monitorThread = thread {
                while (isSlicing) {
                    val memInfo = Debug.MemoryInfo()
                    Debug.getMemoryInfo(memInfo)
                    val totalPssBytes = memInfo.totalPss * 1024L
                    if (totalPssBytes > peakMemoryBytes) {
                        peakMemoryBytes = totalPssBytes
                    }
                    progress = NativeSlicerSpike.getProgress()
                    runOnUiThread {
                        progressBar.progress = progress
                        tvMetrics.text = "Progresso: $progress% • RAM PSS Atual: ${totalPssBytes / (1024 * 1024)} MB"
                    }
                    Thread.sleep(200)
                }
            }

            // Executar fatiamento
            val resultCode = NativeSlicerSpike.slice(
                stlFile.absolutePath,
                gcodeFile.absolutePath,
                "{}"
            )
            val durationMs = SystemClock.elapsedRealtime() - startTime
            isSlicing = false
            monitorThread.join()

            val gcodeSize = if (gcodeFile.exists()) gcodeFile.length() else 0L

            // Gerar relatório JSON gravado em ficheiro partilhável
            val reportJson = JSONObject().apply {
                put("manufacturer", Build.MANUFACTURER)
                put("model", Build.MODEL)
                put("device", Build.DEVICE)
                put("android_release", Build.VERSION.RELEASE)
                put("android_sdk", Build.VERSION.SDK_INT)
                put("duration_ms", durationMs)
                put("peak_ram_pss_mb", peakMemoryBytes / (1024 * 1024))
                put("result_code", resultCode)
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
                progressBar.progress = 100
                tvStatus.text = if (resultCode == 0) "Fatiamento concluído com SUCESSO!" else "Erro no fatiamento: código $resultCode"
                tvMetrics.text = "Duração: ${durationMs / 1000.0} s\nPico RAM PSS: ${peakMemoryBytes / (1024 * 1024)} MB\nG-code: ${gcodeSize / 1024} KB\nRelatório guardado localmente."
            }
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

    private fun criarStlMinimoExemplo(file: File) {
        // Gera um cubo STL ASCII simplificado de calibração 20x20x10 mm para o teste
        val asciiStl = """
            solid cubo_calibracao_20mm
              facet normal 0 0 -1
                outer loop
                  vertex 0 0 0
                  vertex 20 0 0
                  vertex 20 20 0
                endloop
              endfacet
              facet normal 0 0 -1
                outer loop
                  vertex 0 0 0
                  vertex 20 20 0
                  vertex 0 20 0
                endloop
              endfacet
              facet normal 0 0 1
                outer loop
                  vertex 0 0 10
                  vertex 20 20 10
                  vertex 20 0 10
                endloop
              endfacet
              facet normal 0 0 1
                outer loop
                  vertex 0 0 10
                  vertex 0 20 10
                  vertex 20 20 10
                endloop
              endfacet
            endsolid cubo_calibracao_20mm
        """.trimIndent()
        FileOutputStream(file).use { it.write(asciiStl.toByteArray()) }
    }
}

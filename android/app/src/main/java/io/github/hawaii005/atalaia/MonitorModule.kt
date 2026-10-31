package io.github.hawaii005.atalaia

import android.content.Intent
import android.os.Build
import android.os.SystemClock
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

/** Ponte para o serviço em primeiro plano que mantém a app viva. */
class MonitorModule(private val contexto: ReactApplicationContext) :
  ReactContextBaseJavaModule(contexto) {

  override fun getName() = "MonitorServico"

  @ReactMethod
  fun iniciar(titulo: String, texto: String, promise: Promise?) {
    iniciarServico(Intent(contexto, MonitorService::class.java).apply {
      putExtra("titulo", titulo)
      putExtra("texto", texto)
    }, promise)
  }

  @ReactMethod
  fun atualizar(
    titulo: String,
    texto: String,
    progresso: Double,
    indeterminado: Boolean,
    tituloOffline: String,
    textoOffline: String,
    validadeMs: Double,
    promise: Promise?
  ) {
    iniciarServico(Intent(contexto, MonitorService::class.java).apply {
      putExtra("titulo", titulo)
      putExtra("texto", texto)
      putExtra("progresso", progresso)
      putExtra("indeterminado", indeterminado)
      putExtra("tituloOffline", tituloOffline)
      putExtra("textoOffline", textoOffline)
      putExtra("validadeMs", validadeMs)
      putExtra("recebidoEm", SystemClock.elapsedRealtime())
    }, promise)
  }

  private fun iniciarServico(intencao: Intent, promise: Promise?) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        contexto.startForegroundService(intencao)
      } else {
        contexto.startService(intencao)
      }
      promise?.resolve(true)
    } catch (erro: Exception) {
      promise?.reject("ERRO_MONITOR", erro)
    }
  }

  @ReactMethod
  fun parar(promise: Promise?) {
    try {
      contexto.stopService(Intent(contexto, MonitorService::class.java))
      promise?.resolve(true)
    } catch (erro: Exception) {
      promise?.reject("ERRO_MONITOR", erro)
    }
  }
}

class MonitorPackage : com.facebook.react.ReactPackage {
  override fun createNativeModules(contexto: ReactApplicationContext): List<com.facebook.react.bridge.NativeModule> =
    listOf(MonitorModule(contexto))

  override fun createViewManagers(
    contexto: ReactApplicationContext
  ): List<com.facebook.react.uimanager.ViewManager<*, *>> = emptyList()
}

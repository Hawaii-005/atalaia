package io.github.hawaii005.atalaia

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import android.util.Log
import android.widget.Toast

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.modules.core.DeviceEventManagerModule

import expo.modules.ReactActivityDelegateWrapper

import java.io.File

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    super.onCreate(null)
    receberPartilha(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    receberPartilha(intent)
  }

  /**
   * Guarda os ficheiros que chegam pelo «Partilhar» (ACTION_SEND) ou por
   * «Abrir com» (ACTION_VIEW). A leitura do `content://` tem de ser feita
   * aqui: a permissão morre com o intent e o JS já não conseguia abrir o
   * ficheiro mais tarde sem uma cópia.
   */
  private fun receberPartilha(intent: Intent?) {
    if (intent == null) return
    val acao = intent.action ?: return
    if (acao != Intent.ACTION_SEND && acao != Intent.ACTION_VIEW) return

    @Suppress("DEPRECATION")
    val doExtra = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
    val uris = listOfNotNull(doExtra ?: intent.data)
    if (uris.isEmpty()) return

    var recebidos = 0
    uris.forEach { uri ->
      val copia = copiarParaCache(uri)
      if (copia != null) {
        CaixaDePartilha.juntar(copia.absolutePath, nomeDe(uri) ?: copia.name)
        recebidos += 1
      }
    }

    if (recebidos == 0) {
      Toast.makeText(this, "Não foi possível ler o ficheiro partilhado", Toast.LENGTH_LONG)
          .show()
      return
    }
    avisarJs()
  }

  /** Emite o aviso para o JS, se ele já estiver a correr. */
  private fun avisarJs() {
    try {
      val contexto =
          (application as MainApplication)
              .reactNativeHost
              .reactInstanceManager
              .currentReactContext
      contexto
          ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          ?.emit("atalaiaPartilha", null)
    } catch (e: Exception) {
      Log.w("AtalaiaPartilha", "JS ainda não está pronto: ${e.message}")
    }
  }

  private fun nomeDe(uri: Uri): String? {
    if (uri.scheme == "content") {
      contentResolver
          .query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
          ?.use { cursor ->
            if (cursor.moveToFirst() && !cursor.isNull(0)) return cursor.getString(0)
          }
    }
    return uri.lastPathSegment?.substringAfterLast('/')
  }

  private fun copiarParaCache(uri: Uri): File? {
    val nome = (nomeDe(uri) ?: "partilhado.gcode").replace('/', '_')
    val pasta = File(cacheDir, "partilha").apply { mkdirs() }
    val destino = File(pasta, "${System.currentTimeMillis()}-$nome")
    return try {
      val entrada =
          if (uri.scheme == "content") {
            contentResolver.openInputStream(uri)
          } else {
            uri.path?.let { File(it).inputStream() }
          } ?: return null
      entrada.use { origem -> destino.outputStream().use { origem.copyTo(it) } }
      destino
    } catch (e: Exception) {
      Log.w("AtalaiaPartilha", "Falhou a copiar $uri: ${e.message}")
      null
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}

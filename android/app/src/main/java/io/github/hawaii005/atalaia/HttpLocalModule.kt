package io.github.hawaii005.atalaia

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * GET em claro sem seguir redireccionamentos. Existe porque o `fetch` do React
 * Native é `whatwg-fetch` sobre o XHR nativo, que ignora `redirect: 'manual'` e
 * seguia um 302 para qualquer host — inclusive fora da rede privada. Aqui o
 * salto é decidido em JS: devolvemos o 3xx e a localização, sem a seguir.
 */
class HttpLocalModule(private val contexto: ReactApplicationContext) :
    ReactContextBaseJavaModule(contexto) {

  override fun getName(): String = "HttpLocal"

  private val executor = Executors.newCachedThreadPool()

  @ReactMethod
  fun pedirJson(url: String, tempoLimiteMs: Double, promessa: Promise) {
    executor.execute {
      var ligacao: HttpURLConnection? = null
      try {
        ligacao = (URL(url).openConnection() as HttpURLConnection).apply {
          requestMethod = "GET"
          instanceFollowRedirects = false
          connectTimeout = tempoLimiteMs.toInt()
          readTimeout = tempoLimiteMs.toInt()
          setRequestProperty("Accept", "application/json")
        }
        val estado = ligacao.responseCode
        val resultado = Arguments.createMap()
        resultado.putInt("status", estado)
        if (estado in 300..399) {
          resultado.putString("location", ligacao.getHeaderField("Location"))
        } else {
          val corpo = (
              if (estado in 200..299) ligacao.inputStream
              else ligacao.errorStream
            )
              ?.bufferedReader()?.use { it.readText() } ?: ""
          resultado.putString("body", corpo)
        }
        promessa.resolve(resultado)
      } catch (e: Exception) {
        promessa.reject("rede_falhou", e.message, e)
      } finally {
        ligacao?.disconnect()
      }
    }
  }
}

class HttpLocalPackage : com.facebook.react.ReactPackage {
  override fun createNativeModules(contexto: ReactApplicationContext) =
      listOf<com.facebook.react.bridge.NativeModule>(HttpLocalModule(contexto))

  override fun createViewManagers(contexto: ReactApplicationContext) =
      emptyList<com.facebook.react.uimanager.ViewManager<*, *>>()
}

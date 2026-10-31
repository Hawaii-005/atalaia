package io.github.hawaii005.atalaia

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import kotlin.math.roundToInt

/**
 * Mantém a notificação da impressão e expira dados sem heartbeat.
 * O WebSocket e os avisos de conclusão continuam a ser do JavaScript.
 */
class MonitorService : Service() {

  private val handler = Handler(Looper.getMainLooper())
  private var expiracao: Runnable? = null
  private var expiraEm: Long? = null
  private var notificacaoOffline: Notification? = null
  private val telaLigada = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (intent?.action == Intent.ACTION_SCREEN_ON) verificarExpiracao()
    }
  }

  override fun onCreate() {
    super.onCreate()
    val filtro = IntentFilter(Intent.ACTION_SCREEN_ON)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerReceiver(telaLigada, filtro, Context.RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("DEPRECATION")
      registerReceiver(telaLigada, filtro)
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    cancelarExpiracao()
    criarCanal()
    val titulo = intent?.getStringExtra("titulo") ?: "Atalaia"
    val texto = intent?.getStringExtra("texto") ?: "Monitoring your print"
    val valor = intent?.getDoubleExtra("progresso", Double.NaN) ?: Double.NaN
    val progresso = if (valor.isFinite()) valor.coerceIn(0.0, 100.0).roundToInt() else null
    val indeterminado = intent?.getBooleanExtra("indeterminado", true) != false || progresso == null
    val tituloOffline = intent?.getStringExtra("tituloOffline") ?: "Atalaia"
    val textoOffline = intent?.getStringExtra("textoOffline") ?: "Monitoring your print"
    val temValidade = intent?.hasExtra("validadeMs") == true
    val validade = intent?.getDoubleExtra("validadeMs", 0.0) ?: 0.0
    val validadeMs = if (validade.isFinite()) {
      validade.coerceIn(0.0, MAX_VALIDADE_MS.toDouble()).toLong()
    } else {
      0L
    }
    val agora = SystemClock.elapsedRealtime()
    val recebidoEm = intent?.getLongExtra("recebidoEm", agora) ?: agora
    val restanteMs = (validadeMs - (agora - recebidoEm).coerceAtLeast(0L)).coerceAtLeast(0L)
    val offline = temValidade && restanteMs == 0L
    val progressoOffline = if (indeterminado) null else progresso
    val notificacao = if (offline) {
      criarNotificacao(tituloOffline, textoOffline, progressoOffline, false)
    } else {
      criarNotificacao(titulo, texto, progresso, indeterminado)
    }
    startForeground(ID, notificacao)

    if (temValidade && !offline) {
      expiraEm = agora + restanteMs
      notificacaoOffline = criarNotificacao(tituloOffline, textoOffline, progressoOffline, false)
      expiracao = Runnable { verificarExpiracao() }.also { handler.postDelayed(it, restanteMs) }
    }
    return START_NOT_STICKY
  }

  private fun criarNotificacao(
    titulo: String,
    texto: String,
    progresso: Int?,
    indeterminado: Boolean
  ): Notification {
    val imutavel = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
    val abrir = PendingIntent.getActivity(
      this,
      0,
      Intent(this, MainActivity::class.java),
      imutavel or PendingIntent.FLAG_UPDATE_CURRENT
    )
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CANAL)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }
    return builder
      .setContentTitle(titulo)
      .setContentText(texto)
      .setStyle(Notification.BigTextStyle().bigText(texto))
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setPriority(Notification.PRIORITY_LOW)
      .setProgress(if (progresso != null || indeterminado) 100 else 0, progresso ?: 0, indeterminado)
      .setContentIntent(abrir)
      .build()
  }

  private fun criarCanal() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val gerente = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val nome = applicationInfo.loadLabel(packageManager).toString().ifBlank { "Atalaia" }
    val canal = gerente.getNotificationChannel(CANAL) ?: NotificationChannel(
      CANAL,
      nome,
      NotificationManager.IMPORTANCE_LOW
    )
    canal.name = nome
    canal.setShowBadge(false)
    gerente.createNotificationChannel(canal)
  }

  private fun cancelarExpiracao() {
    expiracao?.let { handler.removeCallbacks(it) }
    expiracao = null
    expiraEm = null
    notificacaoOffline = null
  }

  private fun verificarExpiracao() {
    val limite = expiraEm ?: return
    val notificacao = notificacaoOffline ?: return
    // O Handler usa uptime; ao ligar a tela, inclui também o tempo em suspensão.
    if (SystemClock.elapsedRealtime() < limite) return
    cancelarExpiracao()
    val gerente = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    gerente.notify(ID, notificacao)
  }

  override fun onDestroy() {
    cancelarExpiracao()
    unregisterReceiver(telaLigada)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }
    super.onDestroy()
  }

  companion object {
    const val CANAL = "atalaia-monitor"
    const val ID = 4711
    private const val MAX_VALIDADE_MS = 24 * 60 * 60 * 1000L
  }
}

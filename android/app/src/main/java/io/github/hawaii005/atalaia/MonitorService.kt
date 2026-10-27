package io.github.hawaii005.atalaia

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder

/**
 * Serviço em primeiro plano mínimo: existe só para o Android não matar a app
 * enquanto acompanha uma impressão. Não faz trabalho próprio — o WebSocket e
 * os avisos continuam a ser do JavaScript.
 */
class MonitorService : Service() {

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val abrir = PendingIntent.getActivity(
      this,
      0,
      Intent(this, MainActivity::class.java),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )
    val titulo = intent?.getStringExtra("titulo") ?: "Atalaia"
    val texto = intent?.getStringExtra("texto") ?: "Monitoring your print"
    criarCanal(titulo)

    val notificacao: Notification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CANAL)
        .setContentTitle(titulo)
        .setContentText(texto)
        .setSmallIcon(applicationInfo.icon)
        .setOngoing(true)
        .setContentIntent(abrir)
        .build()
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
        .setContentTitle(titulo)
        .setContentText(texto)
        .setSmallIcon(applicationInfo.icon)
        .setOngoing(true)
        .setContentIntent(abrir)
        .build()
    }

    startForeground(ID, notificacao)
    return START_NOT_STICKY
  }

  private fun criarCanal(nome: String) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val gerente = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val canal = gerente.getNotificationChannel(CANAL) ?: NotificationChannel(
      CANAL,
      nome,
      NotificationManager.IMPORTANCE_LOW
    )
    canal.name = nome
    canal.setShowBadge(false)
    gerente.createNotificationChannel(canal)
  }

  companion object {
    const val CANAL = "atalaia-monitor"
    const val ID = 4711
  }
}

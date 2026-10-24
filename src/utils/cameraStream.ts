/**
 * Página mínima que mostra o vídeo MJPEG da Centauri num WebView.
 *
 * A impressora aceita UMA ligação de vídeo de cada vez e não a liberta depressa:
 * qualquer ciclo de recarregamentos acaba em HTTP 500 e a câmara só volta com um
 * corte de corrente. Por isso: uma <img> carregada uma vez, sem mensagens, e nova
 * tentativa só se o browser der erro (com recuo exponencial).
 */
export const htmlDoVideo = (
  host: string,
  ajuste: 'cover' | 'contain' = 'cover',
  circular = false
): string => {
  if (!host) return '';
  const url = `http://${host}:3031/video`;
  // O recorte redondo é feito na página, não na vista nativa: um WebView dentro
  // de um pai com `overflow: hidden` + borderRadius fica preto no Android.
  const estiloCorpo = circular
    ? 'background: transparent;'
    : 'background: #000;';
  const estiloImagem = circular
    ? 'width: 100%; height: 100%; object-fit: cover; display: block; border-radius: 50%;'
    : `width: 100%; height: 100%; object-fit: ${ajuste}; display: block;`;
  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <style>
      html, body { margin: 0; padding: 0; ${estiloCorpo} height: 100%; overflow: hidden; }
      img { ${estiloImagem} }
    </style>
  </head>
  <body>
    <img id="v" src="${url}" />
    <script>
      (function () {
        var im = document.getElementById('v');
        var espera = 20000;
        var vivo = true;
        im.onload = function () { espera = 20000; };
        im.onerror = function () {
          if (!vivo) return;
          setTimeout(function () {
            if (vivo) im.src = '${url}?t=' + Date.now();
          }, espera);
          espera = Math.min(espera * 2, 60000);
        };
        window.addEventListener('pagehide', function () {
          vivo = false;
          im.removeAttribute('src');
        });
      })();
    </script>
  </body>
</html>`;
};

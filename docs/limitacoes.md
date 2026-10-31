# Limitações Conhecidas do Ataláia

## Modo Remoto (Tailscale)
- **Descoberta UDP**: A varredura automática por broadcast UDP (:3000) e multicast só funciona quando o telemóvel está na mesma rede Wi-Fi local da impressora. Em ligações Tailscale (modo remoto), a descoberta automática não encontra a impressora; o utilizador deve introduzir o endereço IP/hostname alternativo em `Editar IP`.
- **Tráfego sem TLS**: O Android `networkSecurityConfig` do Ataláia está configurado para permitir ligações HTTP/WebSocket não encriptadas (`ws://`, `http://`) para sub-redes privadas (`10.0.0.0/8`, `192.168.0.0/16`), `localhost` e domínios MagicDNS do Tailscale (`*.ts.net`).
- **Stream MJPEG (Centauri Carbon)**: A câmara MJPEG (:3031) aceita apenas uma ligação de stream em simultâneo. Se a app oficial da Elegoo ou outra instância estiver ligada à câmara, o Ataláia utilizará o modo de fotografia instantânea (`/snapshot` ou canal fotograma).

## Protocolo SDCP V1 (Saturn 3 Ultra)
- **Ligação Invertida (MQTT)**: Na Saturn 3 Ultra, é a impressora que se liga ao broker MQTT da app via UDP `:3000`. Por este motivo, para funcionar fora de casa sem um relay dedicado, a impressora e o telemóvel precisam de se alcançar na mesma sub-rede ou VPN de camada 2.

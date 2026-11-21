# Segurança e Assinatura de Releases

## Ficheiros Sensíveis e Git
- **Keystore**: O ficheiro de chaves de assinatura Android (`atalaia.keystore` / `keystore.properties`) nunca deve ser commitado no repositório. O ficheiro `.gitignore` garante a exclusão de `android/keystore.properties`, `*.jks`, `*.p8`, `*.p12`, `*.key` e ficheiros `.env`.

## Assinatura no CI/CD
- No GitHub Actions, as compilações de release utilizam segredos do repositório (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`).
- O processo descodifica o keystore no runner e injeta os valores em variáveis de ambiente para a tarefa `assembleRelease`.

## Cópia de Segurança JSON
- A função de exportação de dados gera um ficheiro JSON local com os nomes e endereços IP da rede do utilizador. O ecrã de exportação apresenta um aviso prévio de privacidade antes de gravar o ficheiro.

## Tráfego HTTP em claro (decisão pendente)

- **Estado**: `android/app/src/main/res/xml/network_security_config.xml` tem `base-config cleartextTrafficPermitted="true"` — HTTP permitido para **qualquer** host, público incluído. O `<domain-config>` que lá está não limita nada: a base já deixa passar tudo.
- **Porque está assim**: as impressoras são faladas por IP privado com DHCP (o endereço muda). O Android não aceita intervalos CIDR no NSC e listar domínios não resolve IPs.
- **Mitigação em vigor**: `src/utils/httpLocal.ts` (`pedirLocal`/`pedirJsonLocal`) é o único ponto de saída HTTP do fatiador e do AFC. Recusa hosts fora de 127/8, 10/8, 172.16/12, 192.168/16, 100.64/10 (Tailscale) e nomes `.local`/`.ts.net`, e recusa redireccionamentos para fora dessa rede (máx. 3 saltos).
- **Pendente de decisão (Bruno)**:
  1. deixar como está;
  2. `base-config` a `false` e whitelist de IPs — quebra com DHCP e obriga a reconfigurar quando a máquina muda de endereço;
  3. manter cleartext e migrar **todas** as chamadas para `pedirLocal` (driver Moonraker, thumbnails, SDCP), ficando a fronteira garantida no código.
- Não alterar o `network_security_config` sem aprovação explícita.

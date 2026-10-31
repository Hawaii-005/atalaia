# Segurança e Assinatura de Releases

## Ficheiros Sensíveis e Git
- **Keystore**: O ficheiro de chaves de assinatura Android (`atalaia.keystore` / `keystore.properties`) nunca deve ser commitado no repositório. O ficheiro `.gitignore` garante a exclusão de `android/keystore.properties`, `*.jks`, `*.p8`, `*.p12`, `*.key` e ficheiros `.env`.

## Assinatura no CI/CD
- No GitHub Actions, as compilações de release utilizam segredos do repositório (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`).
- O processo descodifica o keystore no runner e injeta os valores em variáveis de ambiente para a tarefa `assembleRelease`.

## Cópia de Segurança JSON
- A função de exportação de dados gera um ficheiro JSON local com os nomes e endereços IP da rede do utilizador. O ecrã de exportação apresenta um aviso prévio de privacidade antes de gravar o ficheiro.

# Plano de Distribuição do Ataláia

Este documento compara os canais de distribuição para a aplicação Android Ataláia.

---

## Comparativo de Canais

| Canal | Custo | Requisitos de Conta | Prós | Contras | Assinatura de Código |
|---|---|---|---|---|---|
| **GitHub Releases** *(Atual)* | Gratuito | Conta GitHub (grátis) | Instantâneo, sem revisão, APKs diretos, sem restrições de permissões nativas | Exige download manual do APK pelo utilizador ou app de update externa | Chave do programador (`atalaia.keystore`) em segredos de CI |
| **F-Droid** | Gratuito | Sem conta (repositório comunitário / submissão Merge Request) | Repositório confiável Open-Source, atualizações automáticas via F-Droid client | Exige compilação a partir de código fonte por reprodução exata, processo de auditoria longo | Compilado e assinado pelos servidores do F-Droid ou via repositório personalizado IzzyOnDroid |
| **Google Play Store** | $25 USD (taxa única) | Conta de Programador Google Play (verificação de identidade exigida) | Maior alcance de utilizadores, atualizações automáticas simplificadas | Regras estritas de permissões (Foreground Service, notificações), processo de revisão manual que pode rejeitar apps de controlo local | Play App Signing (chave de upload enviada à Google) |

---

## Recomendação
1. **Curto Prazo (Atual)**: Manter **GitHub Releases** como canal principal de APKs pré-compilados.
2. **Médio Prazo (Comunidade Open Source)**: Submeter o Ataláia ao repositório **IzzyOnDroid / F-Droid**, garantindo distribuição auditável e automática para utilizadores de software livre.
3. **Longo Prazo**: Submissão na Google Play Store apenas caso exista procura por instalação nativa sem side-loading.

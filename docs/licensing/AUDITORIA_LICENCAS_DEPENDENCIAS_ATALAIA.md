# Auditoria de Licenças das Dependências do Atalaia (Variante Completa sob AGPL-3)

Documento de auditoria de conformidade para todas as dependências declaradas em `package.json` no Atalaia (`Hawaii-005/atalaia`) no cenário de distribuição da **variante completa sob licença GNU AGPL-3.0-or-later**.

---

## 1. Princípio de Compatibilidade com a GNU AGPL v3.0

Quando a variante completa do Atalaia é distribuída sob os termos da **GNU AGPL-3.0-or-later**, todas as dependências incorporadas no pacote final têm de ser compatíveis com a AGPL-3:
* **Licenças Permissivas (MIT, Apache-2.0, BSD-2/3-Clause, ISC):** Totalmente compatíveis. Podem ser combinadas num trabalho derivado maior sob AGPL-3, desde que os avisos originais de copyright e termos sejam preservados no ficheiro `NOTICE`.
* **Licenças Copyleft Fraco (MPL-2.0, LGPL):** Compatíveis quando o código permanece em ficheiros/módulos separados.
* **Licenças com Restrições Comerciais ou Cláusulas de Não-Comercial (ex.: CC-BY-NC):** **Incompatíveis** com a AGPL-3. Nenhuma dependência deste tipo pode ser incluída.

---

## 2. Matriz de Auditoria de Dependências de Produção (`dependencies`)

| Dependência | Versão Declarada | Licença | Compatibilidade AGPL-3 | Observações |
|---|---|---|---|---|
| `@expo/metro-runtime` | `~5.0.4` | **MIT** | Compatível | Runtime web Metro |
| `@expo/vector-icons` | `^14.1.0` | **MIT** | Compatível | Fontes sob licenças SIL OFL / Apache |
| `@generac/react-native-local-network-permission` | `^1.2.0` | **MIT** | Compatível | Permissões iOS de rede local |
| `@react-native-async-storage/async-storage` | `^2.2.0` | **MIT** | Compatível | Armazenamento local de chave-valor |
| `@react-navigation/bottom-tabs` | `^7.4.2` | **MIT** | Compatível | Navegação |
| `@react-navigation/drawer` | `^7.14.4` | **MIT** | Compatível | Navegação |
| `@react-navigation/native` | `^7.1.14` | **MIT** | Compatível | Navegação |
| `@react-navigation/stack` | `^7.4.2` | **MIT** | Compatível | Navegação |
| `expo` | `^53.0.19` | **MIT** | Compatível | Framework base Expo |
| `expo-build-properties` | `~0.14.8` | **MIT** | Compatível | Plugin de build Gradle |
| `expo-dev-client` | `^5.2.4` | **MIT** | Compatível | Ferramenta de desenvolvimento |
| `expo-document-picker` | `~13.1.6` | **MIT** | Compatível | Seletor de ficheiros STL/3MF |
| `expo-file-system` | `~18.1.11` | **MIT** | Compatível | Gestão de ficheiros locais |
| `expo-keep-awake` | `~14.1.4` | **MIT** | Compatível | Flag de ecrã ativo (`keepScreenOn`) |
| `expo-localization` | `~16.1.6` | **MIT** | Compatível | Deteção de idioma do SO |
| `expo-media-library` | `~17.1.7` | **MIT** | Compatível | Acesso a armazenamento |
| `expo-navigation-bar` | `~4.2.7` | **MIT** | Compatível | Estilo da barra de navegação Android |
| `expo-network` | `~7.1.5` | **MIT** | Compatível | Deteção de estado de rede local |
| `expo-notifications` | `~0.31.5` | **MIT** | Compatível | Subscrição de eventos |
| `expo-screen-orientation` | `~8.1.7` | **MIT** | Compatível | Gestão de orientação tablet/phone |
| `expo-sharing` | `~13.1.5` | **MIT** | Compatível | Partilha local (`ACTION_SEND`) |
| `expo-status-bar` | `~2.2.3` | **MIT** | Compatível | Barra de estado do SO |
| `nativewind` | `latest` | **MIT** | Compatível | Camada Tailwind CSS para React Native |
| `react` | `19.0.0` | **MIT** | Compatível | Biblioteca base de componentes |
| `react-dom` | `19.0.0` | **MIT** | Compatível | React DOM |
| `react-native` | `0.79.5` | **MIT** | Compatível | Core React Native |
| `react-native-gesture-handler` | `^2.27.1` | **MIT** | Compatível | Gestos |
| `react-native-pager-view` | `^6.8.1` | **Apache-2.0** | Compatível | Componente de paginação |
| `react-native-progress` | `^5.0.1` | **MIT** | Compatível | Barras de progresso |
| `react-native-reanimated` | `~3.17.4` | **MIT** | Compatível | Animações |
| `react-native-safe-area-context` | `^5.4.0` | **MIT** | Compatível | Margens seguras de ecrã |
| `react-native-screens` | `^4.12.0` | **MIT** | Compatível | Otimização de vistas nativas |
| `react-native-svg` | `15.11.2` | **MIT** | Compatível | Renderização de gráficos e wireframes |
| `react-native-tcp-socket` | `^6.4.3` | **MIT** | Compatível | Protocolo de rede local |
| `react-native-udp` | `^4.1.7` | **MIT** | Compatível | Descoberta SSDP/UDP na LAN |
| `react-native-view-shot` | `4.0.3` | **MIT** | Compatível | Captura de vistas |
| `react-native-web` | `^0.20.0` | **MIT** | Compatível | Componentes web |
| `react-native-webview` | `^13.15.0` | **MIT** | Compatível | Candidato a visor 3D offline |
| `spark-md5` | `^3.0.2` | **BSD-2-Clause** | Compatível | Cálculo de hashes de ficheiros |
| `yup` | `^1.6.1` | **MIT** | Compatível | Validação de esquemas |

---

## 3. Conclusão da Auditoria

1. **Ausência de Incompatibilidades:** Todas as 40 dependências diretas de produção utilizam licenças permissivas (**MIT**, **Apache-2.0** ou **BSD-2-Clause**).
2. **Conformidade com a AGPL-3:** Nenhuma dependência utiliza licenças restritivas incompatíveis com o copyleft forte da GNU AGPL v3.0. A variante completa pode ser validamente distribuída sob AGPL-3.0-or-later, cumprindo a exigência de atribuição através do ficheiro `NOTICE`.

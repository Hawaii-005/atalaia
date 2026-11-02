# Especificação de Compatibilidade Dual: SDCP (Stock) vs COSMOS (Moonraker)

Documento de arquitetura e design para a introdução da camada agnóstica de drivers no Atalaia (CC Tool), suportando tanto o firmware original da Elegoo (SDCP) quanto o firmware comunitário OpenCentauri COSMOS (Klipper/Moonraker).

---

## 1. Lista Numerada dos Blocos de Interface (Wireframes)

Conforme ilustrado em `wireframe-phone-390x844.svg` e `wireframe-tablet-1180x740.svg`:

1. **[1] Cabeçalho do Ecrã:** Título contextualizado ("Adicionar Impressora" ou "Editar Impressora") com suporte de acessibilidade e navegação de retorno.
2. **[2] Nome da Impressora:** Campo de texto livre para etiquetagem local da máquina.
3. **[3] Endereço IP (LAN):** Endereço IPv4 local da impressora na rede Wi-Fi.
4. **[4] Endereço Alternativo (Tailscale / VPN):** Endereço opcional para acesso remoto ou túnel VPN, permitindo comutação automática em caso de falha no IP de LAN.
5. **[5] Seletor de Firmware / Protocolo:**
   - **Detetar automaticamente (Recomendado):** Faz um teste de probing em `:7125` (Moonraker) e `:3030` (SDCP).
   - **Original Elegoo (SDCP :3030):** Força o uso estrito do protocolo SDCP.
   - **COSMOS / Klipper (Moonraker :7125):** Força o protocolo Moonraker JSON-RPC e REST.
6. **[6] Botão Testar Ligação:** Ação manual com área de toque mínima de 48px que efetua o teste imediato contra ambos os endereços configurados.
7. **[7] Painel Resultado do Teste:** Apresenta claramente o sucesso ou falha, o protocolo ativo detetado, a versão reportada (`server.info` ou `Attributes`), latência em milissegundos e estado de autenticação.
8. **[8] Painel de Capacidades e Avisos:** Informa antecipadamente o utilizador sobre o que fica ativo ou desativado de acordo com o firmware selecionado.
9. **[9] Barra de Ações (Guardar / Cancelar):** Persistência segura no `AsyncStorage` com migração retrocompatível do schema.

---

## 2. Matriz de Capacidades

| Funcionalidade / Capacidade | SDCP (Original Elegoo) | Moonraker / COSMOS | Notas / Justificação técnica |
|---|---|---|---|
| **Estado da Impressora (Status)** | Suportado | Suportado | SDCP via Cmd 1/WebSocket; COSMOS via `printer.objects.subscribe` (`print_stats`). |
| **Temperaturas (Bocal / Mesa)** | Suportado | Suportado | SDCP via telemetria contínua; COSMOS via objetos `extruder` e `heater_bed`. |
| **Progresso da Impressão** | Suportado | Suportado | SDCP via `PrintInfo.Progress`; COSMOS via objeto `display_status.progress`. |
| **Câmara / Vídeo ao Vivo** | Suportado | Suportado | SDCP via MJPEG na porta `:3031`; COSMOS via endpoint `/server/webcams/list` (MJPEG padrão). |
| **Ficheiros e Miniaturas** | Suportado | Suportado | SDCP via Cmd 258/260; COSMOS via `/server/files/list` e `/server/files/thumbnails`. |
| **Enviar Ficheiro (Upload)** | Suportado | Suportado | SDCP via porta `:3030`/Cmd de upload; COSMOS via multipart POST `/server/files/upload`. |
| **Iniciar / Pausar / Retomar / Parar** | Suportado | Suportado | SDCP via Cmds 128, 129, 131, 130; COSMOS via RPC `printer.print.pause/resume/cancel/start`. |
| **Fila de Impressão (Queue)** | Suportado (Local) | Suportado (Local) | A app mantém a sua fila local unificada com validação de Ack e estados reais da mesa. |
| **Histórico de Impressão** | Suportado (Local) | Suportado | Mantido localmente associado ao `id` da impressora física para nunca perder dados ao trocar de firmware. |
| **Luz da Câmara / Câmara Interna** | Suportado | Suportado | SDCP via Cmd 403 `LightStatus.SecondLight`; COSMOS via G-code macro `SET_PIN PIN=caselight VALUE=1/0`. |
| **Ventoinhas (Peça / Auxiliar)** | Suportado | Suportado | SDCP via Cmd 404; COSMOS via G-code `M106 P... S...` ou macros específicas do COSMOS. |
| **Velocidade de Impressão (Feedrate)** | Suportado | Suportado | SDCP via Cmd 405; COSMOS via G-code `M220 S...`. |
| **Movimento por Eixos (Jog)** | Suportado | Suportado | SDCP via Cmd 401; COSMOS via G-code `G91 \n G1 <Axis><Step> F3000 \n G90`. |
| **Home (G28)** | Suportado | Suportado | SDCP via Cmd 402; COSMOS via G-code `G28` (ou `G28 <Axis>`). |
| **Aquecimento Manual** | Suportado | Suportado | SDCP via Cmd 406; COSMOS via G-code `M104/M140`. |
| **Carregar / Descarregar Filamento** | Não suportado (Manual) | Suportado | COSMOS possui as macros oficiais `LOAD_FILAMENT` e `UNLOAD_FILAMENT`. |
| **Canvas / Multi-material (AFC)** | Suportado | Depende de X | No SDCP fala nativo (Cmd 324); no COSMOS depende da extensão/módulo `afc` instalada e configurada no Klipper. Ficará em modo apenas leitura até verificação na máquina física. |
| **Consola G-code** | Não suportado | Suportado | SDCP não tem consola G-code interativa; COSMOS tem execução direta via `/printer/gcode/script`. |
| **Malha da Mesa (Bed Mesh)** | Não suportado | Depende de X | Exclusivo de Klipper; depende de o utilizador ter o componente `bed_mesh` ativo no `printer.cfg`. |
| **Input Shaper** | Não suportado | Depende de X | Configuração estática/macros no Klipper; exibição de curvas depende de ficheiros gerados em `/home/mks/klipper_config`. |
| **Gravação de Timelapse Nativo SDCP** | Suportado | Não suportado | O mecanismo proprietário de timelapse da Elegoo no SDCP não existe no Moonraker (no Klipper usa Moonraker-Timelapse, se instalado). |

---

## 3. Regras de Comportamento

1. **Prioridade de Capacidades sobre Modelos:** O código da aplicação nunca deverá verificar `if (printer.model === 'Centauri')` para habilitar ou desabilitar funcionalidades. Todas as decisões de interface consultam `driver.capabilities[feature]`.
2. **Comportamento em Funcionalidades Não Suportadas:**
   - Ações impossíveis de executar no protocolo ativo ficam desativadas visualmente com indicação acessível (`accessibilityHint`) e motivo claro (ex.: "Indisponível no firmware COSMOS").
   - Controlos exclusivos (como Consola G-code) só surgem se a capacidade estiver explicitamente ativa.
3. **Resiliência e Idempotência:**
   - Quedas de ligação WebSocket disparam reconexão com recuo exponencial progressivo (1s, 2s, 5s, 10s máx).
   - O histórico de trabalhos e a fila de impressão são locais e persistem independentemente da alternância de firmware na mesma máquina física.
4. **Segurança de Execução:** Comandos de movimento, aquecimento e extrusão estão estritamente bloqueados se a máquina estiver no estado lógico `imprimindo` ou `offline`.

---

## 4. Decisões em Aberto

1. **Autenticação no Moonraker do COSMOS:**
   - Na instalação padrão do COSMOS, a rede local é configurada como cliente confiado (`trusted_clients: 192.168.0.0/16, 127.0.0.1, 100.0.0.0/8`). A app suportará opcionalmente uma chave de API (`X-Api-Key` ou token) guardada em Keystore caso o utilizador tenha autenticação restrita ativa.
2. **Suporte AFC (Canvas Multi-Material):**
   - O suporte AFC no COSMOS está em desenvolvimento ativo pela comunidade OpenCentauri. A app lerá os slots como "apenas leitura" mapeando `T0..T3`, sem tentar forçar comandos de troca manual de carretéis que possam corromper o estado da cabeça de impressão.

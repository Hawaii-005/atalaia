# Especificação e Peculiaridades do Protocolo SDCP em Ataláia

## Visão Geral
O Ataláia comunica com as impressoras Elegoo através do protocolo SDCP (Smart Device Control Protocol):
- **Elegoo Centauri Carbon (FDM)**: SDCP por WebSocket na porta `:3030/websocket` e câmara MJPEG na porta `:3031/video`.
- **Elegoo Saturn 3 Ultra (Resina)**: SDCP V1 por TCP na porta `:3000`.

---

## Comandos SDCP Suportados

### Comandos de Controlo e Ficheiros
- **`Cmd 0`**: Pedido / Transmissão de Estado (Heartbeat e métricas de impressão).
- **`Cmd 128`**: Iniciar Impressão (`Filename` exato como devolvido pelo `Cmd 258`; suporte a parâmetro `Tlp_Switch` para time-lapse).
- **`Cmd 129`**: Pausar Impressão.
- **`Cmd 130`**: Cancelar / Parar Impressão.
- **`Cmd 131`**: Retomar Impressão.
- **`Cmd 258`**: Listar Ficheiros e Ficheiros Recentes na impressora.
- **`Cmd 320` / `Cmd 321`**: Obter lista de IDs e detalhe do histórico interno.
- **`Cmd 323`**: Obter URL do ficheiro de vídeo Time-Lapse (Recurso Experimental).
- **`Cmd 403`**: Ajustar velocidadede das ventoinhas (`TargetFanSpeed`) e luz da câmara (`LightStatus.SecondLight`: `1` para ligada, `0` para desligada).

---

## Códigos de Estado do Firmware (1.4.49 FDM)

| Código | Significado | Descrição / Observações |
|---|---|---|
| `0` | Parada / Idle | Impressora em repouso e pronta a receber comandos. |
| `1` / `2` | Aquecimento / Preparação | Aquecimento de bico ou mesa. |
| `3` | Nivelamento | Execução do auto-bed leveling. |
| `4` / `5` / `6` | A imprimir | Execução de camadas ativas de G-code. |
| `8` / `20` | Pausa | **Atenção**: O código `20` é usado pelo firmware tanto para pausa como durante o processo de nivelamento. |
| `10` / `14` | A Parar | Sequência de cancelamento/paragem em curso. |
| `9` / `16` | Concluída | Trabalho finalizado com sucesso. |
| `99` / `255` | Erro | Falha genérica ou interrupção do sensor. |

---

## Peculiaridades Observadas no Firmware Stock 1.4.49
1. **Pausa e Nivelamento com Código 20**: O firmware responde com estado `20` em duas situações totalmente distintas (pausa de utilizador e nivelamento). A app utiliza verificação de variação de ticks em conjunto com temperaturas para distinguir pausa real de nivelamento.
2. **Grams e Consumo**: Quando o ficheiro `.gcode` não traz o cabeçalho `filament used [g]` fatiado, a impressora devolve `EstFilamentLength` a `0`. A app faz o cálculo de estimativa no cliente analisando o consumo de extrusão $E$.
3. **Renomear Ficheiro**: O `Cmd 257` é aceite pelo firmware mas nenhuma alteração é feita no sistema de ficheiros. O Ataláia simula renomeação no cliente descarregando e re-enviando com novo nome.

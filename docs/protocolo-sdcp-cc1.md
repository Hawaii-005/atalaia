# Protocolo SDCP da Elegoo Centauri Carbon (CC1)

Notas recolhidas a partir do firmware em uso (mainboard `3c7c16580103d66400000c0000000000`),
da interface web oficial da impressora e de testes reais. Serve para quem queira falar com a
impressora sem passar pela app da Elegoo.

## Transporte

- WebSocket: `ws://<ip>:3030/websocket`, sem autenticação.
- Câmara MJPEG: `http://<ip>:3031/video`, sem autenticação.
- Ficheiros: `GET http://<ip>:3030/local/<nome>` (caminho local da impressora).
- Upload: `POST http://<ip>:3030/uploadFile/upload` (multipart).
- Histórico (miniaturas): `GET http://<ip>/board-resource/history_image/<taskid>.png`.
- Descoberta: enviar a string `M99999` em UDP para a porta 3000 (broadcast) e ler as respostas.

Envelope de pedido:

```json
{
  "Id": "request",
  "Data": {
    "Cmd": 128,
    "Data": { },
    "RequestID": "identificador unico",
    "MainboardID": "3c7c16580103d66400000c0000000000",
    "TimeStamp": 1690000000,
    "From": 1
  }
}
```

A resposta traz o mesmo `RequestID` em `Data.RequestID`; é por ele que se correlaciona
pedido e resposta — não pelo `Cmd`.

## Comandos

| Cmd | Função | Payload |
| --- | --- | --- |
| 0 | Estado | `{}` |
| 1 | Atributos | `{}` |
| 128 | Começar impressão | ver abaixo |
| 129 | Pausa | `{}` |
| 130 | Parar | `{}` |
| 131 | Retomar | `{}` |
| 132 | Parar alimentação de filamento | `{}` |
| 133 | Saltar pré-aquecimento | `{}` |
| 258 | Listar ficheiros | `{ "Url": "/local/", "Page": 1, "Limit": 100 }` |
| 259 | Apagar | `{ "FileList": ["/local//x.gcode"], "FolderList": [] }` |
| 320 | Histórico (ids) | `{ "Page": 1, "Limit": 100 }` |
| 321 | Detalhe do histórico | `{ "Id": ["<taskid>"] }` |
| 386 | Vídeo | `{ "Enable": 1 }` |
| 387 | Time-lapse | `{ "Enable": 0 \| 1 }` |
| 403 | Luz / velocidade | `{ "LightStatus": { "SecondLight": 1 } }` ou `{ "PrintSpeedPct": 100 }` |

### Cmd 128 — começar impressão

```json
{
  "Filename": "/local//peca.gcode",
  "StartLayer": 0,
  "Calibration_switch": 0,
  "PrintPlatformType": 0,
  "Tlp_Switch": 0,
  "slot_map": []
}
```

- Os seis campos são **obrigatórios**. Enviar apenas `Filename` e `StartLayer` deixa o firmware
  num estado em que o ping responde mas as portas 3030/3031 ficam fechadas e o ecrã congela;
  só se recupera cortando a corrente. Reproduzido três vezes.
- `Filename` é o campo `name` devolvido pelo Cmd 258, **tal e qual**, incluindo o prefixo e a
  barra dupla (`/local//peca.gcode`).
- `Calibration_switch: 1` faz o nivelamento da mesa antes de imprimir (vários minutos).
- `PrintPlatformType` corresponde ao lado da placa: `0` é a primeira opção da interface oficial
  (habitualmente o lado A, texturado) e `1` o lado B. A Elegoo não documenta este campo — o
  mapeamento é inferido da interface, não confirmado pelo fabricante.
- `Tlp_Switch: 1` activa o time-lapse da própria impressora.

Resposta: `Data.Data.Ack`.

| Ack | Significado |
| --- | --- |
| 0 | Aceite |
| 1 | Impressora ocupada |
| 2 | Ficheiro não encontrado |
| 3 | Erro de MD5 |
| 4 | Erro ao abrir o ficheiro |
| 5 | Erro de resolução |
| 6 | Formato inválido |
| 7 | Modelo incompatível |

### Cmd 258 — lista de ficheiros

Cada item traz `name`, `type`, `CreateTime`, `FileSize`, `LayerHeight` e `TotalLayers`.
O tamanho está em **`FileSize`** — não existe `totalSize` nem `usedSize`.

### Upload de G-code

Multipart em blocos de 1 MB com `TotalSize`, `Uuid` (32 hex), `Offset`, `S-File-MD5` e `File`.
Sem o `S-File-MD5` o servidor responde sucesso mas não grava o ficheiro.

## Particularidades do servidor HTTP

- Responde **416** a qualquer pedido com `Range`. Para descarregar um G-code é preciso pedir o
  ficheiro inteiro.
- Não tem autenticação nem limite de pedidos visível, mas satura-se com facilidade: descarregar
  20 ficheiros em paralelo deixa a lista de ficheiros sem resposta. Limitar a dois de cada vez.

## Estado da impressora (Cmd 0)

Campos úteis: `CurrentStatus` (array; 3 = a preparar, 6 = em pausa, 13 = a imprimir),
`PrintInfo.CurrentLayer`, `PrintInfo.TotalLayer`, `PrintInfo.Progress`,
`TempOfNozzle`/`TempTargetNozzle`, `TempOfHotbed`/`TempTargetHotbed`,
`CurrentFanSpeed.{ModelFan, BoxFan, AuxiliaryFan}` (percentagem) e `LightStatus.SecondLight`.

## Aviso

Estes comandos não têm validação no firmware. Um payload incompleto pode deixar a impressora
inoperativa até se cortar a corrente. Testar um comando de cada vez, com a máquina à vista.

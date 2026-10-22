![Atalaia](docs/img/banner.png)

# Atalaia

**A tua impressora, à vista.** Aplicação Android para controlar e vigiar a **Elegoo Centauri Carbon** a partir da rede onde ela está — sem conta, sem nuvem, sem servidor pelo meio.

A impressora fala SDCP por WebSocket (`ws://<ip>:3030/websocket`) e a câmara serve MJPEG em `http://<ip>:3031/video`. A app liga-se directamente a esses dois endereços. Nada sai da tua rede, excepto quando escolhes a ligação remota por Tailscale.

Este projecto começou como fork do [CC-Tool](https://github.com/WalkerFrederick/CC-Tool) e foi muito além do original: mudou de nome, de identidade e de âmbito. Não tem qualquer afiliação, apoio ou recomendação da Elegoo.

---

## Capturas

| Início | Detalhe |
|---|---|
| ![Início](docs/img/inicio.png) | ![Detalhe](docs/img/detalhe.png) |

| Câmara | Definições |
|---|---|
| ![Câmara](docs/img/camara.png) | ![Definições](docs/img/definicoes.png) |

---

## O que faz

**Ligação**
- Descoberta automática por UDP (`M99999` na porta 3000) e entrada manual de IP ou nome de anfitrião.
- Endereço alternativo opcional por impressora — usado quando o principal não responde (ex.: Tailscale, fora de casa).
- Reconexão com espera progressiva, sem duplicar ligações, e limpeza de timers ao sair.
- Todos os pedidos de impressão esperam pelo `Ack`; uma recusa é mostrada em português, não engolida.

**Estado**
- Mapa de estados do firmware: parada, preparação, aquecimento, nivelamento, impressão, pausa, a parar, terminada.
- Pausa detectada por ticks parados, não só pelo código de estado (o firmware usa `20` para pausa *e* para nivelamento).
- Faixa de “último estado conhecido às HH:MM” quando a ligação cai — em vez de números que parecem vivos.
- Temperaturas do bico, mesa e câmara; camada actual; progresso; tempo restante.

**Impressão**
- Enviar G-code do telemóvel por HTTP em blocos de 1 MB, com tempo limite e limpeza de ficheiros temporários.
- Listar, pré-visualizar e imprimir ficheiros da máquina; ecrã de detalhe com miniatura, cores, camadas e custo.
- Fila de trabalhos com arranque automático **opcional** (desligado por omissão).
- Pausar, retomar, parar; luz da câmara; ventoinhas por percentagem; presets PLA / ABS / silencioso.
- Reimprimir a partir do histórico, verificando primeiro se o ficheiro ainda está na máquina.

**Vigia**
- Avisos com botões: **Pausar**, **Parar** e **Ver câmara**, mesmo com a app em segundo plano.
- Serviço em primeiro plano durante a impressão, para o Android não matar a app a meio.
- Marcos de progresso, conclusão, pausa e impressora offline (este último só a meio de um trabalho).

**Câmara**
- Vídeo ao vivo dentro de um anel de progresso, com ecrã inteiro e captura de fotografia.
- Modo de poupança de dados: fotografia a cada 2 s em vez de ~1 MB/s de MJPEG.

**Organização**
- Quatro temas (Grafite, Papel, Vidro, Nord) só com tokens: cor, tipografia, raio e densidade.
- Interface em português e inglês, com queda para português quando falta uma chave.
- Histórico local com resultado, duração, gramas e custo; estatísticas agregadas.
- Preço por quilo configurável; custo por peça calculado a partir das gramas.
- Cópia de segurança: exportar e restaurar impressoras e definições em JSON.

---

## O que mudou em relação ao CC-Tool

O fork não é uma camada de pintura sobre o original: herdou o protocolo e a estrutura, e depois foi reescrito por dentro, versão a versão (1.13 → 2.0.0).

- **Identidade própria**: nome, ícone (torre de vigia com farol), splash, textos e ecrãs de boas-vindas. O antigo nome e marca desapareceram da interface.
- **Package Android novo** (`io.github.brunocrazy15.atalaia`), para não colidir com o original nem herdar a assinatura dele.
- **Câmara reconstruída**: anel de progresso em SVG com o vídeo lá dentro, recorte circular, ecrã inteiro e captura 16:9.
- **Notificações accionáveis** por categoria, com botões que não abrem a app.
- **Fila de impressão** persistida, com arranque automático opcional e aviso em caso de falha.
- **Erros do protocolo traduzidos**: cada `Ack` tem uma explicação e uma sugestão.
- **Rede mais barata**: descoberta por um único datagrama, single-flight, e cura de IP limitada (app à frente, nunca a imprimir).
- **Consumo estimado**: quando o fatiador não declara `filament used [g]`, o E do G-code é somado e convertido em gramas pela densidade do material.
- **Temas como tokens**, não como ecrãs paralelos.
- **Testes** das funções puras que já causaram bugs (estados, pausa, Ack, consumo).
- **Serviço em primeiro plano** e ponte nativa em Kotlin.
- **Cópia de segurança** e **modo remoto**.
- **Logs só em desenvolvimento** e sem `console.log` em release.

---

## Protocolo (resumo)

| Comando | Para quê |
|---|---|
| `128` | Imprimir um ficheiro (`Filename` exactamente como o `258` devolve) |
| `129` / `131` / `130` | Pausar / retomar / parar |
| `258` | Listar ficheiros |
| `257` | Renomear (o firmware aceita e não faz nada — a app resolve no cliente) |
| `320` / `321` | Histórico: lista de ids e detalhe |
| `403` | Ventoinhas (`TargetFanSpeed`) e luz (`LightStatus.SecondLight`) |

Códigos de estado observados no firmware 1.4.49: `0` parada · `1/16/20` preparação, aquecimento, nivelamento (**20 também em pausa**) · `13` arranque de camada · `5` transição · `6` a imprimir · `7` a parar · `8` parada · `9` terminada.

---

## Compilar

Precisas de Node, JDK 21 e o Android SDK (build-tools 35).

```bash
npm install
cd android && ./gradlew assembleRelease
```

A assinatura lê `android/keystore.properties` (fora do repositório):

```
storeFile=/caminho/para/atalaia.keystore
storePassword=...
keyAlias=atalaia
keyPassword=...
```

Sem esse ficheiro a build usa a chave de debug do Android.

Testes:

```bash
npm test
```

---

## Limitações conhecidas

- **Só Android.** O projecto iOS existe no papel, mas nunca foi testado nem assinado.
- **A impressora não autentica.** Quem estiver na mesma rede pode falar com ela; a app não inventa segurança que o protocolo não tem. Não exponhas a porta 3030 à internet — usa Tailscale ou uma VPN.
- **Gramas são estimativa** quando não vêm do fatiador; o firmware devolve `EstFilamentLength` a zero e o histórico não traz consumo.
- **O espaço livre da impressora não existe no `Cmd 258`** — a app não o mostra porque não o pode saber.
- **Controlo de temperatura** não está implementado (o firmware stock não expõe comando utilizável).
- **Pausa/retomar** depende do estado interno da máquina; quando fica inconsistente, o corte de corrente na tomada é o que o limpa.
- **Renomear** é feito no cliente (descarregar, enviar, apagar), não pelo protocolo.

---

## Privacidade

A app não tem contas, telemetria nem analítica. Guarda localmente as impressoras, o histórico, o preço por quilo e as preferências. A única comunicação é com a impressora, no endereço que configuras.

---

## Licença e créditos

MIT — ver [LICENSE](LICENSE).

- Original: **CC-Tool**, de Frederick Walker, também MIT. Sem ele, este fork não existia.
- Protocolo SDCP documentado pela comunidade Elegoo.
- Atalaia é um projecto independente, sem afiliação com a Elegoo.

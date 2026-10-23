# Auditoria de UI/UX: Atalaia com dois tipos de impressora

## 1. Inventário Atual

| Tipo de Máquina | Ecrãs de Interação | O que suporta e exibe |
| :--- | :--- | :--- |
| **Elegoo Centauri (FDM)** | `HomeScreen` (Cartão Hero + PrinterCard)<br>`MonitorScreen` → `CameraScreen`<br>`PrinterDetailsScreen` | Câmara (vídeo em direto/poupança), luz, temperaturas (bico, mesa, câmara), ventoinhas (modelo, câmara, lateral), perfis de velocidade, tempo restante, estado, lista de ficheiros, enviar G-code, controlos (pausar/retomar/parar). |
| **Elegoo Saturn (Resina)** | `HomeScreen` (Cartão Hero + PrinterCard)<br>`MonitorScreen` → `WorkScreen`<br>`ResinScreen` | Trabalho em curso (camada X/Y, tempo restante, miniatura extraída do ficheiro), estado da máquina, erro, enviar `.ctb`/`.goo`, controlos (pausar/retomar/parar). Sem vídeo, luz ou temperaturas. |

## 2. Problemas Concretos de UI/UX

1. **Caminhos redundantes e divisão cognitiva para FDM:** Para controlar a Centauri, o utilizador tem duas opções quase completas, mas mutuamente exclusivas: `PrinterDetailsScreen` (acedido pela Home) e `CameraScreen` (acedido pela aba Monitor). O detalhe tem o controlo de ventoinhas, mas o Monitor tem o envio de ficheiros e a luz. O utilizador hesita onde ir.
   * *Prova:* `HomeScreen.tsx` (linha 57) navega para `PrinterDetails`, enquanto o botão de câmara do cartão FDM (linha 327) navega para `Monitor`.
2. **Dupla selecção frustrante no Monitor:** A arquitetura no `MonitorScreen` obriga a escolher a "natureza" da visualização ("Câmara" vs "Trabalho") e, se escolher "Câmara", obriga a uma segunda escolha para definir qual a máquina FDM a observar. É um excesso de toques para chegar à ação.
   * *Prova:* `MonitorScreen.tsx` (linha 58) desenha os *chips* `['camara', 'trabalho']`, e o `CameraScreen.tsx` (linha 484) desenha os *chips* das próprias impressoras.
3. **Fluxo de monitorização da Resina quebrado:** A promessa da aba Monitor é permitir agir em segundos. No entanto, o lado da resina (`WorkScreen`) apenas lista *cards* inativos. Para pausar a máquina, o utilizador tem de clicar no *card*, abrindo um ecrã Modal de fundo (`ResinScreen`).
   * *Prova:* `WorkScreen.tsx` (linha 38) executa uma navegação completa de pilha (`navigation.navigate('Resina')`) em vez de mostrar os controlos diretamente.
4. **O Cartão de Destaque (Hero) na Home é passivo:** O bloco que surge no topo da `HomeScreen` quando há impressão a decorrer destaca o progresso formidavelmente, mas carece dos comandos básicos. Para agir numa emergência, o utilizador tem de fazer *scroll* até ao cartão da impressora.
   * *Prova:* `HomeScreen.tsx` (linhas 215-270) tem *textos* e *progress bar*, mas nenhum botão de `pausar/parar`.

## 3. Opções de Arquitectura de Informação

### Opção A: Monitor focado em Máquina (O plano original)
A aba "Monitor" atua como *Dashboard* dinâmico. O nível de abas no ecrã (`MonitorScreen`) mostra apenas os nomes das impressoras ativas. Ao tocar no chip "Saturn", o ecrã desenha os controlos de resina. Ao tocar na "Centauri", desenha os controlos FDM + vídeo.
* **Custo de Implementação:** Médio. Exige fundir lógicas do `PrinterDetailsScreen` no `CameraScreen` e converter o `ResinScreen` de ecrã para um Componente embutível.
* **Risco:** Moderado (gestão do ciclo de vida das WebViews do FDM na troca de *chips*).
* **Ganhos:** Elimina redundâncias. Um único local para "ver o que se passa".
* **Perdas:** Perde-se a segregação estrita visual que a Home tinha.

### Opção B: Extinção da aba Monitor
Acabar com a aba central. A `HomeScreen` passa a ser a única vista agregada. Tocar num cartão da Home abre sempre o detalhe isolado de cada máquina (que conteria o vídeo ou as miniaturas da resina).
* **Custo de Implementação:** Baixo (basta redirecionar rotas e remover `MonitorScreen`).
* **Risco:** Baixo.
* **Ganhos:** Simplifica a navegação (só 2 abas) e extingue o dilema de qual caminho tomar.
* **Perdas:** O utilizador tem sempre de entrar e sair de ecrãs de *stack* para conferir diferentes máquinas em simultâneo. Interrompe a visão contínua.

### Opção C: Reforçar o modelo "Por Funcionalidade" (Atual)
Manter os *chips* "Câmara" / "Trabalho", mas embeber as ações no `WorkScreen` e centralizar todas as ações FDM dentro da "Câmara".
* **Custo de Implementação:** Baixo.
* **Risco:** Baixo.
* **Ganhos:** Rápido de executar, mantendo a semântica atual intacta.
* **Perdas:** Nomes pouco intuitivos (monitorizar a Resina também é "Monitor", não apenas "Trabalho") e a barreira semântica de mapear FDM à palavra Câmara.

## 4. Recomendação

**Opção recomendada: Opção A (Monitor focado em Máquina)**
*Porquê?* A Opção A honra a decisão estrutural previamente registada no documento `docs/ui-adaptativa.md` e corrige o desvio atual em `MonitorScreen.tsx` que gerou as categorias artificiais de "Câmara/Trabalho". A Opção B tornaria a verificação rápida mais lenta (múltiplos toques *in-and-out*). A Opção C mantém uma categorização abstrata para o utilizador. Com a Opção A, o utilizador só pensa "Quero ver a Saturn" e clica no respetivo botão de topo.

## 5. Plano de Mudanças Priorizado

* **P0: Eliminar dualidade no Monitor.**
  * *O que tocar:* `src/screens/MonitorScreen.tsx`.
  * *Critério:* Remover a tipologia `Aba = 'camara' | 'trabalho'`. O estado passará a guardar a `printerId` selecionada. Renderiza o ecrã com base no `kind` (Resina vs FDM) diretamente no Monitor.
* **P0: Unificar a interface de controlo FDM.**
  * *O que tocar:* Fundir `PrinterDetailsScreen.tsx` com `CameraScreen.tsx`.
  * *Critério:* O componente resultante (ex: `FdmPanel.tsx`) tem de suportar vídeo, perfis de velocidade, controlos de impressão (Pausar/Parar), e painéis de ventoinha/luz num único fluxo vertical. O `PrinterDetailsScreen` é depois apagado.
* **P1: Embeber os controlos da Resina.**
  * *O que tocar:* `ResinScreen.tsx` e `WorkScreen.tsx`.
  * *Critério:* Converter o atual `ResinScreen` num componente funcional (ex: `ResinPanel.tsx`) consumível diretamente no `MonitorScreen`, extinguindo o salto desnecessário de pilha (`WorkScreen`).
* **P2: Acionabilidade no Hero da Home.**
  * *O que tocar:* `HomeScreen.tsx` (bloco `emTrabalho`).
  * *Critério:* Inserir um pequeno botão secundário ao lado dos tempos de término ("Pausar") e da barra de progresso do elemento de destaque, poupando um *scroll* ao utilizador.

## 6. O Que NÃO Mudar

* **A estrutura de abas fixa:** De acordo com o que já foi decidido em `docs/ui-adaptativa.md`, a barra de abas principal (Impressoras, Monitor, Definições) não deve sofrer mutações consoante o estado do Wi-Fi ou a adição de impressoras, de modo a garantir memória espacial intocável.
* **As limitações honestas dos dados da Resina:** Não se deve inventar dados de histórico de ficheiros locais, histórico de ações ou simular temperaturas na Elegoo Saturn. A sua interface embutida deve mostrar exatamente o que ela publica (estado, camadas, `.ctb`), preservando o alerta `resina.limites`.
* **Múltiplos fluxos de vídeo na Home:** Evitar absolutamente embeber WebViews de vídeo diretamente nos cartões da `HomeScreen`. O protocolo da Centauri suporta no máximo 1 *stream*, o que falharia no caso de múltiplas impressoras (risco já mapeado anteriormente).

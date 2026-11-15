# Guia de Teste Físico: Primeira Impressão com o Perfil Cosmos AFC

* **Equipamento:** Elegoo Centauri Carbon (CC1) com Klipper / Moonraker (firmware COSMOS) e módulo multi-material Canvas AFC.
* **Objetivo:** Validação segura em hardware real do G-code gerado pelo perfil local antes de qualquer uso em produção.

---

## 1. Regras Críticas de Segurança Física

> ⚠️ **ATENÇÃO:** Nunca inicie este teste de forma remota ou desatendida. Permaneça fisicamente junto da impressora durante todo o procedimento.

1. **Mesa Totalmente Desobstruída:** Verifique visual e manualmente que a placa flexível PEI está limpa, corretamente encaixada nos batentes magnéticos e sem qualquer resíduo, espátula ou peça anterior.
2. **Posição de Segurança (Corte de Emergência Físico):** Mantenha a mão próxima do interruptor de energia físico da Centauri Carbon. Se detetar ruído anómalo, esforço nos motores, desvio de eixo ou cabeçote a forçar contra a mesa, **desligue imediatamente a alimentação no botão físico da máquina**.
3. **Vigilância Obrigatória da Primeira Camada:** Os primeiros minutos (aquecimento, homing, purga e primeira camada) são críticos para confirmar o comportamento do cabeçote e prevenir danos mecânicos na superfície PEI.

---

## 2. Preparação da Impressora

* **Material Carregado:** Filamento PLA padrão verificado na ranhura ativa correspondente (exemplo: ranhura `T0` / Preto).
* **Módulo Canvas AFC:** Certifique-se de que o filamento está engatado e que o sensor da pista `T0` reporta estado pronto.
* **Temperaturas Nominais do Perfil:**
  - Bico (Nozzle): 215 °C primeira camada (conforme definido no perfil `Elegoo Centauri Carbon 0.4 nozzle - Cosmos AFC.json`).
  - Mesa (Bed): 60 °C primeira camada.

---

## 3. Sequência de Execução Passo a Passo

### Passo 1: Envio do Ficheiro de Calibração (Via Interface Web / curl)
*Como o fluxo integrado de envio do Atalaia ainda não existe (será implementado na Fase 4), o ficheiro G-code gerado deve ser enviado diretamente ao Moonraker através da interface web do COSMOS/Fluidd/Mainsail ou via linha de comandos:*
```bash
# Exemplo de upload via curl diretamente para o Moonraker da impressora (substituir IP_DA_CC1):
curl -F "file=@cubo_teste_cosmos_afc.gcode" "http://IP_DA_CC1/server/files/upload"
```
* **Arranque:** Inicie a impressão manualmente através da interface web da impressora ou do ecrã físico da máquina após confirmar que a mesa está limpa e desobstruída.

### Passo 2: Observação e Registo da Sequência Real do `PRINT_START`
Em vez de assumir a ordem dos comandos, observe atentamente e anote a sequência real executada pela macro `PRINT_START` do firmware COSMOS da máquina:
1. **Ordem de Aquecimento:** Registar qual dos componentes aquece primeiro (mesa vs. bico) e se o bico aguarda pelo homing para subir para a temperatura final de extrusão.
2. **Movimentos de Homing e Calibração:** Registar como o cabeçote efetua o homing (`G28`), se faz nivelamento de malha (`BED_MESH_CALIBRATE`) e se há contacto seguro do sensor com a mesa sem raspar.
3. **Comportamento do Canvas AFC:** Registar se a chamada `TOOL=0` alimenta o filamento da ranhura T0 suavemente até ao sensor do cabeçote.
4. **Temperaturas no Ecrã Físico:** Comparar as temperaturas indicadas no ecrã real da impressora com as temperaturas configuradas no perfil JSON.

### Passo 3: Inspeção da Linha de Purga e Primeira Camada
* **Linha de Purga:** Observar onde e como a linha de purga é traçada (margem da mesa, espessura e aderência).
* **Perímetro da Peça:** Ao iniciar a primeira camada do cubo de 20 mm, observar a altura e aderência:
  - *Aderência correta:* Linha contínua, ligeiramente achatada contra o PEI.
  - *Problema de adesão:* Filamento solto ou a enrolar no bico (interromper a impressão pelo painel da máquina).
  - *Aproximação excessiva:* Bico a marcar o PEI (desligar imediatamente o interruptor físico).

### Passo 4: Conclusão e Registo de Métricas Reais
* Se a primeira camada assentar corretamente, deixe a impressão concluir até aos 10 mm de altura.
* No final, observe o comportamento da macro `PRINT_END` (arrefecimento, parqueamento do cabeçote e retração de filamento).
* **Registo de Métricas:** Compare o tempo total e consumo de filamento indicados no ecrã real da Centauri Carbon com a estimativa do fatiador.

---

## 4. Grelha de Registo para Validação da Fase 1

Preencha os seguintes pontos durante e após o teste físico:
* [ ] Sequência real do `PRINT_START` observada no ecrã/consola da máquina: ___________________________
* [ ] Houve algum erro de comando Klipper ou parâmetro desconhecido na consola? [ ] Sim  [ ] Não
* [ ] A alimentação da ranhura T0 pelo Canvas correu sem bloqueios? [ ] Sim  [ ] Não
* [ ] Temperaturas reais observadas no visor da máquina: Mesa: ___ °C / Bico: ___ °C
* [ ] Tempo real decorrido no ecrã da CC1: ___ min (vs. estimado: ___ min)
* [ ] Dimensões reais do cubo com paquímetro: X: ___ mm / Y: ___ mm / Z: ___ mm (nominal: 20×20×10 mm)

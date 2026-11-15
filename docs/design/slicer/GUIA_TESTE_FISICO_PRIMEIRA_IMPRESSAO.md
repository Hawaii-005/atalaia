# Guia de Teste Físico: Primeira Impressão com o Perfil Cosmos AFC

* **Equipamento:** Elegoo Centauri Carbon (CC1) com Klipper / Moonraker (firmware COSMOS) e módulo multi-material Canvas AFC.
* **Objetivo:** Validação segura em hardware real do G-code gerado pelo perfil local antes de qualquer uso em produção.

---

## 1. Regras Críticas de Segurança Física

> ⚠️ **ATENÇÃO:** Nunca inicie este teste de forma remota ou desatendida. Permaneça fisicamente junto da impressora durante todo o procedimento.

1. **Mesa Totalmente Desobstruída:** Verifique visual e manualmente que a placa flexível PEI está limpa, corretamente encaixada nos batentes magnéticos e sem qualquer resíduo, espátula ou peça anterior.
2. **Posição de Segurança (Corte de Emergência):** Mantenha uma mão próxima do interruptor de energia físico da Centauri Carbon ou com o ecrã do Atalaia aberto no botão de paragem de emergência (`M112`). Se detetar ruído de esforço nos motores, desvio de eixo ou cabeçote a forçar contra a mesa, **desligue imediatamente a alimentação**.
3. **Vigilância Obrigatória da Primeira Camada:** Os primeiros 3 a 5 minutos (aquecimento, homing, purga e primeira camada) são críticos para confirmar o Z-offset e prevenir danos na superfície da mesa.

---

## 2. Preparação da Impressora

* **Material Carregado:** Filamento PLA padrão verificado na ranhura ativa correspondente (exemplo: ranhura `T0` / Preto).
* **Módulo Canvas AFC:** Certifique-se de que o filamento está engatado e que o sensor de alimentação da pista `T0` reporta estado livre e pronto.
* **Conectividade:** Confirme que a aplicação Atalaia estabeleceu ligação WebSocket com o Moonraker (indicador verde, latência < 1s).

---

## 3. Sequência de Execução Passo a Passo

### Passo 1: Envio do Ficheiro de Calibração
* Utilize o ficheiro de teste gerado pelo spike: modelo de calibração reduzido (cubo de 20 × 20 × 10 mm fatiado com o perfil `Elegoo Centauri Carbon 0.4 nozzle - Cosmos AFC.json`).
* No Atalaia, confirme o ecrã de revisão com as métricas reais (~12 a 15 minutos de impressão, ~4 g de filamento).
* Confirme o modal de arranque com mesa limpa.

### Passo 2: Verificação da Rotina `PRINT_START`
Observe a sequência exata de comandos executados pela máquina:
1. **Aquecimento da Mesa:** A mesa deve aquecer primeiro até aos 60 °C definidos no perfil.
2. **Homing dos Eixos (G28):** O cabeçote deve deslocar-se suavemente para o centro/fins de curso sem bater nas extremidades.
3. **Aquecimento do Nozzle:** O bico só deve subir para a temperatura de extrusão (210–215 °C) após o homing, evitando que filamento derretido pingue sobre a mesa durante a calibração.
4. **Chamada de Ferramenta (`TOOL=0`):** O módulo Canvas AFC deve posicionar a ranhura T0 sem encravar o tubo Bowden.

### Passo 3: Inspeção da Linha de Purga e Primeira Camada
* **Linha de Purga:** Verifique se a linha inicial é traçada na margem esquerda da mesa, com espessura uniforme e sem bolhas.
* **Perímetro da Peça:** Ao iniciar a primeira camada do cubo de 20 mm, observe a altura de extrusão:
  - *Correto:* Filamento ligeiramente achatado contra o PEI, com boa aderência e sem transparência excessiva.
  - *Muito Alto:* O fio solta-se da mesa (pare a impressão e ajuste o Z-offset no Atalaia).
  - *Muito Baixo:* O bico raspa no PEI (pare imediatamente a impressão).

### Passo 4: Conclusão e Registo de Resultados
* Se a primeira camada assentar perfeitamente, deixe a impressão concluir até aos 10 mm de altura.
* No final, a macro `PRINT_END` deve afastar o bico, desligar os aquecedores e retrair o filamento com segurança.

---

## 4. O Que Registar para Validação Final

Após o teste, anote os seguintes pontos para relatório da Fase 1:
* [ ] O Klipper aceitou todos os parâmetros da macro `PRINT_START` sem emitir erro no log da consola?
* [ ] A ranhura T0 do Canvas foi alimentada corretamente na primeira tentativa?
* [ ] As temperaturas reais atingiram os valores nominais definidos no perfil JSON?
* [ ] O Z-offset comportou-se de forma idêntica à impressão enviada via OrcaSlicer desktop?
* [ ] Dimensões finais do cubo medido com paquímetro (tolerância aceitável: ±0.15 mm).

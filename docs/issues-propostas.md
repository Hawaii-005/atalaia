# Tarefas Propostas (Issues para a Equipa)

## Issue 1: Gráficos de Temperatura em Tempo Real (FDM)
- **Descrição**: Adicionar um gráfico de linha interativo no ecrã de detalhes da Centauri Carbon mostrando a evolução da temperatura do bico (nozzle) e da mesa (hotbed) ao longo do tempo durante a impressão.
- **Ficheiros afetados**: `src/screens/PrinterDetailsScreen.tsx`, novo componente em `src/components/GraficoTemperatura.tsx`.
- **Critérios de Aceitação**: Sem dependências nativas pesadas (usar react-native-svg ou equivalente leve), atualização a cada tick de estado, histórico mantido em memória durante a sessão.

## Issue 2: Ecrã Nativo de Calibração Z-Offset e Levelling
- **Descrição**: Desenvolver uma interface passo-a-passo para controlo dos comandos SDCP de nivelamento manual/automático e ajuste fino de Z-Offset.
- **Ficheiros afetados**: `src/screens/CalibracaoScreen.tsx`, `src/utils/commands.ts`.
- **Critérios de Aceitação**: Apresentar avisos de segurança ao utilizador antes de mover os eixos; utilizar a máquina de estados unificada para validar se a impressora está em repouso.

## Issue 3: Expansão da Suíte de Testes E2E com Maestro
- **Descrição**: Escrever cenários E2E adicionais em `.maestro/` cobrindo o envio de ficheiro para a fila, confirmação de "mesa limpa" e alteração de definições de tema/intervalo.
- **Ficheiros afetados**: `.maestro/queue-flow.yaml`, `.maestro/settings-flow.yaml`.
- **Critérios de Aceitação**: Execução com sucesso no servidor SDCP falso em ambiente de CI local.

## Issue 4: Suporte Multi-língua Expandido (Espanhol e Francês)
- **Descrição**: Adicionar ficheiros de tradução `src/i18n/es.ts` e `src/i18n/fr.ts` e seletor de idioma nas Definições.
- **Ficheiros afetados**: `src/i18n/`, `src/screens/SettingsScreen.tsx`.
- **Critérios de Aceitação**: 100% das chaves traduzidas em paridade com `pt.ts` e `en.ts`.

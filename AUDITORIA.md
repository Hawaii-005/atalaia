# Auditoria da interface v6 do Ataláia — o que não faz sentido

## Problemas encontrados

### Alta gravidade (não funciona / engana)

1. **Onde**: `src/screens/CameraScreen.tsx:421`  
   **O que é**: Botão «FICHEIROS» que navega para `navigation?.navigate('Printers')`  
   **Porque não faz sentido**: A rota `Printers` não existe no `AppNavigator.tsx`. A navegação v6 não tem stack `Printers` — os ficheiros vivem dentro da aba `Impressora` como secção. O botão não faz nada quando clicado.  
   **Gravidade**: Alta (engana o utilizador, botão morto)  
   **Correcção concreta**: Apagar o bloco completo do botão «FICHEIROS» (linhas 705–726) ou substituir por `useAbrirMaquina` para navegar à secção ficheiros.

2. **Onde**: `src/screens/FilesScreen.tsx:504` e `556`  
   **O que é**: Dois `navigation.navigate('Printers')` em fluxos de erro («sem impressoras», «impressora desligada»)  
   **Porque não faz sentido**: Rota `Printers` não existe. Na v6 há três abas: `Inicio`, `Impressora`, `Settings`. Quando o ficheiro aparece embutido na aba Impressora, já estás dentro; quando é modal (empilhado), voltar para a aba não se chama `Printers`.  
   **Gravidade**: Alta (não funciona, crashou ou não navega)  
   **Correcção concreta**: Mudar para `navigation.navigate('Impressora')` ou `navigation.goBack()` se for modal.

3. **Onde**: `src/screens/HistoryScreen.tsx:168`  
   **O que é**: `navigation.navigate('Printers')` no estado vazio (sem impressoras)  
   **Porque não faz sentido**: Mesma rota inexistente. Devia apontar para `Impressora` ou abrir `AddEditPrinter`.  
   **Gravidade**: Alta (não funciona)  
   **Correcção concreta**: Mudar para `navigation.navigate('Impressora')` ou `navigation.navigate('AddEditPrinter')`.

4. **Onde**: `src/screens/InicioScreen.tsx:140`  
   **O que é**: Cast `(paleta as any)[estado.cor]` para aceder a cores de estado  
   **Porque não faz sentido**: O objecto `paleta` (de `temas.ts`) não tem chaves `'ok'`, `'aviso'`, `'perigo'` — só tem `ok`, `aviso`, `perigo` como propriedades TypeScript. O cast esconde que `estado.cor` é uma string (`'ok'`, `'perigo'`) e não uma propriedade directa. Funciona mas é confuso e frágil.  
   **Gravidade**: Alta (lógica obscurecida, pode falhar em mudanças futuras)  
   **Correcção concreta**: Criar mapa `const cores = { ok: paleta.ok, aviso: paleta.aviso, perigo: paleta.perigo }; const corEstado = hexDe(cores[estado.cor] ?? paleta.tintaSoft)`.

### Média gravidade (duplicação ou ruído)

5. **Onde**: `src/screens/PrinterTabScreen.tsx:177`  
   **O que é**: `marginTop: espaco.md` no contentor do corpo (ficheiros/filamentos/controlos/estado)  
   **Porque não faz sentido**: O Bruno reportou uma faixa vazia grande entre as pílulas e o segmentado. Esta margem adicional é fixa (12 dp) independentemente de haver ou não segmentado visível. Quando só há uma secção (resina, só Estado), o segmentado desaparece mas a margem fica, criando espaço vazio desnecessário.  
   **Gravidade**: Média (ruído visual na resina, funciona mas não faz sentido)  
   **Correcção concreta**: Mudar para `marginTop: secoes.length > 1 ? espaco.md : 0` ou apagar a margem (cada secção já tem o seu padding).

6. **Onde**: `src/sections/EstadoSection.tsx:148–150`  
   **O que é**: Array de temperaturas com três entradas (bico, mesa, câmara), todas sempre presentes  
   **Porque não faz sentido**: A Centauri Carbon não reporta `TempOfBox` (temperatura da câmara fechada). O terceiro cartão mostra sempre 0°/0°, ocupando espaço sem informação útil. Regra: «o que não existe não se mostra».  
   **Gravidade**: Média (cartão inútil, confunde)  
   **Correcção concreta**: Filtrar o array: `.filter(item => item.alvo > 0 || item.valor > 5)` para só mostrar temperaturas activas.

7. **Onde**: `src/sections/EstadoSection.tsx:268–284`  
   **O que é**: Botão «Câmara» que aparece no final da secção Estado, mesmo quando já há miniatura de vídeo no topo  
   **Porque não faz sentido**: Duplicação: tens a miniatura (16:9, tocável, linha 163–186) e o botão (linha 268–284). Os dois fazem o mesmo (`onAbrirCamara`). Numa impressora FDM ligada, estás a tocar na miniatura ou no botão para abrir o mesmo ecrã.  
   **Gravidade**: Média (duplicação, confusão)  
   **Correcção concreta**: Apagar o botão (linhas 268–284); a miniatura já é tocável e mais óbvia.

8. **Onde**: `src/sections/ControlosSection.tsx:145–150`  
   **O que é**: Botão «Ligar câmara» (comando 386, videoCommand) dentro da secção Controlos  
   **Porque não faz sentido**: O vídeo já é ligado automaticamente ao entrar na secção Estado (linha 114–123 de `EstadoSection.tsx`) e ao abrir o `CameraScreen` (linha 163–183). Um botão manual para religar é redundante e confunde («já está ligada, porque é que isto existe?»). Além disso, não há feedback visual de sucesso.  
   **Gravidade**: Média (duplicação, ruído)  
   **Correcção concreta**: Apagar a linha completa (145–150). Se precisar de «reiniciar stream», já existe o botão de refresh no `CameraScreen`.

9. **Onde**: `src/screens/InicioScreen.tsx:211–241`  
   **O que é**: Cartões de atalho «Câmara» e «Ficheiros» que só aparecem quando há uma FDM ligada  
   **Porque não faz sentido**: Na v6 a aba Impressora é a casa permanente destas funções (secções câmara e ficheiros). Os atalhos são úteis, mas duplicam a navegação: tens de lembrar que «Ficheiros» no Início abre a aba Impressora na secção ficheiros, mas «Ficheiros» dentro da aba Impressora muda de secção. Coerência quebrada.  
   **Gravidade**: Média (duplicação aceitável mas confusa)  
   **Correcção concreta**: Manter os atalhos mas adicionar comentário explícito no código: «// Atalhos de conveniência; a função principal vive na aba Impressora».

10. **Onde**: `src/screens/InicioScreen.tsx:76`  
    **O que é**: `useSelectedPrinter` para obter `mudarMaquina` e `mudarSecao`, mas nunca lê `maquina` ou `secao`  
    **Porque não faz sentido**: O Início não precisa de saber qual é a máquina seleccionada — lista todas. Só precisa das funções `mudarMaquina`/`mudarSecao` para os atalhos. Importar o hook completo é desnecessário.  
    **Gravidade**: Média (dependência desnecessária, não quebra nada)  
    **Correcção concreta**: Manter como está (a dependência é leve) ou criar hook `useNavegacaoMaquina` que só exporta as funções.

### Baixa gravidade (limpeza)

11. **Onde**: `src/screens/CameraScreen.tsx:88`  
    **O que é**: Prop `dentroDoMonitor` recebida mas nunca usada no contexto actual  
    **Porque não faz sentido**: A v6 não tem aba Monitor (eram 5 abas: Início, Ficheiros, Monitor, Filamentos, Definições). Agora são 3 (Início, Impressora, Definições) e a câmara é sempre modal. A prop `dentroDoMonitor` é testada nas linhas 432 e 438, mas nunca passa `true`.  
    **Gravidade**: Baixa (código morto, não atrapalha)  
    **Correcção concreta**: Apagar a prop `dentroDoMonitor` e os blocos condicionais que a usam (linhas 432 e 438).

12. **Onde**: `src/screens/CameraScreen.tsx:407`  
    **O que é**: `useGcodePreview` é chamado mas `preview` nunca é usado no render  
    **Porque não faz sentido**: O hook carrega a pré-visualização do G-code (miniatura da peça), mas a variável `preview` não aparece no JSX. Ou foi esquecida ou estava planeada e nunca foi implementada.  
    **Gravidade**: Baixa (pedido HTTP desperdiçado, não visível)  
    **Correcção concreta**: Apagar a linha 407 (e importação linha 22) ou implementar a miniatura no cartão de trabalho activo.

13. **Onde**: `src/screens/CameraScreen.tsx:119`  
    **O que é**: Estado `capturing` que controla ajuste temporário do CSS do stream (objectFit cover→contain) durante captura  
    **Porque não faz sentido**: A estratégia é frágil: injeta JS no WebView, espera 500 ms, captura, injeta de volta. Se o WebView não responder (lento, offline), a captura sai com CSS errado ou a imagem fica contida para sempre.  
    **Gravidade**: Baixa (funciona 95% das vezes, mas pode ficar preso)  
    **Correcção concreta**: Adicionar `finally` que garante restaurar o CSS mesmo se `captureRef` falhar: já existe no bloco (linha 285–289), está correcto.

14. **Onde**: `src/screens/InicioScreen.tsx:119–132`  
    **O que é**: Dois botões no topo direito: «+» (adicionar) e «⚙» (definições)  
    **Porque não faz sentido**: O botão Definições duplica a aba de Definições (barra inferior). Em telemóvel podes tocar na aba; o botão é redundante. Em tablet (rail lateral) faz sentido, mas em telemóvel é ruído.  
    **Gravidade**: Baixa (atalho benigno, não é erro)  
    **Correcção concreta**: Esconder o botão Definições em `compacta` (telemóvel): `{!compacta && <TouchableOpacity onPress={() => navigation.navigate('Settings')} ...>}`.

15. **Onde**: `src/screens/EditarIpScreen.tsx:24`  
    **O que é**: Validação de IP com regex `^\d{1,3}(\.\d{1,3}){3}$` e verificação de octetos ≤255  
    **Porque não faz sentido**: A validação permite `999.999.999.999` passar a regex e só falha na verificação de octetos. Além disso, não valida domínios (ex.: `centauri.tail12345.ts.net` em Tailscale), que são IPs legítimos para a app.  
    **Gravidade**: Baixa (UX restritiva, mas funciona para IPs numéricos)  
    **Correcção concreta**: Alargar validação: aceitar domínios (qualquer string com ponto e letras) ou melhorar mensagem de erro: «IP numérico (ex.: 192.168.1.4) ou domínio».

16. **Onde**: `src/theme/tokensV6.ts:16` e `23`  
    **O que é**: Campos `cartaoAlt` e `textoSecundario` na interface `Paleta` de tokensV6  
    **Porque não faz sentido**: A ponte `temas.ts` traduz `cartaoAlt` para `fundoBaixo` e `textoSecundario` para `tintaSoft`. Os nomes antigos persistem em `tokensV6.ts`, mas os ecrãs novos deviam usar os nomes v6 (`cartaoAlt`, `textoSecundario`) directamente. Há inconsistência: `InicioScreen` usa `paleta.tintaSoft` (nome antigo via ponte), mas `EstadoSection` também usa `tintaSoft`. Nenhum código usa `paleta.textoSecundario` ou `paleta.cartaoAlt` directamente porque vêm da ponte.  
    **Gravidade**: Baixa (funciona, mas nomes duplicados confundem)  
    **Correcção concreta**: Documentar em `temas.ts` que é uma ponte temporária; migrar ecrãs antigos para os nomes v6 quando refactorar.

---

## O que está bem e não se deve mexer

1. **Contexto `SelectedPrinterContext`**: A escolha de manter máquina e secção num contexto (e não em parâmetros de rota) é correcta. Trocar de máquina não empilha ecrãs, e a secção aberta sobrevive à troca. A lógica de fallback (se a secção não existir na máquina de destino, cai em `estado`) está sólida.

2. **Hook `useAbrirMaquina`**: A abstração que encapsula `mudarMaquina` + `mudarSecao` + `navigate('Impressora')` está limpa e reutilizável. O `InicioScreen` usa-a correctamente nos atalhos (linha 226–229).

3. **Arquitectura de navegação v6**: Stack raiz único (`Root.Navigator`) com três abas (`Inicio`, `Impressora`, `Settings`) e ecrãs modais (câmara, histórico, adicionar) empilhados por cima está correcto. Não há duplicação de rotas, e a separação entre abas permanentes e ecrãs temporários é clara.

4. **Regra «o que não existe não se mostra»**: A lógica de `secoesDaMaquina` (linha 18–22 de `SelectedPrinterContext.tsx`) aplica bem a regra: resina só tem Estado, FDM tem tudo. O controlo segmentado só aparece quando `secoes.length > 1` (linha 133 de `PrinterTabScreen.tsx`).

5. **Consistência de tokens v6**: Os ficheiros `tokensV6.ts` e `temas.ts` estão bem separados: fonte única de verdade (hex em `tokensV6`), ponte de compatibilidade (triplos RGB em `temas`), conversão sob demanda (`hexDe`). A transição gradual entre nomes antigos e novos está controlada e não quebra nada existente.

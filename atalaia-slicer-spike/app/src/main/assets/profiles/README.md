# Perfis e Texturas de Fatiamento (Spike Atalaia)

> **AVISO DE LICENÇA (AGPL-3.0-or-later):**
> 
> Os ficheiros de configuração de perfil JSON, imagens de textura de mesa e modelos 3D STL contidos nesta árvore de diretórios (`assets/profiles/Elegoo/...`) foram extraídos dos perfis de sistema do **OrcaSlicer** e do projeto **SlicePilot** (ambos distribuídos sob a licença **GNU Affero General Public License v3.0 or later - AGPL-3.0-or-later**).
> 
> Estes ficheiros são mantidos **exclusivamente no ramo experimental do spike (`fatiador-1-viabilidade-licenca`)** para validação de viabilidade técnica da inicialização do motor nativo (`PresetBundle::load_system_configs`).
> 
> **NÃO fundir ou copiar estes ficheiros para o ramo principal (`main`) nem para a variante padrão MIT do Atalaia sem o devido isolamento e cumprimento integral das obrigações da AGPL v3.**

## Registar um preset novo (compatibilidade)

Não editar à mão os JSON de filamento/processo. O preset tem de ter `inherits` com a impressora base e viver em
`machine/<Serie>/`. Depois:

```bash
python3 tools/registar_preset.py "Elegoo Centauri Carbon 0.4 nozzle - Cosmos AFC"
python3 tools/registar_preset.py "<nome>" --check   # só verifica; exit 1 se faltar algo
```

O script acrescenta `{name, sub_path}` a `machine_list` no índice `<Fornecedor>.json` e o nome a
`compatible_printers` de todos os filamentos/processos da mesma série onde a impressora base consta
(os que não têm `compatible_printers` são globais e ficam intactos). É idempotente: uma segunda passagem
não escreve nada. A prova final continua a ser no aparelho — `nativeGetCompatibleFilaments`/`…Processes`
com as contagens esperadas para a série.

# Proposta de Arquitetura de Licenciamento e Rascunho de NOTICE

Documento de conformidade legal para a introdução do módulo de fatiamento local no Atalaia (`Hawaii-005/atalaia`).

---

## 1. Licenciamento por Componente

| Componente | Localização no Repositório | Licença Declarada | Condições de Distribuição |
|---|---|---|---|
| **Atalaia (Aplicação Base)** | Raiz (`src/`, `android/`, `assets/`) | **MIT** (Copyright © 2026 Bruno Rocha) | Fork do CC-Tool. Permissiva; preservada integralmente na variante `lite`. |
| **CC-Tool (Upstream)** | Código original herdado | **MIT** (Copyright © 2024-2026 Upstream Authors) | Preservação obrigatória de avisos de copyright no NOTICE. |
| **SlicePilot (Wrappers JNI)** | Código adaptado em `modules/atalaia-slicer/` | **MIT** (Copyright © 2026 Yemyat Thu) | Camada Kotlin e C++ de interface JNI (`slice_jni.cpp`). Preservação de copyright. |
| **Módulo Atalaia Slicer** | `modules/atalaia-slicer/` | **GNU AGPL-3.0-or-later** | Módulo nativo que incorpora `libslic3r`. Fornece copyleft forte para a variante `completa`. |
| **Perfis de Impressão Cosmos** | `assets/slicer_profiles/cosmos/` | Formato aberto OrcaSlicer JSON | Ficheiros de dados/configuração sem direitos autorais restritivos. |

---

## 2. Rascunho do Ficheiro `NOTICE` (Variante Completa com Fatiador)

Abaixo encontra-se a proposta de texto para o ficheiro `NOTICE` a disponibilizar em cada distribuição da variante `completa`:

```text
===============================================================================
ATALAIA — AVISO DE ATRIBUIÇÃO E LICENCIAMENTO (VARIANTE COMPLETA)
===============================================================================

Este software incorpora componentes de código aberto sujeitos a diferentes licenças.
A distribuição combinada da variante completa do Atalaia é disponibilizada sob os
termos da GNU Affero General Public License v3.0 (AGPL-3.0-or-later).

O código-fonte correspondente a esta compilação pode ser obtido em:
https://github.com/Hawaii-005/atalaia

-------------------------------------------------------------------------------
1. Componentes Principais
-------------------------------------------------------------------------------
• Atalaia
  Copyright (c) 2026 Bruno Rocha
  Licença: MIT

• CC-Tool (Upstream)
  Copyright (c) 2024-2026 CC-Tool Contributors
  Licença: MIT

• SlicePilot (Android JNI Bridge & Integration)
  Copyright (c) 2026 Yemyat Thu
  Licença: MIT

• libslic3r / PrusaSlicer / Slic3r
  Copyright (c) 2011-2026 Alessandro Ranellucci, Prusa Research s.r.o., e colaboradores
  Licença: GNU Affero General Public License v3.0 (AGPL-3.0)

-------------------------------------------------------------------------------
2. Bibliotecas Nativas Integradas no libslice_core.so
-------------------------------------------------------------------------------

A biblioteca nativa 'libslice_core.so' empacota estaticamente os seguintes
componentes compilados para arquitetura arm64-v8a:

• CGAL (Computational Geometry Algorithms Library) v5.6.3
  Licença Geral: Dual Licensing (LGPL v3+ / GPL v3+)
  Detalhamento de Pacotes Utilizados:
  - CGAL Core Kernel & Basic Geometry: LGPL v3+ [Verificado]
  - CGAL Surface_mesh: LGPL v3+ [Verificado]
  - CGAL Polygon_mesh_processing (PMP): GNU GPL v3+ [Verificado]
  - CGAL Triangulation_3: GNU GPL v3+ [Verificado]
  - CGAL Convex_hull_3: GNU GPL v3+ [Verificado]
  - CGAL Boolean_set_operations_2: GNU GPL v3+ [Verificado]
  - Status de Conformidade: Todos os componentes GPL são absorvidos pela AGPL-3.0
    do módulo 'modules/atalaia-slicer/'.
  - [A confirmar]: Verificar se o módulo de simplificação de malha Surface_mesh_simplification
    é acionado em tempo de execução para além do PMP.

• Boost C++ Libraries v1.84.0
  (Módulos: system, filesystem, thread, log, locale, regex, chrono, atomic, date_time, iostreams, program_options, nowide)
  Copyright (c) Beman Dawes, David Abrahams, et al.
  Licença: Boost Software License 1.0 (BSL-1.0) [Verificado]

• oneTBB (Threading Building Blocks) v2021.5.0
  Copyright (c) 2005-2026 Intel Corporation
  Licença: Apache License 2.0 [Verificado]

• OpenVDB v11.x (commit a68fd58)
  Copyright (c) Academy of Motion Picture Arts and Sciences
  Licença: Mozilla Public License 2.0 (MPL-2.0) [Verificado]

• c-blosc v1.17.0
  Copyright (c) 2009-2026 Francesc Alted
  Licença: BSD 3-Clause License [Verificado]

• Eigen v3.4 / 5.0.1
  Copyright (c) Eigen Authors
  Licença: Mozilla Public License 2.0 (MPL-2.0) [Verificado]

• OpenCASCADE (OCCT) v7.6.0
  Copyright (c) 1999-2026 OPEN CASCADE SAS
  Licença: GNU Lesser General Public License 2.1 with Open CASCADE Exception [Verificado]

• FreeType v2.12.1
  Copyright (c) 1996-2026 David Turner, Robert Wilhelm, Werner Lemberg
  Licença: FreeType License (FTL) [Verificado]

• OpenSSL v3.1.8
  Copyright (c) 1998-2026 The OpenSSL Project Authors
  Licença: Apache License 2.0 [Verificado]

• libjpeg-turbo v3.0.1
  Copyright (c) 2009-2026 D. R. Commander, et al.
  Licença: IJG / Modified BSD / zlib [Verificado]

• libpng v1.6.35
  Copyright (c) 1998-2026 Glenn Randers-Pehrson
  Licença: libpng License [Verificado]

• Expat XML Parser v2.5.0
  Copyright (c) 1998-2026 Thai Open Source Software Center Ltd and Clark Cooper
  Licença: MIT License [Verificado]

• Qhull v8.0.2
  Copyright (c) 1993-2026 C.B. Barber and The Geometry Center
  Licença: Permissiva (Qhull License / BSD-style) [Verificado]

• NLopt v2.5.0
  Copyright (c) 2007-2026 Massachusetts Institute of Technology
  Licença: GNU LGPL v2.1+ / MIT [Verificado]

• libnoise v1.0
  Copyright (c) 2003-2004 Jason Bevins
  Licença: GNU LGPL v2.1+ [Verificado]

• Cereal v1.3.0
  Copyright (c) 2013-2026 Randolph Voorhies, Shane Grant
  Licença: BSD 2-Clause [Verificado]

• Clipper & Clipper2
  Copyright (c) 2010-2026 Angus Johnson
  Licença: Boost Software License 1.0 (BSL-1.0) [Verificado]

• libnest2d
  Copyright (c) 2017-2026 Ultimaker B.V.
  Licença: GNU LGPL v3.0 [Verificado]

• libigl
  Copyright (c) 2013-2026 Alec Jacobson, Daniele Panozzo, et al.
  Licença: MPL-2.0 (Core) / GNU GPL v3 (Módulo copyleft/cgal) [Verificado]

• admesh
  Copyright (c) 1995-1996 Anthony Martin, 2011-2026 Alessandro Ranellucci
  Licença: GNU GPL v2+ [Verificado]

• Miniz v2.2.0
  Copyright (c) 2013-2026 Rich Geldreich, et al.
  Licença: MIT License [Verificado]

• QOI (Quite OK Image format)
  Copyright (c) 2021 Dominic Szablewski
  Licença: MIT License [Verificado]

• SemVer C++
  Copyright (c) 2015-2026 Neargye
  Licença: MIT License [Verificado]

• Earcut.hpp
  Copyright (c) Mapbox
  Licença: ISC License [Verificado]

• nlohmann/json
  Copyright (c) 2013-2026 Niels Lohmann
  Licença: MIT License [Verificado]

• ankerl::unordered_dense
  Copyright (c) 2022-2026 Martin Ankerl
  Licença: MIT License [Verificado]

• fast_float
  Copyright (c) 2021 The fast_float authors
  Licença: Apache 2.0 / MIT [Verificado]

-------------------------------------------------------------------------------
3. Itens a Confirmar em Auditoria de Código Nativo (Fase 1/2)
-------------------------------------------------------------------------------
[A confirmar 1]: Verificar se a biblioteca OpenCASCADE inclui dependências
                 acidentais de visualização OpenGL/X11 não desativadas nos
                 parâmetros do CMake.
[A confirmar 2]: Verificar se alguma macro de cabeçalho do libigl puxa código
                 adicional sob licenças restritivas de patentes comerciais.
[A confirmar 3]: Confirmar se a compilação do TBB em ARM64 no Android NDK r27
                 requer stubs manuais para 'pthread_setname_np'.
```

---

## 3. Garantias de Não-Modificação
* O ficheiro `LICENSE` raiz do Atalaia **não foi modificado** nem será tocado até aprovação final por escrito do utilizador.
* A variante `lite` não incluirá este texto de NOTICE nem qualquer referência a binários AGPL.

# Proposta de Arquitetura de Licenciamento e Rascunho de NOTICE

Documento de conformidade legal para a introdução do módulo de fatiamento local no Atalaia (`Hawaii-005/atalaia`).

---

## 1. Licenciamento por Componente

| Componente | Localização no Repositório | Licença Declarada | Condições de Distribuição |
|---|---|---|---|
| **Atalaia (Aplicação Base)** | Raiz (`src/`, `android/`, `assets/`) | **MIT** (Copyright © 2026 Bruno Rocha) | Fork do CC-Tool. Permissiva; preservada integralmente na variante `lite`. |
| **CC-Tool (Upstream)** | Código original herdado | **MIT** (Copyright 2025 FREDERICK) | Preservação obrigatória do aviso literal de copyright no NOTICE. |
| **SlicePilot (Wrappers JNI)** | Código adaptado em `modules/atalaia-slicer/` | **MIT** (Copyright © 2026 Yemyat Thu) | Camada Kotlin e C++ de interface JNI (`slice_jni.cpp`). Preservação do aviso literal de copyright. |
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
1. Componentes Principais e Textos Literais de Licença
-------------------------------------------------------------------------------

• Atalaia
  Copyright (c) 2026 Bruno Rocha
  Licença: MIT

• CC-Tool (Upstream)
  Copyright 2025 FREDERICK
  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the “Software”), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:
  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.
  THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.

• SlicePilot (Android UI, JNI Bridge & Integration)
  Copyright (c) 2026 Yemyat Thu
  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:
  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.
  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.

• libslic3r / PrusaSlicer / Slic3r
  Copyright (c) 2011-2026 Alessandro Ranellucci, Prusa Research s.r.o., e colaboradores
  Licença: GNU Affero General Public License v3.0 (AGPL-3.0)

-------------------------------------------------------------------------------
2. Bibliotecas Nativas Integradas no libslice_core.so
-------------------------------------------------------------------------------

As seguintes bibliotecas e pacotes estão indicados nos scripts de build e no
repositório de origem para ligação estática no binário 'libslice_core.so' (arm64-v8a):

• CGAL (Computational Geometry Algorithms Library) v5.6.3
  Licença Geral: Dual Licensing (LGPL v3+ / GPL v3+)
  Detalhamento de Pacotes Utilizados:
  - CGAL Core Kernel & Basic Geometry: LGPL v3+ [Declarado no repositório]
  - CGAL Surface_mesh: LGPL v3+ [Declarado no repositório]
  - CGAL Polygon_mesh_processing (PMP): GNU GPL v3+ [Declarado no repositório]
  - CGAL Triangulation_3: GNU GPL v3+ [Declarado no repositório]
  - CGAL Convex_hull_3: GNU GPL v3+ [Declarado no repositório]
  - CGAL Boolean_set_operations_2: GNU GPL v3+ [Declarado no repositório]
  - Status de Conformidade: Todos os componentes GPL são absorvidos pela AGPL-3.0
    do módulo 'modules/atalaia-slicer/'.
  - [A confirmar]: Verificar por análise de símbolos após compilação real se o módulo
    Surface_mesh_simplification ou outros pacotes CGAL são chamados em tempo de execução.

• Boost C++ Libraries v1.84.0
  (Módulos: system, filesystem, thread, log, locale, regex, chrono, atomic, date_time, iostreams, program_options, nowide)
  Copyright (c) Beman Dawes, David Abrahams, et al.
  Licença: Boost Software License 1.0 (BSL-1.0) [Declarado no repositório]

• oneTBB (Threading Building Blocks) v2021.5.0
  Copyright (c) 2005-2026 Intel Corporation
  Licença: Apache License 2.0 [Declarado no repositório]

• OpenVDB v11.x (commit a68fd58)
  Copyright (c) Academy of Motion Picture Arts and Sciences
  Licença: Mozilla Public License 2.0 (MPL-2.0) [Declarado no repositório]

• c-blosc v1.17.0
  Copyright (c) 2009-2026 Francesc Alted
  Licença: BSD 3-Clause License [Declarado no repositório]

• Eigen
  Versão: 5.0.1 (Eigen3 com SemVer adotado a partir da v5.0.0; arquivo eigen-5.0.1.tar.gz via release GitLab do projeto libeigen/eigen, onde EIGEN_WORLD_VERSION=3 e EIGEN_VERSION_STRING="5.0.1")
  Copyright (c) Eigen Authors
  Licença: Mozilla Public License 2.0 (MPL-2.0) [Declarado no repositório]

• OpenCASCADE (OCCT) v7.6.0
  Copyright (c) 1999-2026 OPEN CASCADE SAS
  Licença: GNU Lesser General Public License 2.1 with Open CASCADE Exception [Declarado no repositório]

• FreeType v2.12.1
  Copyright (c) 1996-2026 David Turner, Robert Wilhelm, Werner Lemberg
  Licença: FreeType License (FTL) / GPL v2 [Declarado no repositório]

• OpenSSL v3.1.8
  Copyright (c) 1998-2026 The OpenSSL Project Authors
  Licença: Apache License 2.0 [Declarado no repositório]

• libjpeg-turbo v3.0.1
  Copyright (c) 2009-2026 D. R. Commander, et al.
  Licença: IJG / Modified BSD / zlib [Declarado no repositório]

• libpng v1.6.35
  Copyright (c) 1998-2026 Glenn Randers-Pehrson
  Licença: libpng License [Declarado no repositório]

• Expat XML Parser v2.5.0
  Copyright (c) 1998-2026 Thai Open Source Software Center Ltd and Clark Cooper
  Licença: MIT License [Declarado no repositório]

• Qhull v8.0.2
  Copyright (c) 1993-2026 C.B. Barber and The Geometry Center
  Licença: Permissiva (Qhull License / BSD-style) [Declarado no repositório]

• NLopt v2.5.0
  Copyright (c) 2007-2026 Massachusetts Institute of Technology
  Licença: GNU LGPL v2.1+ / MIT [Declarado no repositório]

• libnoise v1.0
  Copyright (c) 2003-2004 Jason Bevins
  Licença: GNU LGPL v2.1+ [Declarado no repositório]

• Cereal v1.3.0
  Copyright (c) 2013-2026 Randolph Voorhies, Shane Grant
  Licença: BSD 2-Clause [Declarado no repositório]

• Clipper & Clipper2
  Copyright (c) 2010-2026 Angus Johnson
  Licença: Boost Software License 1.0 (BSL-1.0) [Declarado no repositório]

• libnest2d
  Copyright (c) 2017-2026 Ultimaker B.V.
  Licença: GNU LGPL v3.0 [Declarado no repositório]

• libigl
  Copyright (c) 2013-2026 Alec Jacobson, Daniele Panozzo, et al.
  Licença: MPL-2.0 (Core) / GNU GPL v3 (Módulo copyleft/cgal) [Declarado no repositório]

• admesh
  Copyright (c) 1995-1996 Anthony Martin, 2011-2026 Alessandro Ranellucci
  Licença: GNU GPL v2+ [Declarado no repositório]

• Miniz v2.2.0
  Copyright (c) 2013-2026 Rich Geldreich, et al.
  Licença: MIT License [Declarado no repositório]

• QOI (Quite OK Image format)
  Copyright (c) 2021 Dominic Szablewski
  Licença: MIT License [Declarado no repositório]

• SemVer C++
  Copyright (c) 2015-2026 Neargye
  Licença: MIT License [Declarado no repositório]

• Earcut.hpp
  Copyright (c) Mapbox
  Licença: ISC License [Declarado no repositório]

• nlohmann/json
  Copyright (c) 2013-2026 Niels Lohmann
  Licença: MIT License [Declarado no repositório]

• ankerl::unordered_dense
  Copyright (c) 2022-2026 Martin Ankerl
  Licença: MIT License [Declarado no repositório]

• fast_float
  Copyright (c) 2021 The fast_float authors
  Licença: Apache 2.0 / MIT [Declarado no repositório]

-------------------------------------------------------------------------------
3. Itens a Confirmar em Auditoria por Análise de Símbolos (Fase 1/2)
-------------------------------------------------------------------------------
[A confirmar 1]: Verificar se a biblioteca OpenCASCADE inclui dependências
                 acidentais de visualização OpenGL/X11 não desativadas nos
                 parâmetros do CMake.
[A confirmar 2]: Verificar se alguma macro de cabeçalho do libigl puxa código
                 adicional sob licenças restritivas de patentes comerciais.
[A confirmar 3]: Confirmar se a compilação do TBB em ARM64 no Android NDK r27
                 requer stubs manuais para 'pthread_setname_np'.
[A confirmar 4]: Inspecionar símbolos reais exportados por nm / readelf no binário
                 gerado pelo build próprio para validar se bibliotecas não declaradas
                 foram estaticamente ligadas.
```

---

## 3. Garantias de Não-Modificação
* O ficheiro `LICENSE` raiz do Atalaia **não foi modificado** nem será tocado até aprovação final por escrito do utilizador.
* A variante `lite` não incluirá este texto de NOTICE nem qualquer referência a binários AGPL.

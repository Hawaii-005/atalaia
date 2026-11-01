"""Wireframes low-fi da aba Fila (Atalaia).

Só tons de cinzento, contorno tracejado, texto curto. Cada bloco leva um número
num círculo. Escreve SVG em docs/design/fila/ e converte para PNG com o Chrome.

Regra: nada de dados inventados. Onde a app não tem o dado escreve-se «—» ou
«depende de …».
"""

import pathlib
import subprocess

CINZA = '#111'
W_TAB, H_TAB = 1180, 740
W_TEL, H_TEL = 390, 844
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'


def svg(largura, altura, corpo, titulo):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{largura}" height="{altura}" viewBox="0 0 {largura} {altura}">
  <title>{titulo}</title>
  <style>
    text {{ font-family: "Helvetica Neue", Arial, sans-serif; fill: #111; }}
    .t {{ font-size: 15px; font-weight: 700; }}
    .p {{ font-size: 12px; font-weight: 700; }}
    .d {{ font-size: 11px; fill: #444; }}
    .s {{ font-size: 9px; fill: #666; letter-spacing: .6px; }}
    .n {{ font-size: 12px; font-weight: 700; fill: #fff; }}
    .b {{ fill: none; stroke: #555; stroke-width: 1.2; stroke-dasharray: 5 4; }}
    .ff {{ fill: #f2f2f2; stroke: #555; stroke-width: 1; }}
    .sk {{ fill: #e6e6e6; }}
  </style>
{corpo}
</svg>
'''


def badge(x, y, n):
    return (
        f'<circle cx="{x}" cy="{y}" r="9" fill="{CINZA}"/>'
        f'<text x="{x}" y="{y + 4}" text-anchor="middle" class="n">{n}</text>'
    )


def bloco(x, y, w, h, n, titulo):
    return (
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" class="b"/>'
        f'{badge(x + 14, y + 14, n)}'
        f'<text x="{x + 30}" y="{y + 18}" class="s">{titulo.upper()}</text>'
    )


def linha(x, y, w, h=8, cor='#ddd', rx=4):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{cor}"/>'


def botao(x, y, w, h, texto, forte=False, tamanho=11):
    fill = '#e6e6e6' if forte else 'none'
    return (
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{fill}" '
        f'stroke="#555" stroke-width="1.2"/>'
        f'<text x="{x + w / 2}" y="{y + h / 2 + 4}" text-anchor="middle" '
        f'style="font-size:{tamanho}px;fill:#333">{texto}</text>'
    )


def pilula(x, y, w, h, texto):
    return (
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{h / 2}" fill="none" '
        f'stroke="#555" stroke-width="1" stroke-dasharray="3 3"/>'
        f'<text x="{x + w / 2}" y="{y + h / 2 + 3}" text-anchor="middle" class="s">{texto}</text>'
    )


def mini(x, y, lado, texto='MINI'):
    return (
        f'<rect x="{x}" y="{y}" width="{lado}" height="{lado}" rx="8" fill="#f2f2f2" '
        f'stroke="#555" stroke-width="1" stroke-dasharray="4 4"/>'
        f'<text x="{x + lado / 2}" y="{y + lado / 2 + 3}" text-anchor="middle" class="s">{texto}</text>'
    )


def pega(x, y):
    """Pega de arrastar: seis pontos."""
    pontos = ''
    for dx in (0, 5):
        for dy in (0, 6, 12):
            pontos += f'<circle cx="{x + dx}" cy="{y + dy}" r="1.6" fill="#555"/>'
    return pontos


def seta(x, y, sentido='cima'):
    if sentido == 'cima':
        d = f'M{x - 6} {y + 4} L{x} {y - 3} L{x + 6} {y + 4}'
    elif sentido == 'baixo':
        d = f'M{x - 6} {y - 4} L{x} {y + 3} L{x + 6} {y - 4}'
    else:
        d = f'M{x - 5} {y - 6} L{x + 1} {y} L{x - 5} {y + 6}'
    return f'<path d="{d}" fill="none" stroke="#555" stroke-width="1.6" stroke-linecap="round"/>'


def estado(x, y, texto):
    largura = 7 * len(texto) + 14
    return (
        f'<rect x="{x}" y="{y}" width="{largura}" height="18" rx="9" fill="#f2f2f2" '
        f'stroke="#555" stroke-width="1" stroke-dasharray="3 3"/>'
        f'<text x="{x + largura / 2}" y="{y + 12.5}" text-anchor="middle" class="s">{texto}</text>'
    )


def nota(x, y, texto, largura=None):
    """Rodapé de aviso: tracejado fino, texto pequeno."""
    w = largura if largura else 7 * len(texto) + 20
    return (
        f'<rect x="{x}" y="{y}" width="{w}" height="30" rx="8" fill="#fafafa" '
        f'stroke="#999" stroke-width="1" stroke-dasharray="2 3"/>'
        f'<text x="{x + 10}" y="{y + 19}" class="s">{texto}</text>'
    )


# ----------------------------------------------------------------- tablet
def tablet():
    b = []
    b.append(f'<rect x="0" y="0" width="{W_TAB}" height="{H_TAB}" fill="#fff" stroke="#bbb"/>')
    b.append('<text x="16" y="22" class="t">ATALAIA · FILA · TABLET 1180×740 (PAISAGEM)</text>')
    b.append('<text x="16" y="37" class="d">lista à esquerda, detalhe à direita · texto e valores são marcadores visuais</text>')

    # 1 cabeçalho
    b.append(bloco(16, 52, 1148, 74, 1, 'Cabeçalho da fila'))
    b.append('<text x="34" y="92" style="font-size:16px;font-weight:700">Fila</text>')
    b.append('<text x="34" y="110" class="d">Centauri Carbon · 3 itens</text>')
    b.append(botao(300, 76, 150, 30, 'MODO: MANUAL ⌄'))
    b.append(botao(462, 76, 92, 30, 'PAUSAR'))
    b.append('<text x="700" y="96" class="d">2h 05m conhecidas</text>')

    # 2 faixa de aviso
    b.append(bloco(16, 134, 1148, 48, 2, 'Faixa de estado do arranque'))
    b.append('<text x="34" y="164" class="d">A app tem de estar aberta para arrancar o próximo item.</text>')
    b.append('<text x="640" y="164" class="s">SE ESTIVER FECHADA, O ITEM FICA «À ESPERA»</text>')

    # 7 seletor de impressora
    b.append(bloco(16, 190, 600, 56, 7, 'Seletor de impressora'))
    b.append(pilula(34, 218, 130, 20, 'CENTAURI'))
    b.append(pilula(172, 218, 130, 20, 'SATURN 3'))
    b.append('<text x="316" y="232" class="s">FILAS SEPARADAS</text>')

    # 3 lista
    b.append(bloco(16, 254, 600, 350, 3, 'Lista da fila'))
    b.append('<text x="34" y="282" class="s">POSIÇÃO · ITEM · ESTADO · DURAÇÃO · INÍCIO/FIM</text>')
    ys = [294, 368, 442, 516]
    nomes = ['peca_1.gcode', 'peca_2.gcode', 'peca_3.gcode', 'peca_4.gcode']
    ests = ['PENDENTE', 'PENDENTE', 'A IMPRIMIR', 'BLOQUEADO']
    for i, y in enumerate(ys):
        b.append(f'<rect x="30" y="{y}" width="572" height="68" rx="10" fill="#fff" stroke="#bbb"/>')
        b.append(f'<text x="44" y="{y + 20}" class="s">{i + 1}</text>')
        b.append(mini(60, y + 10, 48, ''))
        b.append(f'<text x="122" y="{y + 22}" class="p">{nomes[i]}</text>')
        b.append(estado(122, y + 28, ests[i]))
        b.append('<text x="250" y="{0}" class="s">'.format(y + 42) + '45m · 14:10 → 14:55</text>' if i != 3 else
                 '<text x="250" y="{0}" class="s">— · bloqueado</text>'.format(y + 42))
        b.append(pega(556, y + 24))
        b.append(f'<text x="470" y="{y + 56}" class="s">↑ ↓ ⋯</text>')
    b.append('<text x="34" y="600" class="s">A IMPRIMIR NÃO ARRASTA · PEDE CONFIRMAÇÃO PARA REMOVER</text>')

    # 4 ações do item
    b.append(bloco(16, 612, 600, 72, 4, 'Ações do item · alternativa ao arrastar'))
    b.append(botao(32, 640, 78, 32, '↑ Subir'))
    b.append(botao(118, 640, 86, 32, '↓ Descer'))
    b.append(botao(212, 640, 78, 32, 'Topo'))
    b.append(botao(298, 640, 92, 32, 'Duplicar'))
    b.append(botao(398, 640, 86, 32, 'Remover', forte=False))

    # 5 detalhe
    b.append(bloco(632, 190, 532, 494, 5, 'Detalhe do item'))
    b.append('<text x="650" y="222" style="font-size:15px;font-weight:700">peca_1.gcode</text>')
    b.append(botao(1080, 202, 68, 26, 'Fechar'))
    b.append(mini(650, 236, 96, 'MINI'))
    b.append('<text x="762" y="252" class="s">CENTAURI CARBON</text>')
    b.append('<text x="762" y="270" class="d">tamanho — · camadas —</text>')
    b.append('<text x="762" y="288" class="s">MINIATURA DEPENDE DO FICHEIRO NA IMPRESSORA</text>')
    b.append(estado(650, 346, 'PENDENTE'))
    b.append('<text x="650" y="388" class="s">MOTIVO DE BLOQUEIO (QUANDO HÁ)</text>')
    b.append('<text x="650" y="406" class="d">—</text>')
    b.append('<text x="650" y="440" class="s">ESTIMATIVAS</text>')
    b.append('<text x="650" y="460" class="d">Duração 45m · início 14:10 · fim 14:55</text>')
    b.append('<text x="650" y="478" class="s">DURAÇÃO VEM DO NOME; SEM SUFIXO → «—»</text>')
    b.append('<text x="650" y="512" class="s">POSIÇÃO</text>')
    b.append('<text x="650" y="532" class="d">2 de 3 · pode subir, descer ou ir ao topo</text>')
    b.append('<text x="650" y="566" class="s">AÇÕES</text>')
    b.append(botao(650, 578, 150, 36, 'ARRANCAR AGORA', forte=True))
    b.append(botao(810, 578, 100, 36, 'Duplicar'))
    b.append(botao(918, 578, 100, 36, 'Remover'))
    b.append('<text x="650" y="640" class="s">ARRANCAR SÓ COM IMPRESSORA OCIOSA E LIGADA</text>')
    b.append('<text x="650" y="660" class="s">«PAUSAR FILA» NÃO PÁRA A IMPRESSÃO EM CURSO</text>')

    # 6 rodapé
    b.append(bloco(16, 690, 1148, 44, 6, 'Rodapé'))
    b.append('<text x="34" y="724" class="d">Adicionar vem de Ficheiros › Pôr na fila (fim ou topo). A fila é por impressora.</text>')

    return svg(W_TAB, H_TAB, '\n'.join(b), 'Fila — tablet')


# -------------------------------------------------------------- telemóvel
def telemovel():
    b = []
    b.append(f'<rect x="0" y="0" width="{W_TEL}" height="{H_TEL}" fill="#fff" stroke="#bbb"/>')
    b.append('<text x="14" y="22" class="t">ATALAIA · FILA · TELEMÓVEL 390×844</text>')
    b.append('<text x="14" y="37" class="d">lista + folha de detalhe</text>')

    # 1 cabeçalho
    b.append(bloco(12, 52, 366, 64, 1, 'Cabeçalho'))
    b.append(botao(24, 68, 32, 32, '←'))
    b.append('<text x="68" y="84" style="font-size:15px;font-weight:700">Fila</text>')
    b.append('<text x="68" y="100" class="d">Centauri Carbon</text>')
    b.append(botao(300, 68, 66, 32, 'MANUAL'))

    # 2 chips
    b.append(bloco(12, 124, 366, 54, 2, 'Impressoras'))
    b.append(pilula(24, 148, 110, 20, 'CENTAURI'))
    b.append(pilula(142, 148, 100, 20, 'SATURN 3'))
    b.append('<text x="252" y="162" class="s">FILAS SEPARADAS</text>')

    # 3 aviso
    b.append(bloco(12, 186, 366, 48, 3, 'Aviso de primeiro plano'))
    b.append('<text x="24" y="222" class="d">Arranque só com a app aberta.</text>')

    # 4 lista
    b.append(bloco(12, 242, 366, 458, 4, 'Lista da fila'))
    ys = [264, 372, 480, 588]
    ests = ['PENDENTE', 'PENDENTE', 'A IMPRIMIR', 'BLOQUEADO']
    for i, y in enumerate(ys):
        b.append(f'<rect x="22" y="{y}" width="346" height="96" rx="12" fill="#fff" stroke="#bbb"/>')
        b.append(f'<text x="34" y="{y + 16}" class="s">{i + 1}</text>')
        b.append(mini(34, y + 24, 56, ''))
        b.append(f'<text x="102" y="{y + 30}" class="p">peca_{i + 1}.gcode</text>')
        b.append(estado(102, y + 38, ests[i]))
        b.append('<text x="102" y="{0}" class="s">45m · 14:10 → 14:55</text>'.format(y + 72) if i != 3 else
                 '<text x="102" y="{0}" class="s">— · bloqueado</text>'.format(y + 72))
        b.append(pega(312, y + 26))
        b.append(f'<text x="310" y="{y + 84}" class="s">↑↓</text>')

    # 5 nota de toque
    b.append(bloco(12, 708, 366, 40, 5, 'Tocar no item'))
    b.append('<text x="24" y="738" class="d">Abre a folha de detalhe (bloco 6).</text>')

    # 6 barra inferior
    b.append(bloco(12, 756, 366, 64, 6, 'Barra inferior'))
    b.append(botao(24, 778, 130, 30, 'PAUSAR FILA'))
    b.append('<text x="170" y="798" class="s">3 ITENS · 2h05</text>')
    b.append(botao(292, 778, 74, 30, '↑↓'))

    return svg(W_TEL, H_TEL, '\n'.join(b), 'Fila — telemóvel')


# ----------------------------------------------------------------- detalhe
def detalhe():
    b = []
    b.append(f'<rect x="0" y="0" width="{W_TEL}" height="{H_TEL}" fill="#fff" stroke="#bbb"/>')
    b.append('<text x="14" y="22" class="t">ATALAIA · FILA · DETALHE DO ITEM</text>')
    b.append('<text x="14" y="37" class="d">folha no telemóvel · painel lateral no tablet (mesmos blocos)</text>')

    b.append(bloco(12, 52, 366, 60, 1, 'Cabeçalho da folha'))
    b.append('<text x="24" y="100" style="font-size:14px;font-weight:700">peca_1.gcode</text>')
    b.append(botao(330, 66, 36, 30, '✕'))

    b.append(bloco(12, 120, 366, 118, 2, 'Miniatura e metadados'))
    b.append(mini(24, 162, 72, 'MINI'))
    b.append('<text x="108" y="186" class="d">Centauri Carbon</text>')
    b.append('<text x="108" y="204" class="d">tamanho — · camadas —</text>')
    b.append('<text x="108" y="226" class="s">MINIATURA DEPENDE DO FICHEIRO</text>')

    b.append(bloco(12, 246, 366, 86, 3, 'Estado e motivo'))
    b.append(estado(24, 278, 'PENDENTE'))
    b.append('<text x="24" y="320" class="d">Motivo de bloqueio: —</text>')

    b.append(bloco(12, 340, 366, 92, 4, 'Estimativas'))
    b.append('<text x="24" y="382" class="d">Duração 45m</text>')
    b.append('<text x="24" y="402" class="d">Início 14:10 · Fim 14:55</text>')
    b.append('<text x="24" y="422" class="s">DESCONHECIDO → «—» · NUNCA INVENTAR</text>')

    b.append(bloco(12, 440, 366, 112, 5, 'Posição'))
    b.append('<text x="24" y="482" class="d">1 de 3 · fila da Centauri</text>')
    b.append(botao(24, 492, 100, 40, '↑ Subir'))
    b.append(botao(132, 492, 100, 40, '↓ Descer'))
    b.append(botao(240, 492, 80, 40, 'Topo'))
    b.append('<text x="24" y="546" class="s">A IMPRIMIR: BOTÕES DESATIVADOS</text>')

    b.append(bloco(12, 560, 366, 132, 6, 'Ações'))
    b.append(botao(24, 596, 342, 42, 'ARRANCAR AGORA', forte=True))
    b.append(botao(24, 646, 160, 34, 'Duplicar'))
    b.append(botao(196, 646, 170, 34, 'Remover'))

    b.append(bloco(12, 700, 366, 128, 7, 'Regras que a folha mostra'))
    b.append('<text x="24" y="742" class="d">• Remover «a imprimir» pede confirmação.</text>')
    b.append('<text x="24" y="762" class="d">• Parar/cancelar tem prioridade.</text>')
    b.append('<text x="24" y="782" class="d">• A fila só anda com a app aberta.</text>')
    b.append('<text x="24" y="802" class="d">• Nenhuma ação muda o protocolo.</text>')
    b.append('<text x="24" y="822" class="s">MOVER ENTRE IMPRESSORAS: DEPENDE DE DECISÃO</text>')

    return svg(W_TEL, H_TEL, '\n'.join(b), 'Fila — detalhe do item')


# --------------------------------------------------------------- mesa limpa
def mesaLimpa():
    b = []
    b.append(f'<rect x="0" y="0" width="{W_TEL}" height="{H_TEL}" fill="#fff" stroke="#bbb"/>')
    b.append('<text x="14" y="22" class="t">ATALAIA · FILA · «MESA LIMPA?»</text>')
    b.append('<text x="14" y="37" class="d">modo «com confirmação» · contagem configurável</text>')

    # 1 fundo
    b.append(bloco(12, 52, 366, 780, 1, 'Fundo escurecido'))
    b.append('<text x="24" y="80" class="s">O ECRÃ DA FILA FICA VISÍVEL ATRÁS, SEM INTERAÇÃO</text>')

    # 2 cartão
    b.append(f'<rect x="32" y="200" width="326" height="470" rx="16" fill="#fff" stroke="#555" stroke-width="1.6" stroke-dasharray="6 4"/>')
    b.append(badge(48, 216, 2))
    b.append('<text x="64" y="220" class="s">CARTÃO DE CONFIRMAÇÃO</text>')

    b.append('<text x="52" y="266" style="font-size:18px;font-weight:700">Mesa limpa?</text>')
    b.append('<text x="52" y="288" class="d">A impressão anterior terminou.</text>')

    b.append(badge(48, 314, 3))
    b.append('<text x="64" y="318" class="s">ITEM E IMPRESSORA</text>')
    b.append(mini(52, 330, 56, 'MINI'))
    b.append('<text x="120" y="350" class="p">peca_2.gcode</text>')
    b.append('<text x="120" y="368" class="d">Centauri Carbon · 45m</text>')

    b.append(badge(48, 410, 4))
    b.append('<text x="64" y="414" class="s">CONTAGEM DECRESCENTE</text>')
    b.append('<circle cx="90" cy="470" r="34" fill="none" stroke="#555" stroke-width="1.2" stroke-dasharray="4 4"/>')
    b.append('<text x="90" y="476" text-anchor="middle" style="font-size:16px;font-weight:700">60</text>')
    b.append('<text x="140" y="462" class="d">segundos</text>')
    b.append('<text x="140" y="480" class="s">CONFIGURÁVEL · 15 A 120 s</text>')

    b.append(badge(48, 524, 5))
    b.append('<text x="64" y="528" class="s">AÇÃO PRIMÁRIA</text>')
    b.append(botao(52, 540, 286, 48, 'MESA LIMPA — ARRANCAR', forte=True, tamanho=12))

    b.append(badge(48, 606, 6))
    b.append('<text x="64" y="610" class="s">CANCELAR</text>')
    b.append(botao(52, 620, 286, 40, 'Cancelar'))

    # 7 nota
    b.append(bloco(12, 690, 366, 142, 7, 'Regra da contagem'))
    b.append('<text x="24" y="730" class="d">No fim da contagem NÃO arranca:</text>')
    b.append('<text x="24" y="748" class="d">o item fica «à espera de mesa limpa».</text>')
    b.append('<text x="24" y="766" class="d">Só o toque confirma a mesa.</text>')
    b.append('<text x="24" y="784" class="d">Fechar a app desfaz o pedido.</text>')
    b.append('<text x="24" y="812" class="s">A CONFIRMAÇÃO NÃO SUBSTITUI O ACK DA IMPRESSORA</text>')

    return svg(W_TEL, H_TEL, '\n'.join(b), 'Fila — mesa limpa')


# ----------------------------------------------------------- modo de arranque
def modos():
    b = []
    b.append(f'<rect x="0" y="0" width="{W_TEL}" height="{H_TEL}" fill="#fff" stroke="#bbb"/>')
    b.append('<text x="14" y="22" class="t">ATALAIA · FILA · MODO DE ARRANQUE</text>')
    b.append('<text x="14" y="37" class="d">por impressora · em Definições › Fila e impressão</text>')

    b.append(bloco(12, 52, 366, 62, 1, 'Cabeçalho'))
    b.append('<text x="24" y="92" style="font-size:14px;font-weight:700">Arranque do próximo</text>')
    b.append('<text x="24" y="108" class="d">Centauri Carbon</text>')

    b.append(bloco(12, 122, 366, 100, 2, 'Manual (por defeito)'))
    b.append('<circle cx="34" cy="154" r="7" fill="none" stroke="#555" stroke-width="1.6"/>')
    b.append('<circle cx="34" cy="154" r="3" fill="#555"/>')
    b.append('<text x="52" y="158" class="p">Manual</text>')
    b.append('<text x="52" y="180" class="d">Nada arranca sozinho.</text>')
    b.append('<text x="52" y="198" class="d">Tocas em «Arrancar» quando quiseres.</text>')

    b.append(bloco(12, 230, 366, 136, 3, 'Com confirmação'))
    b.append('<circle cx="34" cy="262" r="7" fill="none" stroke="#555" stroke-width="1.6"/>')
    b.append('<text x="52" y="266" class="p">Com confirmação</text>')
    b.append('<text x="52" y="288" class="d">Pergunta «Mesa limpa?» no fim.</text>')
    b.append('<text x="52" y="306" class="d">Nunca arranca por timeout.</text>')
    b.append('<text x="52" y="332" class="s">CONTAGEM</text>')
    b.append(botao(52, 338, 74, 24, '60 s ⌄'))
    b.append('<text x="136" y="355" class="s">15 · 30 · 60 · 120</text>')

    b.append(bloco(12, 374, 366, 186, 4, 'Automático'))
    b.append('<circle cx="34" cy="406" r="7" fill="none" stroke="#555" stroke-width="1.6"/>')
    b.append('<text x="52" y="410" class="p">Automático</text>')
    b.append('<text x="52" y="432" class="d">O próximo item arranca sozinho.</text>')
    b.append('<rect x="24" y="446" width="342" height="56" rx="8" fill="#f2f2f2" stroke="#555" stroke-width="1.2" stroke-dasharray="4 3"/>')
    b.append('<text x="34" y="464" class="s">AVISO FORTE</text>')
    b.append('<text x="34" y="482" class="d">Arranca sem confirmares a mesa livre.</text>')
    b.append('<text x="34" y="496" class="s">RISCO DE CHOQUE COM A PEÇA ANTERIOR</text>')
    b.append('<rect x="24" y="512" width="16" height="16" rx="3" fill="none" stroke="#555" stroke-width="1.4"/>')
    b.append('<text x="48" y="524" class="d">Confirmo que entendo o risco</text>')
    b.append('<text x="24" y="548" class="s">PAUSA ENTRE ARRANQUES: 2 MIN (FIXA HOJE)</text>')

    b.append(bloco(12, 568, 366, 96, 5, 'Guardar'))
    b.append(botao(24, 594, 160, 42, 'GUARDAR', forte=True))
    b.append(botao(196, 594, 160, 42, 'Cancelar'))
    b.append('<text x="24" y="652" class="s">SEM CONFIRMAÇÃO NO AUTOMÁTICO, NÃO GRAVA</text>')

    b.append(bloco(12, 672, 366, 160, 6, 'O que isto significa'))
    b.append('<text x="24" y="714" class="d">• Só funciona com a app aberta.</text>')
    b.append('<text x="24" y="732" class="d">• Fechada: o item fica «à espera».</text>')
    b.append('<text x="24" y="750" class="d">• Ao reabrir, a app avisa.</text>')
    b.append('<text x="24" y="768" class="d">• O modo é guardado por impressora.</text>')
    b.append('<text x="24" y="794" class="s">MODO ANTIGO MIGRA PARA «COM CONFIRMAÇÃO»</text>')
    b.append('<text x="24" y="812" class="s">NUNCA PARA «AUTOMÁTICO» SEM CONSENTIMENTO</text>')

    return svg(W_TEL, H_TEL, '\n'.join(b), 'Fila — modo de arranque')


# ------------------------------------------------------------------- erros
def erros():
    b = []
    b.append(f'<rect x="0" y="0" width="{W_TAB}" height="{H_TAB}" fill="#fff" stroke="#bbb"/>')
    b.append('<text x="16" y="22" class="t">ATALAIA · FILA · ERROS E RECUPERAÇÃO</text>')
    b.append('<text x="16" y="37" class="d">cada cartão é um estado real que a app tem de saber mostrar</text>')

    # 1 ack recusado
    b.append(bloco(16, 56, 372, 196, 1, 'Ack recusado'))
    b.append('<text x="34" y="86" class="p">A impressora recusou</text>')
    b.append('<text x="34" y="106" class="d">peca_1.gcode · código 5</text>')
    b.append('<text x="34" y="124" class="d">«Ficheiro não existe na máquina»</text>')
    b.append('<text x="34" y="146" class="s">O ITEM NÃO SAI DA FILA</text>')
    b.append(botao(34, 160, 130, 34, 'Tentar de novo'))
    b.append(botao(174, 160, 110, 34, 'Ver motivo'))

    # 2 sem ligação
    b.append(bloco(404, 56, 372, 196, 2, 'Sem ligação a meio'))
    b.append('<text x="422" y="86" class="p">Perdeste a ligação</text>')
    b.append('<text x="422" y="106" class="d">O envio parou a meio.</text>')
    b.append('<text x="422" y="124" class="d">Nada foi arrancado.</text>')
    b.append('<text x="422" y="146" class="s">ESTADO DO ITEM: «A ENVIAR» → «À ESPERA»</text>')
    b.append(botao(422, 160, 150, 34, 'Ligar e verificar'))

    # 3 desconhecido
    b.append(bloco(792, 56, 372, 196, 3, 'Estado desconhecido'))
    b.append('<text x="810" y="86" class="p">Não sei o que se passa</text>')
    b.append('<text x="810" y="106" class="d">A app foi fechada a meio.</text>')
    b.append('<text x="810" y="124" class="d">Não mostro «a imprimir» sem prova.</text>')
    b.append(botao(810, 140, 110, 32, 'Verificar'))
    b.append(botao(928, 140, 110, 32, 'Concluído'))
    b.append(botao(1046, 140, 100, 32, 'Repor'))

    # 4 bloqueios
    b.append(bloco(16, 268, 560, 260, 4, 'Bloqueios antes de arrancar'))
    b.append('<text x="34" y="300" class="s">MOTIVO · SEMPRE VISÍVEL</text>')
    motivos = [
        'Impressora não está ociosa (a imprimir ou em pausa)',
        'Sem ligação, ou último estado com mais de 45 s',
        'Impressão anterior falhou ou foi cancelada',
        'Tipo de ficheiro não serve nesta impressora',
        'Filamento insuficiente ou cor em falta (aviso)',
    ]
    for i, texto in enumerate(motivos):
        y = 318 + i * 36
        b.append(f'<rect x="34" y="{y}" width="524" height="28" rx="6" fill="#fff" stroke="#ccc"/>')
        b.append(f'<text x="44" y="{y + 18}" class="d">{texto}</text>')

    # 5 fila pausada
    b.append(bloco(592, 268, 572, 120, 5, 'Fila pausada'))
    b.append('<text x="610" y="298" class="p">Fila pausada</text>')
    b.append('<text x="610" y="318" class="d">Nenhum item novo arranca.</text>')
    b.append('<text x="610" y="336" class="d">A impressão em curso continua.</text>')
    b.append(botao(610, 348, 120, 30, 'Retomar fila'))

    # 6 dois toques
    b.append(bloco(592, 404, 572, 124, 6, 'Dois toques em «Arrancar»'))
    b.append('<text x="610" y="434" class="p">A arrancar…</text>')
    b.append('<text x="610" y="454" class="d">O botão desativa e mostra progresso.</text>')
    b.append('<text x="610" y="472" class="d">O mesmo item não sai duas vezes.</text>')
    b.append('<text x="610" y="494" class="s">TRAVA POR ID + MARCA «ARRANQUE TENTADO»</text>')

    # 7 nota
    b.append(bloco(16, 544, 1148, 60, 7, 'Regra comum'))
    b.append('<text x="34" y="574" class="d">Nenhum erro descarta um item em silêncio: ou volta a «pendente», ou fica «falhou» com o motivo.</text>')
    b.append('<text x="34" y="592" class="s">O PROTOCOLO SDCP NÃO MUDA</text>')

    # 8 reconciliação
    b.append(bloco(16, 616, 1148, 108, 8, 'Ao reabrir a app'))
    b.append('<text x="34" y="646" class="d">1. Lê a fila guardada · 2. Pede o estado real à impressora · 3. Compara antes de mostrar.</text>')
    b.append('<text x="34" y="668" class="d">Se a impressora estiver a imprimir um ficheiro da fila, esse item passa a «a imprimir» e nunca é reenviado.</text>')
    b.append('<text x="34" y="690" class="d">Se não for possível saber, fica «estado desconhecido» com ações seguras.</text>')
    b.append('<text x="34" y="712" class="s">SEM LER O ESTADO REAL, NADA É MARCADO COMO CONCLUÍDO</text>')

    return svg(W_TAB, H_TAB, '\n'.join(b), 'Fila — erros e recuperação')


def main():
    destino = pathlib.Path('docs/design/fila')
    destino.mkdir(parents=True, exist_ok=True)
    desenhos = {
        'wireframe-tablet': (tablet(), W_TAB, H_TAB),
        'wireframe-telemovel': (telemovel(), W_TEL, H_TEL),
        'wireframe-detalhe': (detalhe(), W_TEL, H_TEL),
        'wireframe-mesa-limpa': (mesaLimpa(), W_TEL, H_TEL),
        'wireframe-modo-arranque': (modos(), W_TEL, H_TEL),
        'wireframe-erros': (erros(), W_TAB, H_TAB),
    }
    for nome, (conteudo, largura, altura) in desenhos.items():
        svg_path = destino / f'{nome}.svg'
        svg_path.write_text(conteudo, encoding='utf-8')
        subprocess.run(
            [
                CHROME,
                '--headless',
                '--disable-gpu',
                '--hide-scrollbars',
                f'--window-size={largura},{altura}',
                f'--screenshot={destino / (nome + ".png")}',
                f'file://{svg_path.resolve()}',
            ],
            check=True,
            capture_output=True,
        )
    print('escritos', len(desenhos), 'wireframes em', destino)


if __name__ == '__main__':
    main()

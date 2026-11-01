"""Wireframes low-fi da aba Controlos (Atalaia).

Só tons de cinzento, contorno tracejado, texto curto e um número por bloco.
Escreve SVG em docs/design/controlos/ e converte para PNG com o Chrome.

Regra: nada de dados inventados. Onde a app não tem o dado escreve-se «—» ou
«depende de …».
"""

import pathlib
import subprocess

CINZA = '#111'
W_TAB, H_TAB = 1180, 740
W_TEL, H_TEL = 390, 844
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
DESTINO = pathlib.Path(__file__).parent


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


def tecla(x, y, lado, simbolo):
    return (
        f'<rect x="{x}" y="{y}" width="{lado}" height="{lado}" rx="10" fill="#fafafa" '
        f'stroke="#555" stroke-width="1.4"/>'
        f'<text x="{x + lado / 2}" y="{y + lado / 2 + 6}" text-anchor="middle" '
        f'style="font-size:18px;fill:#333">{simbolo}</text>'
    )


def trilho(x, y, w, valor=0.6):
    return (
        f'<rect x="{x}" y="{y}" width="{w}" height="6" rx="3" fill="#e2e2e2"/>'
        f'<rect x="{x}" y="{y}" width="{w * valor:.0f}" height="6" rx="3" fill="#999"/>'
        f'<circle cx="{x + w * valor:.0f}" cy="{y + 3}" r="8" fill="#fff" stroke="#555"/>'
    )


def estado(x, y, texto, largura=None):
    w = largura if largura else 6.2 * len(texto) + 16
    return (
        f'<rect x="{x}" y="{y}" width="{w}" height="18" rx="9" fill="#f2f2f2" '
        f'stroke="#555" stroke-width="1" stroke-dasharray="3 3"/>'
        f'<text x="{x + w / 2}" y="{y + 12.5}" text-anchor="middle" class="s">{texto}</text>'
    )


def nota(x, y, texto, largura):
    return (
        f'<rect x="{x}" y="{y}" width="{largura}" height="28" rx="8" fill="#fafafa" '
        f'stroke="#999" stroke-width="1" stroke-dasharray="2 3"/>'
        f'<text x="{x + 10}" y="{y + 18}" class="s">{texto}</text>'
    )


# ---------------------------------------------------------------- tablet

def tablet():
    c = []
    c.append(f'<rect width="{W_TAB}" height="{H_TAB}" fill="#fbfbfb"/>')

    # 1 cabeçalho
    c.append(bloco(24, 18, 1132, 54, 1, 'cabeçalho'))
    c.append(botao(122, 30, 30, 30, '‹', tamanho=15))
    c.append('<text x="164" y="47" class="t">Controlos</text>')
    c.append(pilula(306, 31, 92, 24, 'CENTAURI'))
    c.append(pilula(406, 31, 80, 24, 'SATURN'))
    c.append(estado(1050, 34, 'OCIOSA', 80))

    # coluna esquerda
    c.append(bloco(24, 86, 520, 292, 2, 'câmara ao vivo'))
    c.append('<rect x="40" y="108" width="488" height="246" rx="8" fill="#ececec" stroke="#888" stroke-dasharray="4 4"/>')
    c.append('<text x="284" y="235" text-anchor="middle" class="s">VÍDEO · 16:9</text>')
    c.append(pilula(40, 358, 96, 18, 'AMPLIAR'))

    c.append(bloco(24, 392, 520, 96, 3, 'posição e estado'))
    c.append('<text x="40" y="424" class="d">X 120.4   Y 118.0   Z 12.6</text>')
    c.append('<text x="40" y="446" class="d">estado atualizado há 2 s</text>')
    c.append(nota(40, 456, 'sem posição da máquina → mostra «—»', 488))

    c.append(bloco(24, 502, 520, 82, 4, 'aviso de bloqueio'))
    c.append('<text x="40" y="534" class="d">A imprimir: movimento e Home desativados.</text>')
    c.append('<text x="40" y="556" class="s">LUZ, VENTOINHAS E VELOCIDADE CONTINUAM ATIVOS</text>')

    c.append(bloco(24, 598, 520, 54, 5, 'último comando'))
    c.append('<text x="40" y="630" class="d">OK · mover X +10 mm</text>')
    c.append(pilula(440, 614, 88, 22, 'ERRO: ACK 3'))

    c.append(nota(24, 678, 'rodapé: «só com a app aberta» · versão do protocolo não é mostrada', 1132))

    # coluna direita
    c.append(bloco(560, 86, 596, 300, 6, 'movimento · passo e D-pad'))
    for i, p in enumerate(['0.1', '1', '10', '50']):
        c.append(botao(580 + i * 66, 112, 60, 34, f'{p} mm', forte=(p == '10')))
    cx = 858
    c.append(tecla(cx, 160, 56, '▲'))
    c.append(tecla(cx - 92, 224, 56, '◀'))
    c.append(botao(cx - 34, 232, 56, 40, 'HOME'))
    c.append(tecla(cx + 36, 224, 56, '▶'))
    c.append(tecla(cx, 288, 56, '▼'))
    c.append(botao(580, 160, 96, 44, 'Z +'))
    c.append(botao(580, 210, 96, 44, 'Z −'))
    c.append('<text x="580" y="276" class="s">Z 10/50 MM → CONFIRMA</text>')
    c.append(botao(580, 292, 150, 44, 'Home XYZ'))
    c.append(botao(580, 342, 66, 34, 'Home Z'))
    c.append(botao(654, 342, 66, 34, 'Home XY'))
    c.append('<text x="760" y="368" class="s">EIXO XY 56 PX · 1 TOQUE = 1 MOVIMENTO · DESATIVADO À ESPERA DE ACK</text>')

    c.append(bloco(560, 400, 596, 76, 7, 'luz'))
    c.append('<text x="580" y="432" class="d">Segunda luz · estado lido da máquina</text>')
    c.append('<rect x="1060" y="418" width="66" height="30" rx="15" fill="#e6e6e6" stroke="#555"/>')
    c.append('<circle cx="1109" cy="433" r="12" fill="#fff" stroke="#555"/>')
    c.append(estado(986, 424, 'LIGADA', 62))

    c.append(bloco(560, 490, 596, 104, 8, 'ventoinhas'))
    for i, nome in enumerate(['Modelo', 'Lateral', 'Câmara']):
        y = 518 + i * 24
        c.append(f'<text x="580" y="{y + 5}" class="d">{nome}</text>')
        c.append(trilho(650, y, 340, 0.6))
        c.append(f'<text x="1010" y="{y + 5}" class="d">60%</text>')
    c.append('<text x="1060" y="548" class="s">ENVIA AO SOLTAR</text>')

    c.append(bloco(560, 608, 596, 60, 9, 'velocidade'))
    for i, p in enumerate(['50', '100', '150', '200']):
        c.append(botao(580 + i * 62, 628, 56, 28, f'{p}%', forte=(p == '100')))
    c.append('<text x="840" y="646" class="d">valor atual lido · pedido enquanto não há Ack</text>')

    return svg(W_TAB, H_TAB, '\n'.join(c), 'Controlos — tablet')


# ---------------------------------------------------------------- telemóvel

def telemovel():
    c = []
    c.append(f'<rect width="{W_TEL}" height="{H_TEL}" fill="#fbfbfb"/>')
    c.append(bloco(12, 12, 366, 50, 1, 'cabeçalho'))
    c.append(botao(24, 22, 30, 30, '‹', tamanho=15))
    c.append('<text x="66" y="42" class="t">Controlos</text>')
    c.append(pilula(232, 24, 132, 24, 'CENTAURI · OCIOSA'))

    c.append(bloco(12, 70, 366, 52, 2, 'estado'))
    c.append('<text x="26" y="98" class="d">X 120.4  Y 118.0  Z 12.6</text>')
    c.append('<text x="26" y="114" class="s">ATUALIZADO HÁ 2 S</text>')

    c.append(bloco(12, 130, 366, 150, 3, 'câmara'))
    c.append('<rect x="26" y="152" width="338" height="110" rx="8" fill="#ececec" stroke="#888" stroke-dasharray="4 4"/>')
    c.append('<text x="195" y="212" text-anchor="middle" class="s">VÍDEO</text>')

    c.append(bloco(12, 288, 366, 60, 4, 'passo'))
    for i, p_ in enumerate(['0.1', '1', '10', '50']):
        c.append(botao(26 + i * 86, 308, 78, 32, f'{p_} mm', forte=(p_ == '10')))

    c.append(bloco(12, 356, 366, 300, 5, 'D-pad e Home'))
    cx = 195
    c.append(tecla(cx - 28, 380, 56, '▲'))
    c.append(tecla(cx - 92, 444, 56, '◀'))
    c.append(botao(cx - 28, 452, 56, 40, 'HOME'))
    c.append(tecla(cx + 36, 444, 56, '▶'))
    c.append(tecla(cx - 28, 508, 56, '▼'))
    c.append('<text x="30" y="392" class="s">XY</text>')
    c.append(botao(26, 576, 164, 36, 'Z +'))
    c.append(botao(198, 576, 164, 36, 'Z −'))
    c.append(botao(26, 620, 164, 32, 'Home XYZ'))
    c.append(botao(198, 620, 164, 32, 'Home Z'))

    c.append(bloco(12, 664, 366, 56, 6, 'luz'))
    c.append('<text x="26" y="694" class="d">Segunda luz · estado da máquina</text>')
    c.append('<rect x="300" y="678" width="60" height="28" rx="14" fill="#e6e6e6" stroke="#555"/>')
    c.append('<circle cx="344" cy="692" r="11" fill="#fff" stroke="#555"/>')

    c.append(nota(12, 730, 'scroll → ventoinhas, velocidade, temperaturas', 366))
    c.append(nota(12, 770, 'rodapé: só com a app aberta · sem posição → «—»', 366))
    return svg(W_TEL, H_TEL, '\n'.join(c), 'Controlos — telemóvel')


# ---------------------------------------------------------------- saturn

def saturn():
    c = []
    c.append(f'<rect width="{W_TEL}" height="{H_TEL}" fill="#fbfbfb"/>')
    c.append(bloco(12, 12, 366, 50, 1, 'cabeçalho · saturn'))
    c.append(botao(70, 22, 30, 30, '‹', tamanho=15))
    c.append('<text x="112" y="42" class="t">Controlos</text>')
    c.append(pilula(240, 24, 124, 24, 'SATURN · OCIOSA'))

    c.append(bloco(12, 74, 366, 64, 2, 'estado'))
    c.append('<text x="26" y="104" class="d">Z 0.0 mm</text>')
    c.append('<text x="26" y="122" class="s">POSIÇÃO SÓ SE A MÁQUINA A DER</text>')
    c.append(estado(290, 92, 'OCIOSA', 74))

    c.append(bloco(12, 150, 366, 118, 3, 'eixo Z'))
    c.append(botao(30, 178, 104, 56, 'Z +'))
    c.append(botao(143, 178, 104, 56, 'Z −'))
    c.append(botao(256, 178, 104, 56, 'HOME Z'))
    c.append('<text x="30" y="252" class="s">PASSO: 0.1 / 1 / 10 MM (DEPENDE DE 401)</text>')

    c.append(bloco(12, 280, 366, 92, 4, 'luz / ecrã'))
    c.append('<text x="26" y="312" class="d">Segunda luz (se a máquina a tiver)</text>')
    c.append('<rect x="300" y="296" width="60" height="28" rx="14" fill="#e6e6e6" stroke="#555"/>')
    c.append('<circle cx="344" cy="310" r="11" fill="#fff" stroke="#555"/>')

    c.append(bloco(12, 384, 366, 120, 5, 'não suportado'))
    c.append('<text x="26" y="416" class="d">Movimento X/Y: sem comando verificado</text>')
    c.append('<text x="26" y="438" class="d">Ventoinhas e velocidade: depende de 403</text>')
    c.append('<text x="26" y="460" class="d">Aquecimento: não existe na resina</text>')
    c.append(nota(26, 470, 'mostrado, mas desativado com motivo', 338))

    c.append(bloco(12, 516, 366, 64, 6, 'aviso de segurança'))
    c.append('<text x="26" y="548" class="d">Nenhum controlo inicia exposição UV.</text>')
    c.append('<text x="26" y="568" class="s">MOVIMENTO SÓ COM A MÁQUINA OCIOSA</text>')

    c.append(nota(12, 596, 'rodapé: a Saturn só mostra o que existe', 366))
    return svg(W_TEL, H_TEL, '\n'.join(c), 'Controlos — Saturn')


# ---------------------------------------------------------------- diálogo home

def confirmacao():
    c = []
    c.append(f'<rect width="{W_TEL}" height="{H_TEL}" fill="#f2f2f2"/>')
    c.append('<rect x="0" y="0" width="390" height="844" fill="#000" opacity="0.18"/>')
    c.append(bloco(24, 250, 342, 268, 1, 'diálogo de confirmação'))
    c.append('<text x="44" y="300" class="t">Levar à origem?</text>')
    c.append('<text x="44" y="326" class="d">Verifica que a mesa e o bico estão livres.</text>')
    c.append('<text x="44" y="346" class="d">Os eixos vão mover-se até aos fins de curso.</text>')
    c.append('<rect x="44" y="364" width="302" height="56" rx="8" fill="#fafafa" stroke="#888" stroke-dasharray="4 4"/>')
    c.append('<text x="56" y="388" class="s">AÇÃO</text>')
    c.append('<text x="56" y="406" class="d">Home XYZ · Cmd 402 Axis=XYZ</text>')
    c.append(botao(44, 444, 140, 48, 'Cancelar'))
    c.append(botao(196, 444, 150, 48, 'Mover para origem', forte=True))
    c.append('<text x="44" y="510" class="s">A IMPRIMIR / EM PAUSA / SEM LIGAÇÃO → BOTÃO DESATIVADO</text>')
    return svg(W_TEL, H_TEL, '\n'.join(c), 'Controlos — confirmação de Home')


# ---------------------------------------------------------------- estados

def estados():
    c = []
    c.append(f'<rect width="{W_TAB}" height="{H_TAB}" fill="#fbfbfb"/>')
    c.append('<text x="24" y="34" class="t">Estados: o que fica ativo</text>')
    colunas = [
        ('OCIOSA', ['movimento', 'Home', 'luz', 'ventoinhas', 'velocidade', 'temperatura']),
        ('A IMPRIMIR', ['luz', 'ventoinhas', 'velocidade']),
        ('EM PAUSA', ['luz', 'ventoinhas', 'velocidade']),
        ('SEM LIGAÇÃO', ['nada']),
    ]
    x = 24
    for i, (titulo, ativos) in enumerate(colunas):
        c.append(bloco(x, 60, 270, 300, i + 1, titulo.lower()))
        y = 96
        for controlo in ['movimento', 'Home', 'luz', 'ventoinhas', 'velocidade', 'temperatura']:
            ativo = controlo in ativos
            c.append(f'<text x="{x + 16}" y="{y}" class="d">{controlo}</text>')
            c.append(estado(x + 150, y - 12, 'ATIVO' if ativo else 'BLOQUEADO', 96))
            y += 38
        c.append(nota(x + 16, y, 'motivo visível no ecrã', 238))
        x += 286

    c.append(bloco(24, 386, 556, 150, 5, 'estado antigo (>45 s)'))
    c.append('<text x="44" y="424" class="d">Tudo desativado até chegar estado novo.</text>')
    c.append('<text x="44" y="446" class="d">Mostra quando foi a última atualização.</text>')
    c.append(nota(44, 470, 'sem estado → sem posição, sem botões', 500))

    c.append(bloco(600, 386, 556, 150, 6, 'comando em curso'))
    c.append('<text x="620" y="424" class="d">Um toque = um comando. Enquanto não há Ack,</text>')
    c.append('<text x="620" y="446" class="d">o bloco do movimento fica desativado.</text>')
    c.append('<text x="620" y="472" class="s">ACK OK · ACK RECUSADO · TIMEOUT</text>')

    c.append(bloco(24, 556, 1132, 130, 7, 'resultado e erros'))
    c.append('<text x="44" y="594" class="d">OK: discreto, desaparece. Erro: fica com motivo até novo comando.</text>')
    c.append('<text x="44" y="618" class="d">Ack 3 = precisa de Home. Timeout = não repetir sozinho.</text>')
    c.append(nota(44, 636, 'anúncio para leitores de ecrã, sem bloquear o ecrã', 1060))
    return svg(W_TAB, H_TAB, '\n'.join(c), 'Controlos — estados de bloqueio')


def exportar(nome, conteudo, largura, altura):
    svg_path = DESTINO / f'{nome}.svg'
    svg_path.write_text(conteudo, encoding='utf-8')
    subprocess.run(
        [
            CHROME,
            '--headless',
            '--disable-gpu',
            '--hide-scrollbars',
            f'--window-size={largura},{altura}',
            f'--screenshot={DESTINO / (nome + ".png")}',
            f'file://{svg_path.resolve()}',
        ],
        check=True,
        capture_output=True,
    )
    print('ok', nome)


if __name__ == '__main__':
    exportar('wireframe-tablet', tablet(), W_TAB, H_TAB)
    exportar('wireframe-telemovel', telemovel(), W_TEL, H_TEL)
    exportar('wireframe-saturn', saturn(), W_TEL, H_TEL)
    exportar('wireframe-home-confirmacao', confirmacao(), W_TEL, H_TEL)
    exportar('wireframe-estados', estados(), W_TAB, H_TAB)

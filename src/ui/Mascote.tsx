import React from 'react';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Mask,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

export type PoseMascote =
  | 'ocioso'
  | 'imprimindo'
  | 'semLigacao'
  | 'concluido'
  | 'foraDeCasa';

interface Props {
  pose: PoseMascote;
  /** Lado do quadrado, em dp. Predefinido: 160. */
  tamanho?: number;
}

/**
 * Mascote do Ataláia (polvo). Só para estados vazios, de erro, de espera e de sucesso.
 * É decorativo: o texto ao lado diz o que se passa, por isso fica escondido dos leitores de ecrã.
 */
export function Mascote({ pose, tamanho = 160 }: Props) {
  return (
    <Svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 200 200"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {conteudo(pose)}
    </Svg>
  );
}

function conteudo(pose: PoseMascote) {
  switch (pose) {
    case 'ocioso':
      return (
        <>
          <Defs>
            <LinearGradient id="ogoci" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#86EFAC" />
              <Stop offset="0.55" stopColor="#4ADE80" />
              <Stop offset="1" stopColor="#22C55E" />
            </LinearGradient>
            <LinearGradient id="twoci" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#EDE9FE" />
              <Stop offset="1" stopColor="#8B5CF6" />
            </LinearGradient>
            <Mask id="hmoci">
              <Rect width="200" height="200" fill="#fff" />
              <Rect x="0" y="44" width="200" height="3.4" fill="#000" />
              <Rect x="0" y="54" width="200" height="3.4" fill="#000" />
              <Rect x="0" y="64" width="200" height="3.4" fill="#000" />
            </Mask>
          </Defs>
          <Path
            d="M 64 106 C 36 112 26 140 42 154 C 50 160 60 154 56 146"
            fill="none"
            stroke="url(#ogoci)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Path
            d="M 80 114 C 64 136 66 160 82 168"
            fill="none"
            stroke="url(#ogoci)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Path
            d="M 94 118 C 90 140 92 158 100 166"
            fill="none"
            stroke="url(#ogoci)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Path
            d="M 106 118 C 110 140 110 158 118 164"
            fill="none"
            stroke="url(#ogoci)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Path
            d="M 120 114 C 136 136 134 160 118 168"
            fill="none"
            stroke="url(#ogoci)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Path
            d="M 136 106 C 164 112 174 140 158 154 C 150 160 140 154 144 146"
            fill="none"
            stroke="url(#ogoci)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Ellipse cx="100" cy="80" rx="48" ry="46" fill="url(#ogoci)" />
          <Ellipse
            cx="80"
            cy="58"
            rx="14"
            ry="7"
            fill="#FFFFFF"
            fillOpacity="0.22"
            transform="rotate(-25 80 58)"
          />
          <Circle cx="68" cy="96" r="6" fill="#F87171" fillOpacity="0.35" />
          <Circle cx="132" cy="96" r="6" fill="#F87171" fillOpacity="0.35" />
          <Circle cx="82" cy="80" r="11.5" fill="#FFFFFF" />
          <Circle cx="82" cy="80" r="6" fill="#141226" />
          <Circle cx="80.2" cy="78.2" r="1.9" fill="#FFFFFF" />
          <Circle cx="118" cy="80" r="11.5" fill="#FFFFFF" />
          <Circle cx="118" cy="80" r="6" fill="#141226" />
          <Circle cx="116.2" cy="78.2" r="1.9" fill="#FFFFFF" />
          <Path
            d="M 91 98 Q 100 106 109 98"
            fill="none"
            stroke="#141226"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <Circle
            cx="164"
            cy="48"
            r="22"
            fill="none"
            stroke="#8B5CF6"
            strokeWidth="3.5"
            strokeDasharray="6 5"
          />
          <Path
            d="M 164 38 V 58 M 154 48 H 174"
            stroke="#8B5CF6"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        </>
      );
    case 'imprimindo':
      return (
        <>
          <Defs>
            <LinearGradient id="ogimp" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#86EFAC" />
              <Stop offset="0.55" stopColor="#4ADE80" />
              <Stop offset="1" stopColor="#22C55E" />
            </LinearGradient>
            <LinearGradient id="twimp" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#EDE9FE" />
              <Stop offset="1" stopColor="#8B5CF6" />
            </LinearGradient>
            <Mask id="hmimp">
              <Rect width="200" height="200" fill="#fff" />
              <Rect x="0" y="44" width="200" height="3.4" fill="#000" />
              <Rect x="0" y="54" width="200" height="3.4" fill="#000" />
              <Rect x="0" y="64" width="200" height="3.4" fill="#000" />
            </Mask>
          </Defs>
          <Path
            d="M 64 106 C 36 112 26 140 42 154 C 50 160 60 154 56 146"
            fill="none"
            stroke="url(#ogimp)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Path
            d="M 80 114 C 64 136 66 160 82 168"
            fill="none"
            stroke="url(#ogimp)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Path
            d="M 94 118 C 90 140 92 158 100 166"
            fill="none"
            stroke="url(#ogimp)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Path
            d="M 106 118 C 110 140 110 158 118 164"
            fill="none"
            stroke="url(#ogimp)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Path
            d="M 120 114 C 136 136 134 160 118 168"
            fill="none"
            stroke="url(#ogimp)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Path
            d="M 136 106 C 164 112 174 140 158 154 C 150 160 140 154 144 146"
            fill="none"
            stroke="url(#ogimp)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <G mask="url(#hmimp)">
            <Ellipse cx="100" cy="80" rx="48" ry="46" fill="url(#ogimp)" />
          </G>
          <Ellipse
            cx="80"
            cy="58"
            rx="14"
            ry="7"
            fill="#FFFFFF"
            fillOpacity="0.22"
            transform="rotate(-25 80 58)"
          />
          <Circle cx="68" cy="96" r="6" fill="#F87171" fillOpacity="0.35" />
          <Circle cx="132" cy="96" r="6" fill="#F87171" fillOpacity="0.35" />
          <Circle cx="82" cy="80" r="11.5" fill="#FFFFFF" />
          <Circle cx="86" cy="83" r="6" fill="#141226" />
          <Circle cx="84.2" cy="81.2" r="1.9" fill="#FFFFFF" />
          <Circle cx="118" cy="80" r="11.5" fill="#FFFFFF" />
          <Circle cx="122" cy="83" r="6" fill="#141226" />
          <Circle cx="120.2" cy="81.2" r="1.9" fill="#FFFFFF" />
          <Path
            d="M 93 100 H 107"
            fill="none"
            stroke="#141226"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <Rect
            x="161.0"
            y="152"
            width="30"
            height="8"
            rx="4"
            fill="url(#twimp)"
          />
          <Rect
            x="163.5"
            y="141"
            width="25"
            height="8"
            rx="4"
            fill="url(#twimp)"
          />
          <Rect
            x="166.0"
            y="130"
            width="20"
            height="8"
            rx="4"
            fill="url(#twimp)"
          />
          <Rect
            x="168.5"
            y="119"
            width="15"
            height="8"
            rx="4"
            fill="url(#twimp)"
          />
          <Circle cx="176" cy="100" r="13" fill="#4ADE80" fillOpacity="0.22" />
          <Circle cx="176" cy="100" r="6" fill="#4ADE80" />
        </>
      );
    case 'semLigacao':
      return (
        <>
          <Defs>
            <LinearGradient id="ogsem" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#86EFAC" />
              <Stop offset="0.55" stopColor="#4ADE80" />
              <Stop offset="1" stopColor="#22C55E" />
            </LinearGradient>
            <LinearGradient id="twsem" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#EDE9FE" />
              <Stop offset="1" stopColor="#8B5CF6" />
            </LinearGradient>
            <Mask id="hmsem">
              <Rect width="200" height="200" fill="#fff" />
              <Rect x="0" y="44" width="200" height="3.4" fill="#000" />
              <Rect x="0" y="54" width="200" height="3.4" fill="#000" />
              <Rect x="0" y="64" width="200" height="3.4" fill="#000" />
            </Mask>
          </Defs>
          <Path
            d="M 64 106 C 36 112 26 140 42 154 C 50 160 60 154 56 146"
            fill="none"
            stroke="url(#ogsem)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Path
            d="M 80 114 C 64 136 66 160 82 168"
            fill="none"
            stroke="url(#ogsem)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Path
            d="M 94 118 C 90 140 92 158 100 166"
            fill="none"
            stroke="url(#ogsem)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Path
            d="M 106 118 C 110 140 110 158 118 164"
            fill="none"
            stroke="url(#ogsem)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Path
            d="M 120 114 C 136 136 134 160 118 168"
            fill="none"
            stroke="url(#ogsem)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Path
            d="M 136 106 C 164 112 174 140 158 154 C 150 160 140 154 144 146"
            fill="none"
            stroke="url(#ogsem)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Ellipse cx="100" cy="80" rx="48" ry="46" fill="url(#ogsem)" />
          <Ellipse
            cx="80"
            cy="58"
            rx="14"
            ry="7"
            fill="#FFFFFF"
            fillOpacity="0.22"
            transform="rotate(-25 80 58)"
          />
          <Circle cx="68" cy="96" r="6" fill="#F87171" fillOpacity="0.35" />
          <Circle cx="132" cy="96" r="6" fill="#F87171" fillOpacity="0.35" />
          <Circle cx="82" cy="80" r="11.5" fill="#FFFFFF" />
          <Circle cx="80" cy="83" r="6" fill="#141226" />
          <Circle cx="78.2" cy="81.2" r="1.9" fill="#FFFFFF" />
          <Circle cx="118" cy="80" r="11.5" fill="#FFFFFF" />
          <Circle cx="116" cy="83" r="6" fill="#141226" />
          <Circle cx="114.2" cy="81.2" r="1.9" fill="#FFFFFF" />
          <Path
            d="M 92 103 Q 100 96 108 103"
            fill="none"
            stroke="#141226"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <Path
            d="M 66 70 L 90 62 M 134 70 L 110 62"
            stroke="#141226"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <Path
            d="M 142 40 A 28 28 0 0 1 182 40 M 150 49 A 16 16 0 0 1 174 49"
            fill="none"
            stroke="#F87171"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <Circle cx="162" cy="58" r="3.8" fill="#F87171" />
          <Path
            d="M 140 28 L 184 70"
            stroke="#F87171"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </>
      );
    case 'concluido':
      return (
        <>
          <Defs>
            <LinearGradient id="ogcon" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#86EFAC" />
              <Stop offset="0.55" stopColor="#4ADE80" />
              <Stop offset="1" stopColor="#22C55E" />
            </LinearGradient>
            <LinearGradient id="twcon" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#EDE9FE" />
              <Stop offset="1" stopColor="#8B5CF6" />
            </LinearGradient>
            <Mask id="hmcon">
              <Rect width="200" height="200" fill="#fff" />
              <Rect x="0" y="44" width="200" height="3.4" fill="#000" />
              <Rect x="0" y="54" width="200" height="3.4" fill="#000" />
              <Rect x="0" y="64" width="200" height="3.4" fill="#000" />
            </Mask>
          </Defs>
          <Path
            d="M 64 106 C 36 112 26 140 42 154 C 50 160 60 154 56 146"
            fill="none"
            stroke="url(#ogcon)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Path
            d="M 80 114 C 64 136 66 160 82 168"
            fill="none"
            stroke="url(#ogcon)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Path
            d="M 94 118 C 90 140 92 158 100 166"
            fill="none"
            stroke="url(#ogcon)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Path
            d="M 106 118 C 110 140 110 158 118 164"
            fill="none"
            stroke="url(#ogcon)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Path
            d="M 120 114 C 136 136 134 160 118 168"
            fill="none"
            stroke="url(#ogcon)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Path
            d="M 136 106 C 164 112 174 140 158 154 C 150 160 140 154 144 146"
            fill="none"
            stroke="url(#ogcon)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Ellipse cx="100" cy="80" rx="48" ry="46" fill="url(#ogcon)" />
          <Ellipse
            cx="80"
            cy="58"
            rx="14"
            ry="7"
            fill="#FFFFFF"
            fillOpacity="0.22"
            transform="rotate(-25 80 58)"
          />
          <Circle cx="68" cy="96" r="6" fill="#F87171" fillOpacity="0.35" />
          <Circle cx="132" cy="96" r="6" fill="#F87171" fillOpacity="0.35" />
          <Path
            d="M 72 82 Q 82 68 92 82"
            fill="none"
            stroke="#141226"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <Path
            d="M 108 82 Q 118 68 128 82"
            fill="none"
            stroke="#141226"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <Path
            d="M 88 95 Q 100 112 112 95 Z"
            fill="#141226"
            stroke="#141226"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <Path
            d="M 94 103 Q 100 108 106 103 Q 100 100 94 103 Z"
            fill="#F87171"
          />
          <Circle cx="30" cy="40" r="5" fill="#8B5CF6" />
          <Circle cx="172" cy="32" r="5" fill="#FBBF24" />
          <Circle cx="22" cy="102" r="4" fill="#F87171" />
          <Circle cx="178" cy="100" r="4" fill="#8B5CF6" />
          <Circle cx="44" cy="18" r="3.5" fill="#FBBF24" />
          <Rect
            x="150"
            y="14"
            width="9"
            height="9"
            rx="2"
            fill="#F87171"
            transform="rotate(25 154 18)"
          />
          <Rect
            x="14"
            y="62"
            width="9"
            height="9"
            rx="2"
            fill="#FBBF24"
            transform="rotate(-20 18 66)"
          />
          <Circle cx="166" cy="148" r="20" fill="#8B5CF6" />
          <Path
            d="M 156 148 L 163 155 L 177 141"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    case 'foraDeCasa':
      return (
        <>
          <Defs>
            <LinearGradient id="ogfor" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#86EFAC" />
              <Stop offset="0.55" stopColor="#4ADE80" />
              <Stop offset="1" stopColor="#22C55E" />
            </LinearGradient>
            <LinearGradient id="twfor" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#EDE9FE" />
              <Stop offset="1" stopColor="#8B5CF6" />
            </LinearGradient>
            <Mask id="hmfor">
              <Rect width="200" height="200" fill="#fff" />
              <Rect x="0" y="44" width="200" height="3.4" fill="#000" />
              <Rect x="0" y="54" width="200" height="3.4" fill="#000" />
              <Rect x="0" y="64" width="200" height="3.4" fill="#000" />
            </Mask>
          </Defs>
          <Path
            d="M 64 106 C 36 112 26 140 42 154 C 50 160 60 154 56 146"
            fill="none"
            stroke="url(#ogfor)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Path
            d="M 80 114 C 64 136 66 160 82 168"
            fill="none"
            stroke="url(#ogfor)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Path
            d="M 94 118 C 90 140 92 158 100 166"
            fill="none"
            stroke="url(#ogfor)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Path
            d="M 106 118 C 110 140 110 158 118 164"
            fill="none"
            stroke="url(#ogfor)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Path
            d="M 120 114 C 136 136 134 160 118 168"
            fill="none"
            stroke="url(#ogfor)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Path
            d="M 136 106 C 164 112 174 140 158 154 C 150 160 140 154 144 146"
            fill="none"
            stroke="url(#ogfor)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <Ellipse cx="100" cy="80" rx="48" ry="46" fill="url(#ogfor)" />
          <Ellipse
            cx="80"
            cy="58"
            rx="14"
            ry="7"
            fill="#FFFFFF"
            fillOpacity="0.22"
            transform="rotate(-25 80 58)"
          />
          <Circle cx="68" cy="96" r="6" fill="#F87171" fillOpacity="0.35" />
          <Circle cx="132" cy="96" r="6" fill="#F87171" fillOpacity="0.35" />
          <Circle cx="82" cy="80" r="11.5" fill="#FFFFFF" />
          <Circle cx="86" cy="78" r="6" fill="#141226" />
          <Circle cx="84.2" cy="76.2" r="1.9" fill="#FFFFFF" />
          <Circle cx="118" cy="80" r="11.5" fill="#FFFFFF" />
          <Circle cx="122" cy="78" r="6" fill="#141226" />
          <Circle cx="120.2" cy="76.2" r="1.9" fill="#FFFFFF" />
          <Path
            d="M 93 100 H 107"
            fill="none"
            stroke="#141226"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <Circle cx="164" cy="50" r="24" fill="#8B5CF6" />
          <Path
            d="M 150 54 L 164 40 L 178 54 M 153 52 V 66 H 175 V 52"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
  }
}

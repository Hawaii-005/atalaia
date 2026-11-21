import fs from 'fs';
import path from 'path';
import { comparar, retratar } from '../src/utils/fatiador/comparar';

const FIXTURES = path.join(__dirname, 'fixtures');
const NOSSO = path.join(FIXTURES, 'atalaia_cubo25_6.gcode');

/** Referência do OrcaSlicer 2.5.1 (cubo 25,6 mm, 128 camadas, 12m27s). */
const ORCA = path.join(FIXTURES, 'ECC_0_4_Cubo_Generic_PLA__0_2_12m27s.gcode');

const ler = (p: string) => fs.readFileSync(p, 'utf8');

describe('retrato do G-code da app', () => {
  const r = retratar(ler(NOSSO));

  it('lê camadas, consumo, temperaturas e ferramenta do cabeçalho', () => {
    expect(r.camadas).toBe(128);
    expect(r.filamentMm).toBeCloseTo(2150.37, 1);
    expect(r.bico).toBe(210);
    expect(r.mesa).toBe(60);
    expect(r.material).toBe('PLA');
    expect(r.ferramenta).toBe(0);
  });

  it('não tem T soltos e exclui o objeto antes do PRINT_START', () => {
    expect(r.tSoltos).toBe(0);
    expect(r.excludeAntes).toBe(true);
  });

  it('compara-se consigo mesmo sem diferenças', () => {
    const texto = ler(NOSSO);
    expect(comparar(texto, texto).igual).toBe(true);
  });

  it('deteta camadas e temperaturas diferentes', () => {
    const texto = ler(NOSSO);
    const alterado = texto
      .replace('total layer number: 128', 'total layer number: 100')
      .replace(
        'PRINT_START EXTRUDER=210 BED=60',
        'PRINT_START EXTRUDER=215 BED=65'
      );
    const d = comparar(texto, alterado).diferencas;
    expect(d).toEqual(
      expect.arrayContaining(['camadas: 128 vs 100', 'bico: 210 vs 215 °C'])
    );
  });
});

/**
 * Ativa-se quando a referência estiver em tests/fixtures/ (nome exato acima).
 * Sem ela o teste fica em «skip» com o motivo visível, em vez de passar à
 * socapa.
 */
const temOrca = fs.existsSync(ORCA);

(temOrca ? describe : describe.skip)('paridade com o OrcaSlicer 2.5.1', () => {
  it('mesma geometria, temperaturas, arranque e exclusão de objeto', () => {
    const { diferencas } = comparar(ler(ORCA), ler(NOSSO));
    expect(diferencas).toEqual([]);
  });
});

if (!temOrca) {
  test.skip('referência do OrcaSlicer em falta', () => {
    // Copiar ECC_0_4_Cubo_Generic_PLA__0_2_12m27s.gcode para tests/fixtures/.
  });
}

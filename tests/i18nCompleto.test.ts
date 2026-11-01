import pt from '../src/i18n/pt';
import en from '../src/i18n/en';

describe('i18n PT/EN', () => {
  const chavesPt = Object.keys(pt).sort();
  const chavesEn = Object.keys(en).sort();

  it('tem exatamente as mesmas chaves nos dois idiomas', () => {
    const faltamEmEn = chavesPt.filter(k => !(k in en));
    const faltamEmPt = chavesEn.filter(k => !(k in pt));
    expect({ faltamEmEn, faltamEmPt }).toEqual({
      faltamEmEn: [],
      faltamEmPt: [],
    });
  });

  it('não tem textos vazios', () => {
    const vazias = [...chavesPt, ...chavesEn].filter(
      k =>
        (pt as Record<string, string>)[k]?.trim() === '' ||
        (en as Record<string, string>)[k]?.trim() === ''
    );
    expect(vazias).toEqual([]);
  });

  it('as chaves dos controlos existem nos dois idiomas', () => {
    const controlos = chavesPt.filter(k => k.startsWith('controlos.'));
    expect(controlos.length).toBeGreaterThan(40);
    controlos.forEach(k => expect(k in en).toBe(true));
  });
});

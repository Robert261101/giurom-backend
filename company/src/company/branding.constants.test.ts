import { describe, expect, it } from '@jest/globals';
import {
  BRANDING_COLOR_KEYS,
  DEFAULT_PALETTE,
  isHexColor,
  normalizeHexColor,
  resolvePalette,
} from './branding.constants';

describe('isHexColor', () => {
  it('accepta #rgb, #rrggbb si #rrggbbaa', () => {
    expect(isHexColor('#fff')).toBe(true);
    expect(isHexColor('#3F8CFF')).toBe(true);
    expect(isHexColor('#3f8cff80')).toBe(true);
  });

  it('respinge orice alta sintaxa CSS', () => {
    // Valoarea ajunge intr-un <style> injectat in pagina: `rgb()`, `var()` sau un nume
    // de culoare ar deschide usa catre CSS arbitrar.
    expect(isHexColor('rgb(63, 140, 255)')).toBe(false);
    expect(isHexColor('red')).toBe(false);
    expect(isHexColor('oklch(0.6 0.2 250)')).toBe(false);
    expect(isHexColor('#fff; background: url(x)')).toBe(false);
    expect(isHexColor('')).toBe(false);
    expect(isHexColor(null)).toBe(false);
    expect(isHexColor(123)).toBe(false);
  });
});

describe('normalizeHexColor', () => {
  it('normalizeaza la majuscule si taie spatiile', () => {
    expect(normalizeHexColor('  #3f8cff ')).toBe('#3F8CFF');
  });

  it('intoarce null pentru valori invalide', () => {
    expect(normalizeHexColor('albastru')).toBeNull();
    expect(normalizeHexColor(undefined)).toBeNull();
  });
});

describe('resolvePalette', () => {
  it('fara nimic configurat, intoarce exact implicitele din cod', () => {
    expect(resolvePalette(null, null)).toEqual(DEFAULT_PALETTE);
  });

  it('firma bate platforma, platforma bate implicitul', () => {
    const palette = resolvePalette(
      { color_primary: '#111111' },
      { color_primary: '#222222', color_page_bg: '#333333' },
    );
    expect(palette.color_primary).toBe('#111111');
    expect(palette.color_page_bg).toBe('#333333');
    expect(palette.color_text).toBe(DEFAULT_PALETTE.color_text);
  });

  it('rezolva culoare cu culoare, nu rand cu rand', () => {
    // O firma care si-a schimbat doar culoarea principala trebuie sa mosteneasca restul
    // de la platforma — nu sa sara peste ea fiindca are un rand propriu.
    const palette = resolvePalette(
      { color_primary: '#111111', color_page_bg: null },
      { color_page_bg: '#333333' },
    );
    expect(palette.color_page_bg).toBe('#333333');
  });

  it('ignora valorile invalide ramase in baza si cade pe urmatorul nivel', () => {
    const palette = resolvePalette(
      { color_primary: 'javascript:alert(1)' },
      { color_primary: '#222222' },
    );
    expect(palette.color_primary).toBe('#222222');
  });

  it('intoarce o valoare pentru fiecare cheie a paletei', () => {
    const palette = resolvePalette({}, {});
    for (const key of BRANDING_COLOR_KEYS) {
      expect(palette[key]).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});

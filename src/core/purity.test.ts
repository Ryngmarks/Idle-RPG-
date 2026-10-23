// Guards the architecture rule: the core must not depend on UI, DOM, wall-clock time or randomness.
import { describe, expect, it } from 'vitest';

const sources = (import.meta as unknown as {
  glob: (pattern: string, opts: { query: string; import: string; eager: true }) => Record<string, string>;
}).glob('./*.ts', { query: '?raw', import: 'default', eager: true });

const FORBIDDEN = [/from ['"]react/, /\bwindow\./, /\bdocument\./, /\blocalStorage\b/, /Date\.now\(/, /new Date\(/, /Math\.random\(/];

describe('core purity', () => {
  const files = Object.entries(sources).filter(([path]) => !path.endsWith('.test.ts'));

  it('finds the core sources', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const [path, code] of files) {
    it(`${path} has no forbidden dependencies`, () => {
      for (const pattern of FORBIDDEN) expect(code, `${path} matches ${pattern}`).not.toMatch(pattern);
    });
  }
});

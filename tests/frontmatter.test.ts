import { describe, it, expect } from 'vitest';
import { parseFrontmatter, normalizeAuthor } from '../src/frontmatter.js';

describe('parseFrontmatter', () => {
  it('extracts YAML frontmatter and body from markdown source', () => {
    const src = `---\ntitle: Hello\nweek: 1\n---\n\nbody text\n`;
    const { data, content } = parseFrontmatter(src);
    expect(data.title).toBe('Hello');
    expect(data.week).toBe(1);
    expect(content.trim()).toBe('body text');
  });

  it('returns empty data when no frontmatter is present', () => {
    const { data, content } = parseFrontmatter('just body\n');
    expect(data).toEqual({});
    expect(content).toBe('just body\n');
  });
});

describe('normalizeAuthor', () => {
  it('preserves explicit author when set', () => {
    expect(normalizeAuthor({ author: 'Jane Doe', unit: 'A', curriculum: 'B' }))
      .toBe('Jane Doe');
  });

  it('joins unit and curriculum with " · " when both present and author missing', () => {
    expect(normalizeAuthor({ unit: 'Genesis', curriculum: 'High School' }))
      .toBe('Genesis · High School');
  });

  it('uses unit alone when only unit set', () => {
    expect(normalizeAuthor({ unit: 'Genesis' })).toBe('Genesis');
  });

  it('uses curriculum alone when only curriculum set', () => {
    expect(normalizeAuthor({ curriculum: 'High School' })).toBe('High School');
  });

  it('returns undefined when no author/unit/curriculum present', () => {
    expect(normalizeAuthor({ title: 'x' })).toBeUndefined();
  });
});

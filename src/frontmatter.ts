import matter from 'gray-matter';

export type Frontmatter = Record<string, unknown>;

export function parseFrontmatter(source: string): {
  data: Frontmatter;
  content: string;
} {
  const parsed = matter(source);
  return { data: parsed.data, content: parsed.content };
}

export function normalizeAuthor(data: Frontmatter): string | undefined {
  if (typeof data.author === 'string' && data.author.trim() !== '') {
    return data.author;
  }
  const unit = typeof data.unit === 'string' ? data.unit : undefined;
  const curriculum =
    typeof data.curriculum === 'string' ? data.curriculum : undefined;

  if (unit && curriculum) return `${unit} · ${curriculum}`;
  if (unit) return unit;
  if (curriculum) return curriculum;
  return undefined;
}

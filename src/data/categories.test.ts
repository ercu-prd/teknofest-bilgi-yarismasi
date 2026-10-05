import { CATEGORY_OPTIONS, categoryLabel } from './categories';

describe('categories', () => {
  it('veritabanı kodlarını sırasıyla listeler', () => {
    expect(CATEGORY_OPTIONS.map((c) => c.value)).toEqual(['teknoloji', 'bilim', 'genel', 'mantık']);
  });

  it('bilinen kodlar için Türkçe etiket döndürür', () => {
    expect(categoryLabel('teknoloji')).toBe('Teknoloji');
    expect(categoryLabel('bilim')).toBe('Bilim');
    expect(categoryLabel('genel')).toBe('Genel Kültür');
    expect(categoryLabel('mantık')).toBe('Mantık');
  });

  it('bilinmeyen kodun baş harfini büyütür', () => {
    expect(categoryLabel('tarih')).toBe('Tarih');
    expect(categoryLabel('ilginç')).toBe('İlginç');
    expect(categoryLabel('')).toBe('');
  });
});

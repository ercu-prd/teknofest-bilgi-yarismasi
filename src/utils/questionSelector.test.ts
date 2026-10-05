import { generateMatchQuestions } from './questionSelector';
import { QUESTION_BANK } from '../data/questionBank';

describe('generateMatchQuestions', () => {
  it('varsayılan olarak 10 benzersiz soru üretir', () => {
    const qs = generateMatchQuestions('123456');
    expect(qs).toHaveLength(10);
    expect(new Set(qs.map((q) => q.id)).size).toBe(10);
  });

  it('aynı oda kodu için birebir aynı sırayı ve şıkları üretir', () => {
    expect(generateMatchQuestions('482913')).toEqual(generateMatchQuestions('482913'));
  });

  it('oda kodu büyük/küçük harf duyarsızdır', () => {
    expect(generateMatchQuestions('abcdef')).toEqual(generateMatchQuestions('ABCDEF'));
  });

  it('farklı oda kodları farklı setler üretir', () => {
    const a = generateMatchQuestions('111111').map((q) => q.id);
    const b = generateMatchQuestions('222222').map((q) => q.id);
    expect(a).not.toEqual(b);
  });

  it('şıklar karıştırıldıktan sonra correctIndex hâlâ doğru cevabı gösterir', () => {
    for (const code of ['000001', '555555', '999999', 'teknofest']) {
      for (const q of generateMatchQuestions(code)) {
        const original = QUESTION_BANK.find((b) => b.id === q.id)!;
        expect(q.options[q.correctIndex!]).toBe(original.options[original.correctIndex]);
        expect([...q.options].sort()).toEqual([...original.options].sort());
      }
    }
  });

  it('her kategoriden en az bir soru içerir', () => {
    const cats = new Set(generateMatchQuestions('314159').map((q) => q.category));
    expect(cats).toEqual(new Set(['Teknoloji', 'Bilim', 'Genel Kültür', 'Mantık']));
  });

  it('count parametresine uyar', () => {
    expect(generateMatchQuestions('123456', 5)).toHaveLength(5);
    expect(generateMatchQuestions('123456', 15)).toHaveLength(15);
  });
});

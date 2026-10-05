import { getClockOffset, serverNow, setClockOffset, syncServerClock } from './serverClock';

afterEach(() => setClockOffset(0));

describe('serverClock', () => {
  it('serverNow yerel saate ofseti ekler', () => {
    setClockOffset(5000);
    expect(serverNow() - Date.now()).toBeGreaterThanOrEqual(4990);
  });

  it('sunucu saatine göre ofseti hesaplar', async () => {
    const offset = await syncServerClock(async () => new Date(Date.now() + 10_000).toISOString(), 2);
    expect(offset).not.toBeNull();
    expect(Math.abs(getClockOffset() - 10_000)).toBeLessThan(200);
  });

  it('tüm denemeler başarısızsa ofseti değiştirmez', async () => {
    setClockOffset(123);
    const offset = await syncServerClock(async () => {
      throw new Error('ağ hatası');
    });
    expect(offset).toBeNull();
    expect(getClockOffset()).toBe(123);
  });

  it('geçersiz zaman damgalarını yok sayar', async () => {
    expect(await syncServerClock(async () => 'bozuk-tarih', 1)).toBeNull();
  });
});

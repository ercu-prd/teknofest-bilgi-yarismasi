import {
  buildRoomLink,
  buildTournamentLink,
  clearRoomCodeFromUrl,
  clearTournamentCodeFromUrl,
  readRoomCodeFromUrl,
  readTournamentCodeFromUrl,
} from './roomLink';

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('buildRoomLink / buildTournamentLink', () => {
  it('verilen origin’e room parametresi ekler', () => {
    expect(buildRoomLink('123456', 'https://ornek.app/arena/')).toBe('https://ornek.app/arena/?room=123456');
  });

  it('varsayılan olarak mevcut origin + pathname kullanır, eski query’yi atar', () => {
    window.history.replaceState(null, '', '/oyun/?foo=1#x');
    expect(buildRoomLink('654321')).toBe(`${window.location.origin}/oyun/?room=654321`);
  });

  it('turnuva linki tournament parametresi kullanır', () => {
    expect(buildTournamentLink('111222', 'https://ornek.app/')).toBe('https://ornek.app/?tournament=111222');
  });
});

describe('readRoomCodeFromUrl / readTournamentCodeFromUrl', () => {
  it('6 haneli sayısal kodu okur', () => {
    expect(readRoomCodeFromUrl('?room=123456')).toBe('123456');
    expect(readRoomCodeFromUrl('?a=b&room=000001')).toBe('000001');
    expect(readTournamentCodeFromUrl('?tournament=987654')).toBe('987654');
  });

  it('geçersiz kodları reddeder', () => {
    for (const s of ['', '?room=', '?room=12345', '?room=1234567', '?room=12a456', '?room=abcdef', '?other=123456']) {
      expect(readRoomCodeFromUrl(s)).toBeNull();
    }
    expect(readTournamentCodeFromUrl('?room=123456')).toBeNull();
  });

  it('varsayılan olarak window.location.search okunur', () => {
    window.history.replaceState(null, '', '/?room=246810&tournament=135791');
    expect(readRoomCodeFromUrl()).toBe('246810');
    expect(readTournamentCodeFromUrl()).toBe('135791');
  });
});

describe('clearRoomCodeFromUrl / clearTournamentCodeFromUrl', () => {
  it('yalnızca room parametresini siler, diğerlerini ve hash’i korur', () => {
    window.history.replaceState(null, '', '/oyun?foo=1&room=123456&bar=2#ust');
    clearRoomCodeFromUrl();
    expect(window.location.pathname).toBe('/oyun');
    expect(window.location.search).toBe('?foo=1&bar=2');
    expect(window.location.hash).toBe('#ust');
  });

  it('tek parametre silinince soru işareti kalmaz', () => {
    window.history.replaceState(null, '', '/?tournament=123456');
    clearTournamentCodeFromUrl();
    expect(window.location.search).toBe('');
    expect(window.location.pathname).toBe('/');
  });

  it('parametre yoksa history’e dokunmaz', () => {
    window.history.replaceState(null, '', '/?foo=1');
    const spy = vi.spyOn(window.history, 'replaceState');
    clearRoomCodeFromUrl();
    expect(spy).not.toHaveBeenCalled();
  });
});

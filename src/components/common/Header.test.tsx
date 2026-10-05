import { render, screen } from '@testing-library/react';
import { ConnectionIndicator, Header } from './Header';

const game = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('../../context/GameContext', () => ({ useGame: () => game.value }));
vi.mock('../ui/SoundToggle', () => ({ SoundToggle: () => <button>ses</button> }));

describe('ConnectionIndicator', () => {
  it.each([
    ['connected', 'Bağlantı: Canlı'],
    ['reconnecting', 'Bağlantı: Yeniden bağlanıyor'],
    ['offline', 'Bağlantı: Çevrimdışı'],
    ['connecting', 'Bağlantı: Bağlanıyor'],
  ] as const)('%s durumunu gösterir', (status, label) => {
    render(<ConnectionIndicator status={status} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', label);
  });

  it('odada değilken (idle) hiçbir şey göstermez', () => {
    const { container } = render(<ConnectionIndicator status="idle" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Header', () => {
  it('lobide oda kodunu ve bağlantı durumunu gösterir', () => {
    game.value = { currentScreen: 'LOBBY', roomCode: '123456', connectionStatus: 'connected' };
    render(<Header />);
    expect(screen.getByText('Oda #123456')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Bağlantı: Canlı');
  });

  it.each([
    ['TOURNAMENT', 'Turnuva'],
    ['LEADERBOARD', 'Liderlik Tablosu'],
    ['MATCHMAKING', 'Rakip Aranıyor'],
    ['ADMIN', 'Yönetim'],
  ])('%s ekran başlığı', (screenName, title) => {
    game.value = { currentScreen: screenName, roomCode: '', connectionStatus: 'idle' };
    render(<Header />);
    expect(screen.getByText(title)).toBeInTheDocument();
  });
});

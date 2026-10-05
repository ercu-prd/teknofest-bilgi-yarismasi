import { render, screen } from '@testing-library/react';
import { Logo } from './Logo';
import { LogoSpinner, LogoSpinnerBlock } from './LogoSpinner';

describe('Logo', () => {
  it('varsayılan olarak dekoratiftir', () => {
    const { container } = render(<Logo />);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toContain('oku-teknofest-logo.jpg');
    expect(img).toHaveAttribute('aria-hidden', 'true');
  });

  it('etiket verilirse erişilebilir görsel olur', () => {
    render(<Logo label="OKÜ TEKNOFEST Kulübü" />);
    expect(screen.getByAltText('OKÜ TEKNOFEST Kulübü')).toBeInTheDocument();
  });
});

describe('LogoSpinner', () => {
  it('ekran okuyucuya durum bildirir', () => {
    render(<LogoSpinner label="Rakip aranıyor" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Rakip aranıyor');
  });

  it('blok görünüm ipucu metnini gösterir', () => {
    render(<LogoSpinnerBlock hint="Sorular hazırlanıyor" />);
    expect(screen.getByText('Sorular hazırlanıyor')).toBeInTheDocument();
  });
});

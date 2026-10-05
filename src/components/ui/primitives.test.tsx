import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Avatar } from './Avatar';
import { IconButton } from './IconButton';
import { Input } from './Input';
import { ProgressBar } from './ProgressBar';
import { Sheet } from './Sheet';

describe('Avatar', () => {
  it('dekoratif emoji gösterir', () => {
    const { container } = render(<Avatar emoji="🚀" tone="me" />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.firstElementChild).toHaveTextContent('🚀');
  });
});

describe('ProgressBar', () => {
  it('oranı yüzdeye çevirir ve sınırlar', () => {
    const { rerender } = render(<ProgressBar value={3} max={10} label="İlerleme" />);
    const bar = screen.getByRole('progressbar', { name: 'İlerleme' });
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar.firstElementChild).toHaveStyle({ width: '30%' });

    rerender(<ProgressBar value={99} max={10} label="İlerleme" />);
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '100%' });
    rerender(<ProgressBar value={-4} max={10} label="İlerleme" />);
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '0%' });
  });

  it('max sıfırsa çökmez', () => {
    render(<ProgressBar value={1} max={0} label="Boş" />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});

describe('IconButton', () => {
  it('erişilebilir ad taşır ve tıklanır', () => {
    const onClick = vi.fn();
    render(<IconButton label="Kodu kopyala" onClick={onClick}>x</IconButton>);
    fireEvent.click(screen.getByRole('button', { name: 'Kodu kopyala' }));
    expect(onClick).toHaveBeenCalled();
  });
});

describe('Input', () => {
  it('etiketi alana bağlar', () => {
    render(<Input label="Takma ad" />);
    expect(screen.getByLabelText('Takma ad')).toBeInTheDocument();
  });

  it('hata mesajını alanla ilişkilendirir', () => {
    render(<Input label="Oda kodu" error="Geçersiz kod" />);
    const input = screen.getByLabelText('Oda kodu');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Geçersiz kod');
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
  });

  it('etiket gizlenebilir ama ekran okuyucuda kalır', () => {
    render(<Input label="Ara" hideLabel />);
    expect(screen.getByText('Ara')).toHaveClass('sr-only');
  });
});

describe('Sheet', () => {
  const Harness = () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Aç</button>
        <Sheet open={open} onClose={() => setOpen(false)} title="Odaya katıl">
          <input aria-label="Kod" />
          <button>Katıl</button>
        </Sheet>
      </>
    );
  };

  it('kapalıyken hiçbir şey çizmez', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('açılınca ilk alana odaklanır ve başlığa bağlıdır', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('Aç'));
    expect(screen.getByRole('dialog', { name: 'Odaya katıl' })).toBeInTheDocument();
    expect(screen.getByLabelText('Kod')).toHaveFocus();
  });

  it('Escape ile kapanır ve odak açan butona döner', () => {
    render(<Harness />);
    const opener = screen.getByText('Aç');
    opener.focus();
    fireEvent.click(opener);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('Kapat butonu ve arka plana tıklama kapatır', () => {
    const { container } = render(<Harness />);
    fireEvent.click(screen.getByText('Aç'));
    fireEvent.click(screen.getByRole('button', { name: 'Kapat' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Aç'));
    fireEvent.click(container.querySelector('[aria-hidden="true"].absolute')!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Tab odağı pencere içinde tutar', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('Aç'));
    const close = screen.getByRole('button', { name: 'Kapat' });
    const join = screen.getByRole('button', { name: 'Katıl' });
    join.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(join).toHaveFocus();
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import { RoomQrCode } from './RoomQrCode';

const qr = vi.hoisted(() => ({ toDataURL: vi.fn() }));
vi.mock('qrcode', () => ({ default: qr }));

describe('RoomQrCode', () => {
  beforeEach(() => {
    qr.toDataURL.mockReset();
  });

  it('QR kodu data URL ile img olarak render eder', async () => {
    qr.toDataURL.mockResolvedValue('data:image/png;base64,AAA');
    render(<RoomQrCode url="https://ornek.app/?room=123456" size={160} />);

    const img = await screen.findByAltText('Odaya katılmak için QR kod');
    expect(img).toHaveAttribute('src', 'data:image/png;base64,AAA');
    expect(img).toHaveAttribute('width', '160');
    expect(qr.toDataURL).toHaveBeenCalledWith(
      'https://ornek.app/?room=123456',
      expect.objectContaining({ width: 160, color: { dark: '#000000', light: '#ffffff' } }),
    );
  });

  it('hata olursa hiçbir şey render etmez', async () => {
    qr.toDataURL.mockRejectedValue(new Error('too long'));
    const { container } = render(<RoomQrCode url="x" />);
    await waitFor(() => expect(qr.toDataURL).toHaveBeenCalled());
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
  });

  it('url değişince yeni QR üretir', async () => {
    qr.toDataURL.mockImplementation(async (url: string) => `data:image/png;base64,${url}`);
    const { rerender } = render(<RoomQrCode url="A" />);
    expect(await screen.findByAltText('Odaya katılmak için QR kod')).toHaveAttribute('src', 'data:image/png;base64,A');
    rerender(<RoomQrCode url="B" />);
    await waitFor(() =>
      expect(screen.getByAltText('Odaya katılmak için QR kod')).toHaveAttribute('src', 'data:image/png;base64,B'),
    );
  });
});

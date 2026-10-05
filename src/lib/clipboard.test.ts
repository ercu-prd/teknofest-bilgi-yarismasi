import { copyText, shareOrCopy } from './clipboard';

const setSecure = (value: boolean) =>
  Object.defineProperty(window, 'isSecureContext', { value, configurable: true });

const setClipboard = (writeText?: (t: string) => Promise<void>) =>
  Object.defineProperty(navigator, 'clipboard', {
    value: writeText ? { writeText } : undefined,
    configurable: true,
  });

const setShare = (share?: (d: ShareData) => Promise<void>) =>
  Object.defineProperty(navigator, 'share', { value: share, configurable: true });

const setExecCommand = (impl?: (cmd: string) => boolean) =>
  Object.defineProperty(document, 'execCommand', { value: impl, configurable: true, writable: true });

describe('copyText', () => {
  afterEach(() => {
    setSecure(false);
    setClipboard(undefined);
    setExecCommand(undefined);
  });

  it('güvenli bağlamda Clipboard API kullanır', async () => {
    setSecure(true);
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    const exec = vi.fn().mockReturnValue(true);
    setExecCommand(exec);

    await expect(copyText('123456')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('123456');
    expect(exec).not.toHaveBeenCalled();
  });

  it('güvenli olmayan bağlamda execCommand yedeğine düşer ve textarea bırakmaz', async () => {
    setSecure(false);
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    let copied = '';
    setExecCommand((cmd) => {
      copied = (document.activeElement as HTMLTextAreaElement).value;
      return cmd === 'copy';
    });

    await expect(copyText('abc')).resolves.toBe(true);
    expect(writeText).not.toHaveBeenCalled();
    expect(copied).toBe('abc');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('Clipboard API reddederse yedeği dener', async () => {
    setSecure(true);
    setClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    setExecCommand(() => true);
    await expect(copyText('x')).resolves.toBe(true);
  });

  it('hiçbir yöntem çalışmazsa false döner, throw etmez', async () => {
    setSecure(true);
    setClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    setExecCommand(() => {
      throw new Error('boom');
    });
    await expect(copyText('x')).resolves.toBe(false);
    expect(document.querySelector('textarea')).toBeNull();
  });
});

describe('shareOrCopy', () => {
  const data = { title: 'Oda', text: 'Katıl', url: 'https://ornek.app/?room=123456' };

  afterEach(() => {
    setShare(undefined);
    setSecure(false);
    setClipboard(undefined);
    setExecCommand(undefined);
  });

  it('navigator.share başarılıysa shared döner', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setShare(share);
    await expect(shareOrCopy(data)).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith(data);
  });

  it('kullanıcı iptal ederse (AbortError) failed döner ve kopyalamaz', async () => {
    setShare(vi.fn().mockRejectedValue(new DOMException('iptal', 'AbortError')));
    const exec = vi.fn().mockReturnValue(true);
    setExecCommand(exec);
    await expect(shareOrCopy(data)).resolves.toBe('failed');
    expect(exec).not.toHaveBeenCalled();
  });

  it('share yoksa url kopyalanır', async () => {
    setSecure(true);
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    await expect(shareOrCopy(data)).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith(data.url);
  });

  it('share başka bir hatayla başarısız olursa kopyalamaya düşer', async () => {
    setShare(vi.fn().mockRejectedValue(new DOMException('yok', 'NotAllowedError')));
    setExecCommand(() => true);
    await expect(shareOrCopy(data)).resolves.toBe('copied');
  });

  it('hiçbiri çalışmazsa failed döner', async () => {
    setExecCommand(() => false);
    await expect(shareOrCopy(data)).resolves.toBe('failed');
  });
});

/**
 * Panoya kopyalama ve paylaşım yardımcıları. Hiçbir fonksiyon throw etmez.
 */

function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined' || !document.body) return false;
  const textarea = document.createElement('textarea');
  try {
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.setAttribute('aria-hidden', 'true');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    return typeof document.execCommand === 'function' && document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (
      typeof window !== 'undefined' &&
      window.isSecureContext &&
      typeof navigator !== 'undefined' &&
      typeof navigator.clipboard?.writeText === 'function'
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Yedek yönteme düş.
  }
  return legacyCopy(text);
}

export type ShareResult = 'shared' | 'copied' | 'failed';

export async function shareOrCopy(data: { title: string; text: string; url: string }): Promise<ShareResult> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (err) {
      // Kullanıcı paylaşım penceresini kapattı: kopyalamaya düşme.
      if ((err as { name?: unknown } | null)?.name === 'AbortError') return 'failed';
      // Diğer hatalarda (ör. NotAllowedError) kopyalamayı dene.
    }
  }
  return (await copyText(data.url)) ? 'copied' : 'failed';
}

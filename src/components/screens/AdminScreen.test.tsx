import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AdminScreen } from './AdminScreen';

const game = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('../../context/GameContext', () => ({ useGame: () => game.value }));

type RpcResult = { data: unknown; error: unknown };

const mocks = vi.hoisted(() => ({
  configured: true,
  rpcResults: {} as Record<string, RpcResult | ((args: unknown) => RpcResult)>,
  rpc: vi.fn(),
  getSession: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mocks.rpc(...args),
    auth: {
      getSession: (...args: unknown[]) => mocks.getSession(...args),
      signInWithPassword: (...args: unknown[]) => mocks.signInWithPassword(...args),
      signOut: (...args: unknown[]) => mocks.signOut(...args),
    },
  },
  get isSupabaseConfigured() {
    return mocks.configured;
  },
}));

const QUESTIONS = [
  {
    id: 7,
    category: 'bilim',
    difficulty: 'kolay',
    question: 'Suyun kimyasal formülü nedir?',
    options: ['CO2', 'H2O', 'O2', 'NaCl'],
    correct_index: 1,
    explanation: null,
    is_active: true,
    times_answered: 12,
    correct_rate: 0.75,
  },
  {
    id: 3,
    category: 'mantık',
    difficulty: 'zor',
    question: 'Dizideki sonraki sayı: 2, 4, 8, ?',
    options: ['10', '12', '16', '14'],
    correct_index: 2,
    explanation: 'Her adımda iki katı.',
    is_active: false,
    times_answered: 0,
    correct_rate: null,
  },
];

const adminSession = { session: { user: { id: 'u1', email: 'admin@ornek.com', is_anonymous: false } } };

const setRpc = (name: string, result: RpcResult | ((args: unknown) => RpcResult)) => {
  mocks.rpcResults[name] = result;
};

const listCalls = () => mocks.rpc.mock.calls.filter(([name]) => name === 'admin_list_questions_rpc');

let setScreen: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mocks.configured = true;
  mocks.rpcResults = {};
  mocks.rpc.mockReset().mockImplementation((name: string, args?: unknown) => {
    const r = mocks.rpcResults[name];
    const value = typeof r === 'function' ? r(args) : r;
    return Promise.resolve(value ?? { data: { success: true }, error: null });
  });
  mocks.getSession.mockReset().mockResolvedValue({ data: { session: null } });
  mocks.signInWithPassword.mockReset();
  mocks.signOut.mockReset().mockResolvedValue({ error: null });
  setRpc('is_quiz_admin', { data: true, error: null });
  setRpc('admin_list_questions_rpc', { data: { success: true, questions: QUESTIONS }, error: null });
  setScreen = vi.fn();
  game.value = { setScreen };
});

const renderAsAdmin = async () => {
  mocks.getSession.mockResolvedValue({ data: adminSession });
  render(<AdminScreen />);
  await screen.findByText('Suyun kimyasal formülü nedir?');
};

const fillLogin = (email: string, password: string) => {
  fireEvent.change(screen.getByLabelText('E-posta'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Şifre'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: /Giriş Yap/ }));
};

describe('AdminScreen giriş', () => {
  it('anonim oturumda giriş formunu ve uyarıyı gösterir', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'anon', is_anonymous: true } } } });
    render(<AdminScreen />);
    expect(await screen.findByLabelText('E-posta')).toBeInTheDocument();
    expect(screen.getByText('Yönetici girişi bu tarayıcıdaki oyuncu oturumunu değiştirir.')).toBeInTheDocument();
    expect(mocks.rpc).not.toHaveBeenCalledWith('is_quiz_admin');
  });

  it('başarılı girişten sonra yetkiyi kontrol eder ve paneli açar', async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { session: { user: { email: 'admin@ornek.com' } } },
      error: null,
    });
    render(<AdminScreen />);
    await screen.findByLabelText('E-posta');
    fillLogin('admin@ornek.com', 'gizli123');

    expect(await screen.findByRole('tab', { name: /Sorular/ })).toBeInTheDocument();
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: 'admin@ornek.com', password: 'gizli123' });
    expect(mocks.rpc).toHaveBeenCalledWith('is_quiz_admin');
  });

  it('başarısız girişte hata gösterir', async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: { session: null }, error: { message: 'Invalid login credentials' } });
    render(<AdminScreen />);
    await screen.findByLabelText('E-posta');
    fillLogin('admin@ornek.com', 'yanlis');

    expect(await screen.findByRole('alert')).toHaveTextContent('Giriş başarısız: Invalid login credentials');
    expect(mocks.rpc).not.toHaveBeenCalledWith('is_quiz_admin');
  });

  it('boş form gönderilmez', async () => {
    render(<AdminScreen />);
    await screen.findByLabelText('E-posta');
    fireEvent.click(screen.getByRole('button', { name: /Giriş Yap/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('E-posta ve şifre gerekli.');
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it('e-postalı oturum varsa formu atlar; yönetici değilse uyarı ve çıkış gösterir', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.getSession.mockResolvedValue({ data: adminSession });
    setRpc('is_quiz_admin', { data: false, error: null });
    render(<AdminScreen />);

    expect(await screen.findByText('Bu hesap yönetici değil.')).toBeInTheDocument();
    expect(screen.queryByLabelText('E-posta')).not.toBeInTheDocument();

    window.location.hash = '#/admin';
    fireEvent.click(screen.getByRole('button', { name: /Çıkış Yap/ }));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalled());
    await waitFor(() => expect(window.location.hash).toBe(''));
  });

  it('Supabase yapılandırılmamışsa açıklama gösterir', () => {
    mocks.configured = false;
    render(<AdminScreen />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Supabase bağlantısı gerekli/);
    expect(mocks.getSession).not.toHaveBeenCalled();
  });
});

describe('AdminScreen sorular', () => {
  it('soruları rozet, doğru şık, istatistik ve durumla listeler', async () => {
    await renderAsAdmin();
    const items = screen.getAllByTestId('admin-question');
    expect(items).toHaveLength(2);

    const first = within(items[0]);
    expect(first.getByText('Bilim')).toBeInTheDocument();
    expect(first.getByText('Kolay')).toBeInTheDocument();
    expect(first.getByText('H2O').closest('li')).toHaveAttribute('data-correct', 'true');
    expect(first.getByText('CO2').closest('li')).not.toHaveAttribute('data-correct');
    expect(first.getByText('12 cevap')).toBeInTheDocument();
    expect(first.getByText('Doğru: %75')).toBeInTheDocument();
    expect(first.getByRole('switch')).toHaveAttribute('aria-checked', 'true');

    const second = within(items[1]);
    expect(second.getByText('Mantık')).toBeInTheDocument();
    expect(second.getByText('Zor')).toBeInTheDocument();
    expect(second.getByText('Doğru: —')).toBeInTheDocument();
    expect(second.getByRole('switch')).toHaveAttribute('aria-checked', 'false');

    expect(listCalls()[0][1]).toEqual({ p_search: null, p_category: null, p_difficulty: null });
  });

  it('filtreler ve gecikmeli arama RPC parametrelerine yansır', async () => {
    await renderAsAdmin();

    fireEvent.change(screen.getByLabelText('Kategori filtresi'), { target: { value: 'mantık' } });
    await waitFor(() =>
      expect(listCalls().at(-1)?.[1]).toEqual({ p_search: null, p_category: 'mantık', p_difficulty: null })
    );

    fireEvent.change(screen.getByLabelText('Zorluk filtresi'), { target: { value: 'zor' } });
    await waitFor(() =>
      expect(listCalls().at(-1)?.[1]).toEqual({ p_search: null, p_category: 'mantık', p_difficulty: 'zor' })
    );

    const before = listCalls().length;
    fireEvent.change(screen.getByLabelText('Soru ara'), { target: { value: ' dizi ' } });
    expect(listCalls()).toHaveLength(before);
    await waitFor(() =>
      expect(listCalls().at(-1)?.[1]).toEqual({ p_search: 'dizi', p_category: 'mantık', p_difficulty: 'zor' })
    );
  });

  it('liste hatasını gösterir', async () => {
    setRpc('admin_list_questions_rpc', { data: { success: false, error: 'Yetkisiz' }, error: null });
    mocks.getSession.mockResolvedValue({ data: adminSession });
    render(<AdminScreen />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Yetkisiz');
  });

  it('aktif/pasif anahtarı RPC çağırır ve durumu günceller', async () => {
    await renderAsAdmin();
    const toggle = screen.getByRole('switch', { name: 'Soru #7 aktif' });
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
    expect(mocks.rpc).toHaveBeenCalledWith('admin_set_question_active_rpc', { p_id: 7, p_active: false });
  });

  it('aktif/pasif hatasında durum değişmez ve hata gösterilir', async () => {
    await renderAsAdmin();
    setRpc('admin_set_question_active_rpc', { data: { success: false, error: 'Soru bulunamadı' }, error: null });
    const toggle = screen.getByRole('switch', { name: 'Soru #3 aktif' });
    fireEvent.click(toggle);
    expect(await screen.findByRole('alert')).toHaveTextContent('Soru bulunamadı');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });
});

describe('AdminScreen soru formu', () => {
  const openNew = async () => {
    await renderAsAdmin();
    fireEvent.click(screen.getByRole('button', { name: /Yeni Soru/ }));
    return screen.getByRole('form', { name: 'Soru formu' });
  };
  const setOptions = (values: string[]) =>
    ['A', 'B', 'C', 'D'].forEach((l, i) =>
      fireEvent.change(screen.getByLabelText(`Şık ${l}`), { target: { value: values[i] } })
    );
  const save = () => fireEvent.click(screen.getByRole('button', { name: /Kaydet/ }));
  const upsertCalls = () => mocks.rpc.mock.calls.filter(([name]) => name === 'admin_upsert_question_rpc');

  it('istemci tarafı doğrulama hatalarını gösterir', async () => {
    await openNew();

    fireEvent.change(screen.getByLabelText('Soru Metni'), { target: { value: 'Kısa' } });
    save();
    expect(screen.getByRole('alert')).toHaveTextContent('Soru metni 5-300 karakter olmalı.');

    fireEvent.change(screen.getByLabelText('Soru Metni'), { target: { value: 'Türkiye nin başkenti?' } });
    setOptions(['Ankara', 'İzmir', '', 'Bursa']);
    save();
    expect(screen.getByRole('alert')).toHaveTextContent('Dört şıkkın tamamı doldurulmalı.');

    setOptions(['Ankara', 'İzmir', 'Ankara ', 'Bursa']);
    save();
    expect(screen.getByRole('alert')).toHaveTextContent('Şıklar birbirinden farklı olmalı.');

    setOptions(['Ankara', 'İzmir', 'Van', 'Bursa']);
    save();
    expect(screen.getByRole('alert')).toHaveTextContent('Doğru şıkkı seçin.');

    expect(upsertCalls()).toHaveLength(0);
  });

  it('yeni soruyu kaydeder ve listeyi yeniler', async () => {
    setRpc('admin_upsert_question_rpc', { data: { success: true, id: 42 }, error: null });
    await openNew();
    const listsBefore = listCalls().length;

    fireEvent.change(screen.getByLabelText('Kategori'), { target: { value: 'genel' } });
    fireEvent.change(screen.getByLabelText('Zorluk'), { target: { value: 'orta' } });
    fireEvent.change(screen.getByLabelText('Soru Metni'), { target: { value: '  Türkiye nin başkenti?  ' } });
    setOptions(['İzmir', ' Ankara ', 'Van', 'Bursa']);
    fireEvent.click(screen.getByLabelText('Doğru şık B'));
    save();

    expect(await screen.findByText('Soru eklendi (#42).')).toBeInTheDocument();
    expect(upsertCalls()[0][1]).toEqual({
      p_id: null,
      p_category: 'genel',
      p_difficulty: 'orta',
      p_question: 'Türkiye nin başkenti?',
      p_options: ['İzmir', 'Ankara', 'Van', 'Bursa'],
      p_correct_index: 1,
      p_explanation: null,
    });
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(listsBefore));
  });

  it('mevcut soruyu düzenler ve sunucu hatasını gösterir', async () => {
    setRpc('admin_upsert_question_rpc', { data: { success: false, error: 'Aynı metinli bir soru zaten var' }, error: null });
    await renderAsAdmin();
    fireEvent.click(screen.getByRole('button', { name: 'Soru #3 düzenle' }));

    expect(screen.getByLabelText('Soru Metni')).toHaveValue('Dizideki sonraki sayı: 2, 4, 8, ?');
    expect(screen.getByLabelText('Doğru şık C')).toBeChecked();
    expect(screen.getByLabelText('Kategori')).toHaveValue('mantık');

    save();
    expect(await screen.findByRole('alert')).toHaveTextContent('Aynı metinli bir soru zaten var');
    expect(upsertCalls()[0][1]).toMatchObject({
      p_id: 3,
      p_options: ['10', '12', '16', '14'],
      p_correct_index: 2,
      p_explanation: 'Her adımda iki katı.',
    });
    expect(screen.getByRole('form', { name: 'Soru formu' })).toBeInTheDocument();
  });
});

describe('AdminScreen istatistik', () => {
  it('sayı kartlarını ve en çok yanlış yapılan soruları gösterir', async () => {
    setRpc('admin_stats_rpc', {
      data: {
        success: true,
        active_questions: 130,
        total_questions: 136,
        rooms_today: 25,
        matches_today: 18,
        most_missed: [{ id: 3, question: 'Zor soru?', times_answered: 10, correct_rate: 0.2 }],
      },
      error: null,
    });
    await renderAsAdmin();
    fireEvent.click(screen.getByRole('tab', { name: /İstatistik/ }));

    const cards = await screen.findAllByTestId('stat-card');
    expect(cards.map((c) => c.textContent)).toEqual([
      'Aktif soru130',
      'Toplam soru136',
      'Bugünkü oda25',
      'Bugünkü maç18',
    ]);
    expect(screen.getByText('En çok yanlış yapılan sorular')).toBeInTheDocument();
    const missed = screen.getByTestId('missed-question');
    expect(within(missed).getByText('Zor soru?')).toBeInTheDocument();
    expect(within(missed).getByText('Doğru: %20')).toBeInTheDocument();
    expect(within(missed).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20');
    expect(mocks.rpc).toHaveBeenCalledWith('admin_stats_rpc');
  });

  it('istatistik hatasını gösterir', async () => {
    setRpc('admin_stats_rpc', { data: { success: false, error: 'Yetkisiz' }, error: null });
    await renderAsAdmin();
    fireEvent.click(screen.getByRole('tab', { name: /İstatistik/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Yetkisiz');
  });
});

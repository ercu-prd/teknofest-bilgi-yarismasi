import type { Question } from '../types/game';

export const MOCK_QUESTIONS: Question[] = [
  {
    id: 1,
    category: 'Milli Teknoloji & TEKNOFEST',
    question: 'Türkiye’nin ilk milli insansız savaş uçağı Bayraktar KIZILELMA ilk uçuşunu hangi yılda gerçekleştirmiştir?',
    options: ['2020', '2021', '2022', '2023'],
    correctIndex: 2,
    explanation: 'Bayraktar KIZILELMA ilk uçuşunu 14 Aralık 2022 tarihinde başarıyla tamamlamıştır.'
  },
  {
    id: 2,
    category: 'Havacılık ve Uzay',
    question: 'Türkiye’nin ilk yerli ve milli haberleşme uydusu aşağıdakilerden hangisidir?',
    options: ['GÖKTÜRK-1', 'RASAT', 'TÜRKSAT 6A', 'İMECE'],
    correctIndex: 2,
    explanation: 'TÜRKSAT 6A, Türkiye’nin yerli imkânlarla geliştirilen ilk haberleşme uydusudur.'
  },
  {
    id: 3,
    category: 'Yapay Zekâ ve Otonom',
    question: 'Otonom araçların çevresini 3B olarak haritalandırmak için kullandığı lazer tabanlı sensör teknolojisi nedir?',
    options: ['RADAR', 'LiDAR', 'SONAR', 'GPS'],
    correctIndex: 1,
    explanation: 'LiDAR (Light Detection and Ranging), lazer ışınları kullanarak yüksek hassasiyetli 3B haritalama sağlar.'
  },
  {
    id: 4,
    category: 'Yazılım ve Algoritma',
    question: 'Zaman karmaşıklığı O(1) olan veri yapısı erişim işlemi aşağıdakilerden hangisidir?',
    options: ['Dizi (Array) İndeks Erişimi', 'Bağlı Liste (LinkedList) Arama', 'İkili Arama Ağacı (BST) Arama', 'Derinlik Öncelikli Arama (DFS)'],
    correctIndex: 0,
    explanation: 'Bir dizideki elemana indeksi ile doğrudan erişmek sabit zaman O(1) alır.'
  },
  {
    id: 5,
    category: 'Roket & İtki Sistemleri',
    question: 'Bir roketin Dünya yerçekimini yenip yörüngeye girmesi için ulaşması gereken minimum hız kavramı nedir?',
    options: ['Terminal Hız', 'Ses Hızı (Mach 1)', 'Kurtulma Hızı', 'Yörünge Hızı'],
    correctIndex: 3,
    explanation: 'Alçak Dünya Yörüngesi için gerekli orbital hız yaklaşık 7.8 km/s (28.000 km/s) düzeyindedir.'
  },
  {
    id: 6,
    category: 'Milli Savunma',
    question: 'Türkiye’nin 5. nesil milli muharip uçağının adı nedir?',
    options: ['ANKA-3', 'KAAN', 'HÜRJET', 'ATAK-2'],
    correctIndex: 1,
    explanation: 'KAAN, TUSAŞ tarafından geliştirilen 5. nesil stealth milli muharip uçağımızdır.'
  },
  {
    id: 7,
    category: 'Siber Güvenlik',
    question: 'Verilerin gönderici ile alıcı arasında şifrelenerek yetkisiz kişilerin erişimini engelleyen protokol mimarisi nedir?',
    options: ['End-to-End Encryption (E2EE)', 'FTP', 'HTTP', 'DNS Spoofing'],
    correctIndex: 0,
    explanation: 'Uçtan uca şifreleme (E2EE), veriyi yalnızca iletişimdeki tarafların okuyabilmesini sağlar.'
  },
  {
    id: 8,
    category: 'Otonom Sistemler',
    question: 'İnsansız Deniz Araçlarında (İDA) engel tespit ve engelden kaçınma algoritmalarında en kritik standart nedir?',
    options: ['COLREG Standartları', 'IEEE 802.11', 'POSIX', 'ISO 9001'],
    correctIndex: 0,
    explanation: 'COLREG (Denizde Çatışmayı Önleme Tüzüğü), otonom İDA rotalarında yasal ve teknik temel oluşturur.'
  },
  {
    id: 9,
    category: 'Elektrikli Araçlar',
    question: 'Elektrikli araç bataryalarında hücre sıcaklığını ve şarj-deşarj dengesini kontrol eden yönetim sisteminin kısaltması nedir?',
    options: ['ABS', 'BMS', 'ECU', 'CAN-BUS'],
    correctIndex: 1,
    explanation: 'BMS (Battery Management System), batarya paketi güvenliğini ve ömrünü optimize eder.'
  },
  {
    id: 10,
    category: 'TEKNOFEST Ruh',
    question: 'TEKNOFEST Havacılık, Uzay ve Teknoloji Festivali hangi vizyon sloganı ile yürütülmektedir?',
    options: ['Geleceğin Teknolojisi', 'Milli Teknoloji Hamlesi', 'Uzay Yüzyılı', 'Dijital Dönüşüm'],
    correctIndex: 1,
    explanation: 'TEKNOFEST, Türkiye’nin "Milli Teknoloji Hamlesi" vizyonunun amiral gemisidir.'
  }
];

export const AVATAR_OPTIONS = [
  { id: 'pilot', name: 'Jet Pilotu', icon: '🚀' },
  { id: 'cyber', name: 'Cyber Yetkili', icon: '⚡' },
  { id: 'ai', name: 'AI Mimarı', icon: '🤖' },
  { id: 'hacker', name: 'Siber Uzman', icon: '🛡️' },
  { id: 'space', name: 'Astronavt', icon: '👨‍🚀' },
  { id: 'engineer', name: 'Tekno Mühendis', icon: '⚙️' },
];

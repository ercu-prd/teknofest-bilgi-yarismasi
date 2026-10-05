export interface QuestionItem {
  id: number;
  category: 'Teknoloji' | 'Bilim' | 'Genel Kültür' | 'Mantık';
  difficulty: 'kolay' | 'orta' | 'zor';
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export const QUESTION_BANK: QuestionItem[] = [
  // TEKNOLOJİ (1-28)
  {
    id: 1,
    category: 'Teknoloji',
    difficulty: 'kolay',
    question: 'Türkiye’nin ilk milli insansız savaş uçağı Bayraktar KIZILELMA ilk uçuşunu hangi yılda gerçekleştirmiştir?',
    options: ['2020', '2021', '2022', '2023'],
    correctIndex: 2,
    explanation: 'Bayraktar KIZILELMA ilk uçuşunu 14 Aralık 2022 tarihinde başarıyla tamamlamıştır.'
  },
  {
    id: 2,
    category: 'Teknoloji',
    difficulty: 'kolay',
    question: 'Türkiye’nin 5. nesil milli muharip uçağının adı nedir?',
    options: ['ANKA-3', 'KAAN', 'HÜRJET', 'ATAK-2'],
    correctIndex: 1,
    explanation: 'KAAN, TUSAŞ tarafından geliştirilen 5. nesil stealth milli muharip uçağımızdır.'
  },
  {
    id: 3,
    category: 'Teknoloji',
    difficulty: 'kolay',
    question: 'Otonom araçlarda lazer ışınları ile 3B haritalama sağlayan sensör teknolojisi hangisidir?',
    options: ['RADAR', 'LiDAR', 'SONAR', 'GPS'],
    correctIndex: 1,
    explanation: 'LiDAR (Light Detection and Ranging), lazer ışınları kullanarak yüksek hassasiyetli 3B haritalama sağlar.'
  },
  {
    id: 4,
    category: 'Teknoloji',
    difficulty: 'orta',
    question: 'Zaman karmaşıklığı O(1) olan veri yapısı erişim işlemi aşağıdakilerden hangisidir?',
    options: ['Dizi (Array) İndeks Erişimi', 'Bağlı Liste (LinkedList) Arama', 'İkili Arama Ağacı Arama', 'Derinlik Öncelikli Arama'],
    correctIndex: 0,
    explanation: 'Dizide indeksi bilinen bir elemana doğrudan erişim O(1) sabit sürede gerçekleşir.'
  },
  {
    id: 5,
    category: 'Teknoloji',
    difficulty: 'orta',
    question: 'Verilerin gönderici ile alıcı arasında şifrelenerek yetkisiz kişilerin okumasını engelleyen protokol mimarisi nedir?',
    options: ['Uçtan Uca Şifreleme (E2EE)', 'FTP', 'HTTP', 'DNS Spoofing'],
    correctIndex: 0,
    explanation: 'End-to-End Encryption (E2EE), veriyi yalnızca gönderen ve alan tarafların çözebilmesini sağlar.'
  },
  {
    id: 6,
    category: 'Teknoloji',
    difficulty: 'kolay',
    question: 'Elektrikli araçlarda batarya hücresi sıcaklığını ve şarj dengesini yöneten sistemin kısaltması nedir?',
    options: ['ABS', 'BMS', 'ECU', 'CAN-BUS'],
    correctIndex: 1,
    explanation: 'BMS (Battery Management System), batarya paketi güvenliğini ve ömrünü kontrol eder.'
  },
  {
    id: 7,
    category: 'Teknoloji',
    difficulty: 'orta',
    question: 'Yapay zekada derin öğrenme modellerinin eğitilmesinde yaygın kullanılan ve matris işlemlerini hızlandıran birim nedir?',
    options: ['CPU', 'GPU', 'RAM', 'HDD'],
    correctIndex: 1,
    explanation: 'GPU (Grafik İşleme Birimi), paralel matris hesaplamalarında CPUya kıyasla yüksek performans sunar.'
  },
  {
    id: 8,
    category: 'Teknoloji',
    difficulty: 'zor',
    question: 'Nesnelerin İnterneti (IoT) cihazlarında düşük güç tüketimli kablosuz iletişim sağlayan protokol hangisidir?',
    options: ['LoRaWAN', 'PCIe', 'SATA', 'HDMI'],
    correctIndex: 0,
    explanation: 'LoRaWAN, geniş alanda düşük güçle uzun menzilli IoT iletişimi sağlar.'
  },
  {
    id: 9,
    category: 'Teknoloji',
    difficulty: 'kolay',
    question: 'TEKNOFEST festivali hangi ana vizyon sloganı ile yürütülmektedir?',
    options: ['Geleceğin Teknolojisi', 'Milli Teknoloji Hamlesi', 'Uzay Yüzyılı', 'Dijital Dönüşüm'],
    correctIndex: 1,
    explanation: 'TEKNOFEST, Türkiye’nin "Milli Teknoloji Hamlesi" vizyonunun amiral gemisidir.'
  },
  {
    id: 10,
    category: 'Teknoloji',
    difficulty: 'orta',
    question: 'İnsansız Deniz Araçlarında (İDA) engel tespit ve çatışma önleme kurallarını belirleyen uluslararası denizcilik standardı nedir?',
    options: ['COLREG', 'POSIX', 'ISO 9001', 'IEEE 802.11'],
    correctIndex: 0,
    explanation: 'COLREG (Denizde Çatışmayı Önleme Tüzüğü), otonom İDA rotalarında yasal ve teknik temel oluşturur.'
  },
  {
    id: 11,
    category: 'Teknoloji',
    difficulty: 'kolay',
    question: 'Web geliştirmede kullanıcı arayüzü ve istemci tarafı mantığını ifade eden terim nedir?',
    options: ['Frontend', 'Backend', 'Database', 'DevOps'],
    correctIndex: 0,
    explanation: 'Frontend, kullanıcının doğrudan etkileşime girdiği ön yüz teknolojilerini kapsar.'
  },
  {
    id: 12,
    category: 'Teknoloji',
    difficulty: 'orta',
    question: 'Blokzincir (Blockchain) teknolojisinde işlemleri doğrulayan ve blok ekleyen düğümlere ne ad verilir?',
    options: ['Node (Düğüm)', 'Router', 'Switch', 'Modem'],
    correctIndex: 0,
    explanation: 'Node, blokzincir ağındaki işlemleri doğrulayan ve dağıtık defteri tutan ağ birimidir.'
  },
  {
    id: 13,
    category: 'Teknoloji',
    difficulty: 'zor',
    question: 'Kuantum bilgisayarlarda temel bilgi birimi olarak kullanılan yapı nedir?',
    options: ['Bit', 'Qubit', 'Byte', 'Pixel'],
    correctIndex: 1,
    explanation: 'Qubit (Kuantum Bit), süperpozisyon ilkesiyle aynı anda hem 0 hem 1 durumunda bulunabilir.'
  },
  {
    id: 14,
    category: 'Teknoloji',
    difficulty: 'orta',
    question: 'Gömülü sistemlerde yaygın kullanılan ve mikrodenetleyiciler arası seri iletişim sağlayan protokol hangisidir?',
    options: ['I2C', 'HTTP', 'SMTP', 'SSH'],
    correctIndex: 0,
    explanation: 'I2C (Inter-Integrated Circuit), senkron seri veri veri yolu protokolüdür.'
  },
  {
    id: 15,
    category: 'Teknoloji',
    difficulty: 'kolay',
    question: 'Türkiye’nin ilk yerli otomobil markası TOGG’un fabrikası hangi ilimizde bulunmaktadır?',
    options: ['Bursa (Gemlik)', 'Kocaeli', 'İzmir', 'Eskişehir'],
    correctIndex: 0,
    explanation: 'TOGG Teknoloji Kampüsü Bursa Gemlik ilçesinde yer almaktadır.'
  },
  {
    id: 16,
    category: 'Teknoloji',
    difficulty: 'orta',
    question: 'Yapay zekada "Transformer" mimarisini tanıtan ünlü makalenin adı nedir?',
    options: ['Attention Is All You Need', 'Deep Residual Learning', 'ImageNet Classification', 'Mastering Go'],
    correctIndex: 0,
    explanation: 'Google araştırmacıları tarafından 2017de yayımlanan "Attention Is All You Need" modern LLMlerin temelidir.'
  },
  {
    id: 17,
    category: 'Teknoloji',
    difficulty: 'kolay',
    question: '3D yazıcılarda en sık kullanılan plastik filament türlerinden biri hangisidir?',
    options: ['PLA', 'PVC', 'Teflon', 'Kevlar'],
    correctIndex: 0,
    explanation: 'PLA (Polylactic Acid), mısır nişastası bazlı biyobozunur yaygın 3D baskı filamentidir.'
  },
  {
    id: 18,
    category: 'Teknoloji',
    difficulty: 'orta',
    question: 'Mikroservis mimarilerinde servislerin konteynerize edilmesini sağlayan popüler açık kaynak platform nedir?',
    options: ['Docker', 'Nginx', 'Apache', 'Redis'],
    correctIndex: 0,
    explanation: 'Docker, uygulamaları bağımlılıklarıyla birlikte hafif konteynerlar halinde paketler.'
  },
  {
    id: 19,
    category: 'Teknoloji',
    difficulty: 'zor',
    question: 'Derin öğrenmede kayıp fonksiyonunun eğimini hesaplayarak ağırlıkları güncelleyen algoritma hangisidir?',
    options: ['Backpropagation (Geri Yayılım)', 'Dijkstra', 'QuickSort', 'K-Means'],
    correctIndex: 0,
    explanation: 'Backpropagation, türev ve zincir kuralı kullanarak yapay sinir ağlarındaki ağırlıkları optimize eder.'
  },
  {
    id: 20,
    category: 'Teknoloji',
    difficulty: 'kolay',
    question: 'Türkiye’nin jet eğitim ve hafif taarruz uçağı projesinin adı nedir?',
    options: ['HÜRJET', 'KAAN', 'ANKA', 'SOM'],
    correctIndex: 0,
    explanation: 'HÜRJET, TUSAŞ tarafından geliştirilen Türkiye’nin ilk jet eğitim uçağıdır.'
  },
  {
    id: 21,
    category: 'Teknoloji',
    difficulty: 'orta',
    question: 'Artırılmış Gerçeklik (AR) ile Sanal Gerçeklik (VR) teknolojilerinin birleşimini ifade eden genel terim nedir?',
    options: ['XR (Extended Reality)', 'AI', 'IoT', 'NFC'],
    correctIndex: 0,
    explanation: 'XR (Genişletilmiş Gerçeklik), AR, VR ve MR (Karma Gerçeklik) teknolojilerinin genel adıdır.'
  },
  {
    id: 22,
    category: 'Teknoloji',
    difficulty: 'kolay',
    question: 'Siber güvenlikte kullanıcı şifresine ek olarak SMS veya doğrulama kodu isteyen güvenlik katmanı nedir?',
    options: ['2FA (İki Faktörlü Doğrulama)', 'VPN', 'Firewall', 'Antivirüs'],
    correctIndex: 0,
    explanation: '2FA (Two-Factor Authentication), hesap erişiminde ikincil güvenlik doğrulaması sağlar.'
  },
  {
    id: 23,
    category: 'Teknoloji',
    difficulty: 'zor',
    question: 'İnsansız Hava Araçlarında (İHA) uçuş stabilitesini sağlayan oryantasyon ve ivme ölçer sensör paketi nedir?',
    options: ['IMU (Inertial Measurement Unit)', 'ESC', 'PDB', 'Telemetry'],
    correctIndex: 0,
    explanation: 'IMU sensör paketi (jiroskop ve ivmeölçer), İHA yerçekimi ve yönelim açılarını ölçer.'
  },
  {
    id: 24,
    category: 'Teknoloji',
    difficulty: 'orta',
    question: 'Yerli insansız helikopter projemizin adı nedir?',
    options: ['ALPİN', 'Bayraktar TB2', 'AKINCI', 'KARGU'],
    correctIndex: 0,
    explanation: 'ALPİN, Titra Teknoloji tarafından geliştirilen insansız helikopter sistemidir.'
  },
  {
    id: 25,
    category: 'Teknoloji',
    difficulty: 'kolay',
    question: 'Python dilinde liste elemanlarını sıralamak için hangi gömülü fonksiyon kullanılır?',
    options: ['sorted()', 'order()', 'arrange()', 'rank()'],
    correctIndex: 0,
    explanation: 'Python gömülü sorted() fonksiyonu verileri sıralı liste olarak döndürür.'
  },
  {
    id: 26,
    category: 'Teknoloji',
    difficulty: 'orta',
    question: 'Ağ anahtarlama cihazında (Switch) MAC adresleri ile port eşleştirmelerini tutan tablo hangisidir?',
    options: ['CAM Tablosu', 'Routing Tablosu', 'DNS Tablosu', 'ARP Tablosu'],
    correctIndex: 0,
    explanation: 'CAM (Content Addressable Memory) tablosu MAC adreslerini ilgili fiziksel portla eşler.'
  },
  {
    id: 27,
    category: 'Teknoloji',
    difficulty: 'zor',
    question: 'ROKETSAN tarafından geliştirilen Türkiye’nin ilk deniz füzesi hangisidir?',
    options: ['ATMACA', 'CİRİT', 'BORA', 'TAYFUN'],
    correctIndex: 0,
    explanation: 'ATMACA, gemisavar seyir füzesi olarak geliştirilen milli füzemizdir.'
  },
  {
    id: 28,
    category: 'Teknoloji',
    difficulty: 'orta',
    question: 'İnsansız Kara Araçlarında (İKA) paletli ve tekerlekli şasilerin motor tork aktarım kontrol birimi nedir?',
    options: ['Motor Sürücü (ESC/Driver)', 'BMS', 'Lidar', 'Transkoder'],
    correctIndex: 0,
    explanation: 'Motor sürücü devresi mikrodenetleyiciden gelen sinyallerle elektrik motor gücünü ayarlar.'
  },

  // BİLİM (29-55)
  {
    id: 29,
    category: 'Bilim',
    difficulty: 'kolay',
    question: 'Türkiye’nin ilk yerli ve milli haberleşme uydusu aşağıdakilerden hangisidir?',
    options: ['GÖKTÜRK-1', 'RASAT', 'TÜRKSAT 6A', 'İMECE'],
    correctIndex: 2,
    explanation: 'TÜRKSAT 6A, tamamen yerli imkânlarla üretilen ilk haberleşme uydumuzdur.'
  },
  {
    id: 30,
    category: 'Bilim',
    difficulty: 'orta',
    question: 'Roketin Dünya yerçekimini yenip yörüngeye girmesi için gereken hız kavramı nedir?',
    options: ['Terminal Hız', 'Ses Hızı', 'Kurtulma Hızı', 'Yörünge Hızı'],
    correctIndex: 3,
    explanation: 'Alçak Dünya Yörüngesi dairesel yörünge hızı yaklaşık 7.8 km/s seviyesindedir.'
  },
  {
    id: 31,
    category: 'Bilim',
    difficulty: 'kolay',
    question: 'Güneş Sistemimizdeki en büyük gezegen hangisidir?',
    options: ['Mars', 'Jüpiter', 'Satürn', 'Neptün'],
    correctIndex: 1,
    explanation: 'Jüpiter, kütle ve hacim olarak Güneş Sistemindeki en büyük gaz devidir.'
  },
  {
    id: 32,
    category: 'Bilim',
    difficulty: 'orta',
    question: 'Işık hızının boşluktaki değeri yaklaşık olarak kaç km/s’dir?',
    options: ['150.000', '300.000', '500.000', '1.000.000'],
    correctIndex: 1,
    explanation: 'Işık hızı c ≈ 299.792 km/s (yaklaşık 300.000 km/s) değerindedir.'
  },
  {
    id: 33,
    category: 'Bilim',
    difficulty: 'zor',
    question: 'Genel Görelilik Kuramını geliştirerek uzay-zaman bükülmesini açıklayan bilim insanı kimdir?',
    options: ['Isaac Newton', 'Albert Einstein', 'Galileo Galilei', 'Nikola Tesla'],
    correctIndex: 1,
    explanation: 'Albert Einstein 1915 yılında Genel Görelilik Kuramını yayımlamıştır.'
  },
  {
    id: 34,
    category: 'Bilim',
    difficulty: 'kolay',
    question: 'Suyun kimyasal formülü nedir?',
    options: ['CO2', 'H2O', 'NaCl', 'O2'],
    correctIndex: 1,
    explanation: 'Su, 2 Hidrojen ve 1 Oksijen atomundan oluşur (H2O).'
  },
  {
    id: 35,
    category: 'Bilim',
    difficulty: 'orta',
    question: 'Atomun çekirdeğinde bulunan pozitif yüklü parçacık hangisidir?',
    options: ['Elektron', 'Proton', 'Nötron', 'Foton'],
    correctIndex: 1,
    explanation: 'Protonlar atom çekirdeğinde yer alır ve +1 elektrik yüküne sahiptir.'
  },
  {
    id: 36,
    category: 'Bilim',
    difficulty: 'kolay',
    question: 'Dünya’nın uydusu olan gök cismi hangisidir?',
    options: ['Güneş', 'Ay', 'Phobos', 'Titan'],
    correctIndex: 1,
    explanation: 'Ay, Dünya’nın tek doğal uydusudur.'
  },
  {
    id: 37,
    category: 'Bilim',
    difficulty: 'zor',
    question: 'Genetik bilgisini taşıyan ve çift sarmal yapıya sahip molekül nedir?',
    options: ['RNA', 'DNA', 'ATP', 'Glikoz'],
    correctIndex: 1,
    explanation: 'DNA (Deoksiribonükleik Asit), canlıların kalıtsal materyalidir.'
  },
  {
    id: 38,
    category: 'Bilim',
    difficulty: 'orta',
    question: 'Mars yüzeyine iniş yapan NASA uzay aracının adı nedir?',
    options: ['Perseverance', 'Voyager 1', 'Hubble', 'James Webb'],
    correctIndex: 0,
    explanation: 'Perseverance keşif aracı 2021 yılında Mars’taki Jezero kraterine inmiştir.'
  },
  {
    id: 39,
    category: 'Bilim',
    difficulty: 'kolay',
    question: 'İnsan vücudunda kanı pompalayan ana organ hangisidir?',
    options: ['Akciğer', 'Karaciğer', 'Kalp', 'Böbrek'],
    correctIndex: 2,
    explanation: 'Kalp kas yapısı sayesinde dolaşım sistemine kan pompalar.'
  },
  {
    id: 40,
    category: 'Bilim',
    difficulty: 'orta',
    question: 'Bitkilerin güneş ışığını kullanarak besin üretmesi işlemine ne ad verilir?',
    options: ['Solunum', 'Fotosentez', 'Mayalanma', 'Buharlaşma'],
    correctIndex: 1,
    explanation: 'Fotosentez, klorofil içeren canlıların ışık enerjisiyle kimyasal besin üretmesidir.'
  },
  {
    id: 41,
    category: 'Bilim',
    difficulty: 'zor',
    question: 'Termodinamiğin 2. Yasası gereği evrendeki düzensizlik eğilimine verilen isim nedir?',
    options: ['Entalpi', 'Entropi', 'İnertia', 'Kavitasyon'],
    correctIndex: 1,
    explanation: 'Entropi, bir sistemdeki düzensizlik veya rastgeleliğin ölçüsüdür.'
  },
  {
    id: 42,
    category: 'Bilim',
    difficulty: 'kolay',
    question: 'Yerçekimi ivmesi Dünya yüzeyinde yaklaşık kaç m/s² kabul edilir?',
    options: ['5.5', '9.8', '12.4', '15.0'],
    correctIndex: 1,
    explanation: 'Standart yerçekimi ivmesi g ≈ 9.81 m/s² olarak hesaplanır.'
  },
  {
    id: 43,
    category: 'Bilim',
    difficulty: 'orta',
    question: 'Güneş Sisteminde halkalarıyla tanınan gaz dev gezegeni hangisidir?',
    options: ['Satürn', 'Uranüs', 'Mars', 'Merkür'],
    correctIndex: 0,
    explanation: 'Satürn, belirgin kütleli buz ve kaya halkalarıyla bilinir.'
  },
  {
    id: 44,
    category: 'Bilim',
    difficulty: 'zor',
    question: 'Kuantum fiziğinde çift yarık deneyinin kanıtladığı temel olgu nedir?',
    options: ['Işığın hem dalga hem parçacık özelliği', 'Işığın kütle çekiminden etkilenmediği', 'Sesin boşlukta yayıldığı', 'Kütlenin korunumsuzluğu'],
    correctIndex: 0,
    explanation: 'Çift yarık deneyi dalga-parçacık ikiliğini (wave-particle duality) ortaya koymuştur.'
  },
  {
    id: 45,
    category: 'Bilim',
    difficulty: 'kolay',
    question: 'Atmosferimizde en yüksek oranda bulunan gaz hangisidir?',
    options: ['Oksijen', 'Azot (Nitrojen)', 'Karbondioksit', 'Helyum'],
    correctIndex: 1,
    explanation: 'Dünya atmosferinin yaklaşık %78i Azot gazından oluşur.'
  },
  {
    id: 46,
    category: 'Bilim',
    difficulty: 'orta',
    question: 'Elementlerin atom numaralarına göre sıralandığı çizelgenin adı nedir?',
    options: ['Periyodik Cetvel', 'Mendeleyev İndeksi', 'Spektrum Skalası', 'Oktet Haritası'],
    correctIndex: 0,
    explanation: 'Periyodik cetvel (tablo), elementleri artan atom numaralarına göre düzenler.'
  },
  {
    id: 47,
    category: 'Bilim',
    difficulty: 'zor',
    question: 'Hangi bilim insanı kuduz aşısını keşfetmiştir?',
    options: ['Louis Pasteur', 'Alexander Fleming', 'Robert Koch', 'Edward Jenner'],
    correctIndex: 0,
    explanation: 'Louis Pasteur 1885 yılında kuduz aşısını başarıyla uygulamıştır.'
  },
  {
    id: 48,
    category: 'Bilim',
    difficulty: 'kolay',
    question: 'Ses dalgaları hangi ortamda yayılamaz?',
    options: ['Hava', 'Su', 'Boşluk (Vakum)', 'Demir'],
    correctIndex: 2,
    explanation: 'Ses mekanik bir dalga olduğu için yayılmak için tanecikli ortama ihtiyaç duyar.'
  },
  {
    id: 49,
    category: 'Bilim',
    difficulty: 'orta',
    question: 'Dünyanın en derin deniz çukuru hangisidir?',
    options: ['Mariana Çukuru', 'Porto Riko Çukuru', 'Java Çukuru', 'Sunda Çukuru'],
    correctIndex: 0,
    explanation: 'Mariana Çukuru yaklaşık 11.000 metre derinliğiyle bilinen en derin noktadır.'
  },
  {
    id: 50,
    category: 'Bilim',
    difficulty: 'zor',
    question: 'Nobel Kimya Ödülü kazanan ilk Türk bilim insanı kimdir?',
    options: ['Aziz Sancar', 'Cahit Arf', 'Oktay Sinanoğlu', 'Feza Gürsey'],
    correctIndex: 0,
    explanation: 'Prof. Dr. Aziz Sancar 2015 yılında DNA onarımı mekanizması çalışmasıyla Nobel kazanmıştır.'
  },
  {
    id: 51,
    category: 'Bilim',
    difficulty: 'kolay',
    question: 'Bir yıldızın patlayarak ömrünü tamamlaması olayına ne denir?',
    options: ['Süpernova', 'Kara Delik', 'Nebula', 'Pulsar'],
    correctIndex: 0,
    explanation: 'Büyük kütleli yıldızların patlamasına süpernova adı verilir.'
  },
  {
    id: 52,
    category: 'Bilim',
    difficulty: 'orta',
    question: 'Elektrik akım şiddetinin SI birimi nedir?',
    options: ['Amper', 'Volt', 'Ohm', 'Watt'],
    correctIndex: 0,
    explanation: 'Elektrik akım birimi Amper (A) olarak ifade edilir.'
  },
  {
    id: 53,
    category: 'Bilim',
    difficulty: 'zor',
    question: 'Karadeliklerin olay ufkunu ilk kez görüntüleyen küresel mikrodalga teleskop ağı projesinin adı nedir?',
    options: ['Event Horizon Telescope (EHT)', 'Hubble', 'James Webb', 'Kepler'],
    correctIndex: 0,
    explanation: 'EHT, 2019 yılında M87 galaksisindeki karadeliğin ilk fotoğrafını yayımlamıştır.'
  },
  {
    id: 54,
    category: 'Bilim',
    difficulty: 'kolay',
    question: 'Depremin büyüklüğünü ölçen ölçek hangisidir?',
    options: ['Richter Ölçeği', 'Celsius Skalası', 'Barometre', 'Desibel Skalası'],
    correctIndex: 0,
    explanation: 'Richter ölçeği deprem sırasında açığa çıkan enerjiyi logaritmik hesaplar.'
  },
  {
    id: 55,
    category: 'Bilim',
    difficulty: 'orta',
    question: 'Evrenin genişlediğini galaksilerin kırmızıya kaymasından tespit eden astronom kimdir?',
    options: ['Edwin Hubble', 'Carl Sagan', 'Stephen Hawking', 'Tycho Brahe'],
    correctIndex: 0,
    explanation: 'Edwin Hubble 1929da galaksilerin birbirinden uzaklaştığını gözlemlemiştir.'
  },

  // GENEL KÜLTÜR (56-80)
  {
    id: 56,
    category: 'Genel Kültür',
    difficulty: 'kolay',
    question: 'Türkiye Cumhuriyeti’nin kurucusu ve ilk cumhurbaşkanı kimdir?',
    options: ['Mustafa Kemal Atatürk', 'İsmet İnönü', 'Kazım Karabekir', 'Fevzi Çakmak'],
    correctIndex: 0,
    explanation: 'Gazi Mustafa Kemal Atatürk Türkiye Cumhuriyeti’nin kurucu lideridir.'
  },
  {
    id: 57,
    category: 'Genel Kültür',
    difficulty: 'kolay',
    question: 'Türkiye’nin başkenti neresidir?',
    options: ['İstanbul', 'Ankara', 'İzmir', 'Bursa'],
    correctIndex: 1,
    explanation: 'Ankara, 13 Ekim 1923 tarihinde Türkiye Cumhuriyeti’nin başkenti ilan edilmiştir.'
  },
  {
    id: 58,
    category: 'Genel Kültür',
    difficulty: 'orta',
    question: 'Dünyanın en uzun nehri kabul edilen nehir hangisidir?',
    options: ['Nil Nehri', 'Amazon Nehri', 'Tuna Nehri', 'Fırat Nehri'],
    correctIndex: 0,
    explanation: 'Afrika kıtasındaki Nil nehri yaklaşık 6.650 km uzunluğuyla en uzun nehirdir.'
  },
  {
    id: 59,
    category: 'Genel Kültür',
    difficulty: 'kolay',
    question: 'İstiklal Marşı’mızın şairi kimdir?',
    options: ['Mehmet Akif Ersoy', 'Yahya Kemal Beyatlı', 'Namık Kemal', 'Orhan Veli Kanık'],
    correctIndex: 0,
    explanation: 'Mehmet Akif Ersoy 1921 yılında İstiklal Marşı’nı kaleme almıştır.'
  },
  {
    id: 60,
    category: 'Genel Kültür',
    difficulty: 'orta',
    question: 'Birleşmiş Milletler (BM) Genel Merkezi hangi şehirdedir?',
    options: ['New York', 'Cenevre', 'Londra', 'Paris'],
    correctIndex: 0,
    explanation: 'BM Ana Genel Merkezi New York ABDde yer almaktadır.'
  },
  {
    id: 61,
    category: 'Genel Kültür',
    difficulty: 'zor',
    question: 'UNESCO Dünya Mirası Listesi’nde yer alan ve "Tarihin Sıfır Noktası" kabul edilen Şanlıurfa’daki tapınak neresidir?',
    options: ['Göbeklitepe', 'Çatalhöyük', 'Efes', 'Nemrut Dağı'],
    correctIndex: 0,
    explanation: 'Göbeklitepe 12.000 yıllık geçmişiyle bilinen en eski tapınak kompleksidir.'
  },
  {
    id: 62,
    category: 'Genel Kültür',
    difficulty: 'kolay',
    question: 'Japonya’nın para birimi nedir?',
    options: ['Yen', 'Yuan', 'Won', 'Dolar'],
    correctIndex: 0,
    explanation: 'Japonya resmi para birimi Yen (¥)dir.'
  },
  {
    id: 63,
    category: 'Genel Kültür',
    difficulty: 'orta',
    question: 'Dünya kupasını en çok kazanan milli futbol takımı hangisidir?',
    options: ['Brezilya', 'Almanya', 'Arjantin', 'İtalya'],
    correctIndex: 0,
    explanation: 'Brezilya 5 kez (1958, 1962, 1970, 1994, 2002) Dünya Kupasını kazanmıştır.'
  },
  {
    id: 64,
    category: 'Genel Kültür',
    difficulty: 'zor',
    question: 'Avrupa Kıtası ile Asya Kıtasını birleştiren tarihi Çanakkale Köprüsü’nün orta açıklığı kaç metredir?',
    options: ['2023 Metre', '1915 Metre', '1071 Metre', '1453 Metre'],
    correctIndex: 0,
    explanation: '1915 Çanakkale Köprüsü Cumhuriyetimizin 100. yılına ithafen 2023 metre orta açıklığa sahiptir.'
  },
  {
    id: 65,
    category: 'Genel Kültür',
    difficulty: 'kolay',
    question: 'Mona Lisa tablosunu yapan dünyaca ünlü İtalyan ressam kimdir?',
    options: ['Leonardo da Vinci', 'Michelangelo', 'Pablo Picasso', 'Vincent van Gogh'],
    correctIndex: 0,
    explanation: 'Mona Lisa, Leonardo da Vinci tarafından 16. yüzyılda yapılmıştır.'
  },
  {
    id: 66,
    category: 'Genel Kültür',
    difficulty: 'orta',
    question: 'Akdeniz ile Kızıldeniz’i birbirine bağlayan yapay su kanalı hangisidir?',
    options: ['Süveyş Kanalı', 'Panama Kanalı', 'Korent Kanalı', 'Cebelitarık Boğazı'],
    correctIndex: 0,
    explanation: 'Süveyş Kanalı 1869 yılında deniz ulaşımına açılmıştır.'
  },
  {
    id: 67,
    category: 'Genel Kültür',
    difficulty: 'kolay',
    question: 'Türkiye’nin yüzölçümü en büyük ili hangisidir?',
    options: ['Konya', 'Sivas', 'Ankara', 'Erzurum'],
    correctIndex: 0,
    explanation: 'Konya, 38.873 km² alanı ile Türkiye’nin en büyük yüzölçümüne sahip ilidir.'
  },
  {
    id: 68,
    category: 'Genel Kültür',
    difficulty: 'zor',
    question: 'Osmanlı İmparatorluğu’nda matbaayı getiren İbrahim Müteferrika’nın bastığı ilk eser nedir?',
    options: ['Vankulu Lügati', 'Cihannüma', 'Tarih-i Naima', 'Sefaretname'],
    correctIndex: 0,
    explanation: 'İbrahim Müteferrika matbaasında basılan ilk kitap Vankulu Lügati (1729)dir.'
  },
  {
    id: 69,
    category: 'Genel Kültür',
    difficulty: 'orta',
    question: 'Kutup ışıklarına verilen bilimsel terim nedir?',
    options: ['Aurora Borealis / Australis', 'Miraj', 'Halos', 'Gün Halesi'],
    correctIndex: 0,
    explanation: 'Kuzey ışıklarına Aurora Borealis, Güney ışıklarına Aurora Australis denir.'
  },
  {
    id: 70,
    category: 'Genel Kültür',
    difficulty: 'kolay',
    question: 'Olimpiyat halkalarındaki 5 farklı renk kaç kıtayı temsil eder?',
    options: ['5 Kıta', '6 Kıta', '7 Kıta', '4 Kıta'],
    correctIndex: 0,
    explanation: 'Beş olimpik halka dünyanın 5 meskun kıtasını temsil eder.'
  },
  {
    id: 71,
    category: 'Genel Kültür',
    difficulty: 'orta',
    question: 'Pusulada "N" harfi hangi yönü gösterir?',
    options: ['Kuzey (North)', 'Güney (South)', 'Doğu (East)', 'Batı (West)'],
    correctIndex: 0,
    explanation: 'İngilizce North sözcüğünün baş harfi olan N, Kuzey yönünü gösterir.'
  },
  {
    id: 72,
    category: 'Genel Kültür',
    difficulty: 'zor',
    question: 'Dünyanın en yüksek dağı olan Everest hangi dağ sırasının içinde yer alır?',
    options: ['Himalayalar', 'Alpler', 'And Dağları', 'Kayıklık Dağları'],
    correctIndex: 0,
    explanation: 'Everest Dağı Asya kıtasındaki Himalaya dağ sırasının üzerindedir.'
  },
  {
    id: 73,
    category: 'Genel Kültür',
    difficulty: 'kolay',
    question: 'Türkiye’nin en büyük gölü hangisidir?',
    options: ['Van Gölü', 'Tuz Gölü', 'Beyşehir Gölü', 'İznik Gölü'],
    correctIndex: 0,
    explanation: 'Van Gölü 3.713 km² yüzölçümüyle Türkiye’nin en büyük gölüdür.'
  },
  {
    id: 74,
    category: 'Genel Kültür',
    difficulty: 'orta',
    question: 'Matematikte 10₺’lik banknotlarımızın arkasında resmi bulunan ünlü Türk matematikçi kimdir?',
    options: ['Cahit Arf', 'Ali Kuşçu', 'Ömer Hayyam', 'Matrakçı Nasuh'],
    correctIndex: 0,
    explanation: 'Cahit Arf (Arf değişmezi kuramcısı) 10 Türk Lirası üzerinde yer alır.'
  },
  {
    id: 75,
    category: 'Genel Kültür',
    difficulty: 'zor',
    question: 'İzmir’in kurtuluşu ve Kurtuluş Savaşı’nın zaferle sonuçlandığı tarihi gün hangisidir?',
    options: ['9 Eylül 1922', '30 Ağustos 1922', '19 Mayıs 1919', '29 Ekim 1923'],
    correctIndex: 0,
    explanation: '9 Eylül 1922 tarihi Türk ordusunun İzmir’e girerek şehri kurtardığı gündür.'
  },
  {
    id: 76,
    category: 'Genel Kültür',
    difficulty: 'kolay',
    question: 'Dünyada en çok konuşulan anadili olan dil hangisidir?',
    options: ['Mandarin Çincesi', 'İngilizce', 'İspanyolca', 'Arapça'],
    correctIndex: 0,
    explanation: 'Çince (Mandarin) anadili olarak dünyada 1 milyardan fazla kişi tarafından konuşulmaktadır.'
  },
  {
    id: 77,
    category: 'Genel Kültür',
    difficulty: 'orta',
    question: 'Türkiye’nin ilk kadın pilotu ve dünyanın ilk kadın savaş pilotu kimdir?',
    options: ['Sabiha Gökçen', 'Müzeyyen Senar', 'Afife Jale', 'Halide Edib Adıvar'],
    correctIndex: 0,
    explanation: 'Sabiha Gökçen, askeri tayyareci olarak dünyanın ilk kadın savaş pilotudur.'
  },
  {
    id: 78,
    category: 'Genel Kültür',
    difficulty: 'zor',
    question: 'Tarihte "Sivil İtaatsizlik" akımının ve Hindistan bağımsızlık hareketinin lideri kimdir?',
    options: ['Mahatma Gandhi', 'Nelson Mandela', 'Jawaharlal Nehru', 'Che Guevara'],
    correctIndex: 0,
    explanation: 'Mahatma Gandhi, şiddet karşıtı sivil direniş hareketiyle tanınır.'
  },
  {
    id: 79,
    category: 'Genel Kültür',
    difficulty: 'kolay',
    question: 'Dünya Sağlık Örgütü’nün uluslararası kısaltması nedir?',
    options: ['WHO (World Health Organization)', 'UNICEF', 'UNESCO', 'FAO'],
    correctIndex: 0,
    explanation: 'WHO (World Health Organization) BMye bağlı dünya sağlık örgütüdür.'
  },
  {
    id: 80,
    category: 'Genel Kültür',
    difficulty: 'orta',
    question: 'Türk Dünyası’nın ünlü destanı "Manas Destanı" hangi Türk boyuna aittir?',
    options: ['Kırgızlar', 'Kazaklar', 'Özbekler', 'Uygurlar'],
    correctIndex: 0,
    explanation: 'Manas Destanı Kırgız Türklerinin en büyük ulusal destanıdır.'
  },

  // MANTIK VE AKIL YÜRÜTME (81-105)
  {
    id: 81,
    category: 'Mantık',
    difficulty: 'kolay',
    question: 'Bir yarışmada 2. sıradaki koşucuyu geçerseniz kaçıncı sıraya yerleşirsiniz?',
    options: ['2. sıra', '1. sıra', '3. sıra', 'Derecesiz'],
    correctIndex: 0,
    explanation: '2. sıradaki kişinin yerini aldığınız için siz 2. olursunuz.'
  },
  {
    id: 82,
    category: 'Mantık',
    difficulty: 'orta',
    question: 'Bir baba ve oğlunun yaşları toplamı 44’tür. Baba oğlundan 24 yaş büyük olduğuna göre oğul kaç yaşındadır?',
    options: ['10', '12', '14', '20'],
    correctIndex: 0,
    explanation: 'x + (x + 24) = 44 => 2x = 20 => x = 10 yaşındadır.'
  },
  {
    id: 83,
    category: 'Mantık',
    difficulty: 'kolay',
    question: 'Sayı dizisi: 2, 4, 8, 16, 32, ? Bir sonraki sayı kaçtır?',
    options: ['64', '48', '50', '128'],
    correctIndex: 0,
    explanation: 'Her sayı bir önceki sayının 2 katıdır (32 * 2 = 64).'
  },
  {
    id: 84,
    category: 'Mantık',
    difficulty: 'orta',
    question: 'A, Bden hızlıdır. C, Bden yavaştır. En hızlı kimdir?',
    options: ['A', 'B', 'C', 'Bulunamaz'],
    correctIndex: 0,
    explanation: 'A > B ve B > C olduğuna göre A sıralamada en hızlıdır.'
  },
  {
    id: 85,
    category: 'Mantık',
    difficulty: 'zor',
    question: 'Bir sepette 5 elma var. 5 çocuğa her birine 1 elma veriliyor ama sepette 1 elma kalıyor. Bu nasıl olur?',
    options: ['Son çocuğa elma sepette verilir', 'Bir elma çürüktür', 'Elmalar yarım kesilmiştir', 'İmkansızdır'],
    correctIndex: 0,
    explanation: 'Son çocuğa kendi elması sepetin içinde uzatıldığı için sepette hala 1 elma kalmış olur.'
  },
  {
    id: 86,
    category: 'Mantık',
    difficulty: 'kolay',
    question: 'Hangi ayda 28 gün vardır?',
    options: ['Tüm aylarda', 'Sadece Şubat ayında', 'Ocak ayında', 'Mart ayında'],
    correctIndex: 0,
    explanation: 'Tüm 12 ayın hepsinde en az 28 gün mevcuttur.'
  },
  {
    id: 87,
    category: 'Mantık',
    difficulty: 'orta',
    question: 'Sayı dizisi: 3, 5, 9, 17, 33, ? Gelecek sayı kaçtır?',
    options: ['65', '49', '55', '60'],
    correctIndex: 0,
    explanation: 'Artış miktarları 2, 4, 8, 16 (2nin kuvvetleri). 33 + 32 = 65.'
  },
  {
    id: 88,
    category: 'Mantık',
    difficulty: 'zor',
    question: '3 kedi 3 fareyi 3 dakikada yakalarsa, 100 kedi 100 fareyi kaç dakikada yakalar?',
    options: ['3 dakikada', '100 dakikada', '30 dakikada', '1 dakikada'],
    correctIndex: 0,
    explanation: 'Her 1 kedi 1 fareyi 3 dakikada yakalar. Dolayısıyla 100 kedi aynı anda 100 fareyi yine 3 dakikada yakalar.'
  },
  {
    id: 89,
    category: 'Mantık',
    difficulty: 'kolay',
    question: 'Elektrikli bir tren doğudan batıya gidiyor. Rüzgar güneyden esiyorsa duman hangi yöne gider?',
    options: ['Duman çıkmaz (Elektrikli tren)', 'Kuzeye', 'Doğuya', 'Batıya'],
    correctIndex: 0,
    explanation: 'Elektrikli tren duman çıkarmaz!'
  },
  {
    id: 90,
    category: 'Mantık',
    difficulty: 'orta',
    question: 'Soru işareti yerine ne gelmelidir? (1=5, 2=25, 3=125, 4=625, 5=?)',
    options: ['1', '3125', '625', '25'],
    correctIndex: 0,
    explanation: 'Sorunun başında 1 = 5 olarak tanımlandığından, 5 = 1 olur.'
  },
  {
    id: 91,
    category: 'Mantık',
    difficulty: 'zor',
    question: 'Doktor size 3 hap verir ve her yarım saatte bir tanesini almanızı söyler. İlaçların tamamı kaç dakikada biter?',
    options: ['60 dakika', '90 dakika', '30 dakika', '120 dakika'],
    correctIndex: 0,
    explanation: '1. hap 0. dk, 2. hap 30. dk, 3. hap 60. dk alınır. Toplam süre 60 dakikadır.'
  },
  {
    id: 92,
    category: 'Mantık',
    difficulty: 'kolay',
    question: 'Gece saat 8de yattınız ve saatinizi sabah 9a kurdunuz. Kaç saat uyursunuz?',
    options: ['1 saat (Mekanik saat)', '13 saat', '9 saat', '11 saat'],
    correctIndex: 0,
    explanation: 'Mekanik kurmalı saat gece/gündüz ayırt edemediği için 1 saat sonra (saat 9da) çalar.'
  },
  {
    id: 93,
    category: 'Mantık',
    difficulty: 'orta',
    question: 'Bir terzi 16 metrelik kumaşı her gün 2 metre kesiyor. Kumaşı kaç günde tamamen parçalara ayırır?',
    options: ['7 gün', '8 gün', '6 gün', '9 gün'],
    correctIndex: 0,
    explanation: '7. gün kesim yapıldığında son 2 parça da ayrılmış olur.'
  },
  {
    id: 94,
    category: 'Mantık',
    difficulty: 'zor',
    question: 'Karanlık bir odada tek bir kibritiniz var. Odada gaz lambası, mum ve soba var. Önce hangisini yakarsınız?',
    options: ['Kibriti', 'Mumu', 'Gaz lambasını', 'Sobayı'],
    correctIndex: 0,
    explanation: 'Diğerlerini yakabilmek için öncelikle kibriti yakmanız gerekir.'
  },
  {
    id: 95,
    category: 'Mantık',
    difficulty: 'kolay',
    question: 'Musa gemisine her hayvandan kaçar tane aldı?',
    options: ['Hiç (Nuh aldı)', '2şer tane', '1er tane', '7şer tane'],
    correctIndex: 0,
    explanation: 'Tarihi inançta gemisine hayvan alan Musa değil, Nuh Peygamberdir.'
  },
  {
    id: 96,
    category: 'Mantık',
    difficulty: 'orta',
    question: 'Sayı dizisi: 1, 1, 2, 3, 5, 8, 13, ? Bir sonraki Fibonacci sayısı nedir?',
    options: ['21', '18', '20', '25'],
    correctIndex: 0,
    explanation: 'Fibonacci dizisinde her sayı kendinden önceki iki sayının toplamıdır (8 + 13 = 21).'
  },
  {
    id: 97,
    category: 'Mantık',
    difficulty: 'zor',
    question: 'Bir akvaryumda 10 balık var. 2si boğuldu, 4ü yüzdü, 3ü öldü. Akvaryumda kaç balık kaldı?',
    options: ['10 balık', '4 balık', '6 balık', '1 balık'],
    correctIndex: 0,
    explanation: 'Balıklar boğulmaz ve akvaryumdan çıkmadıkları sürece ölü ya da diri 10 balık da akvaryumdadır.'
  },
  {
    id: 98,
    category: 'Mantık',
    difficulty: 'kolay',
    question: 'Tepesinde beyaz kar olan bir dağı ne kadar tırmanırsanız kar miktarı ne olur?',
    options: ['Değişmez', 'Artar', 'Azalır', 'Erir'],
    correctIndex: 0,
    explanation: 'Dağın üzerindeki toplam kar miktarı bir insanın tırmanmasıyla değişmez.'
  },
  {
    id: 99,
    category: 'Mantık',
    difficulty: 'orta',
    question: 'Sözcük analojisi: "Kitap : Kütüphane :: Araba : ?" İşareti yerine ne gelmelidir?',
    options: ['Garaj / Otopark', 'Yol', 'Benzin', 'Tekerlek'],
    correctIndex: 0,
    explanation: 'Kitapların muhafaza edildiği yer kütüphane ise arabaların muhafaza edildiği yer garajdır.'
  },
  {
    id: 100,
    category: 'Mantık',
    difficulty: 'zor',
    question: 'Bir uçağın 100 yolcusu var. Türkiye ile Yunanistan sınırına tam çizgi üzerine düşüyor. Sağ kalanlar nereye gömülür?',
    options: ['Sağ kalanlar gömülmez!', 'Türkiyeye', 'Yunanistana', 'Taraf seçilir'],
    correctIndex: 0,
    explanation: 'Sağ kalan (yaşayan) insanlar gömülmez!'
  },
  {
    id: 101,
    category: 'Mantık',
    difficulty: 'orta',
    question: 'Ahmet’in babasının 5 oğlu var: Birincisi Fefe, ikincisi Fifi, üçüncüsü Fofo, dördüncüsü Fufu. Beşinci oğlunun adı nedir?',
    options: ['Ahmet', 'Fafa', 'Füfü', 'Fifi'],
    correctIndex: 0,
    explanation: 'Cümlenin başında "Ahmet’in babasının 5 oğlu var" denilmiştir, 5. oğul Ahmet’tir.'
  },
  {
    id: 102,
    category: 'Mantık',
    difficulty: 'kolay',
    question: 'Tüm kareler dikdörtgendir. Tüm dikdörtgenler dörtgendir. Buna göre kareler hakkında ne söylenebilir?',
    options: ['Tüm kareler dörtgendir', 'Hiçbiri dörtgen değildir', 'Bazıları üçgendir', 'Hiçbiri'],
    correctIndex: 0,
    explanation: 'Kare ⊂ Dikdörtgen ⊂ Dörtgen mantık kapsama bağıntısından tüm kareler dörtgendir.'
  },
  {
    id: 103,
    category: 'Mantık',
    difficulty: 'orta',
    question: '30u yarıma (0.5) bölüp 10 eklerseniz sonuç kaç olur?',
    options: ['70', '25', '40', '50'],
    correctIndex: 0,
    explanation: '30 / 0.5 = 60. 60 + 10 = 70.'
  },
  {
    id: 104,
    category: 'Mantık',
    difficulty: 'zor',
    question: 'Bir tartıda 1 kg pamuk mu yoksa 1 kg demir mi daha ağırdır?',
    options: ['Ağırlıkları eşittir (İkisi de 1 kg)', 'Demir', 'Pamuk', 'Hacme bağlıdır'],
    correctIndex: 0,
    explanation: 'Her ikisi de 1 kilogram olduğu için ağırlıkları eşittir.'
  },
  {
    id: 105,
    category: 'Mantık',
    difficulty: 'orta',
    question: 'Günde 24 saat olduğuna göre Akrep ve Yelkovan üst üste kaç kez gelir?',
    options: ['22 kez', '24 kez', '12 kez', '20 kez'],
    correctIndex: 0,
    explanation: 'Akrep ile yelkovan bir günde (24 saatte) 22 kez üst üste gelir.'
  }
];

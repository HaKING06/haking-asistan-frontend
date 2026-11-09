# HaKING AI Desktop

**Yazım Hatalarını Anlayan Akıllı Ürün Arama Motoru** · v0.1.2 · Halit Güneş

Masaüstü uygulaması, ödevdeki PriceRunner ürün arama problemini ölçülebilir biçimde çözer. Ek olarak, çevrimdışı yazılım hata imzası sınıflandırma ve satır bağlamı gösterimi sunar. Çevrimdışı modeller hiçbir bulut anahtarı veya hesap gerektirmez.

## Neler var?

- PriceRunner veri kümesindeki ürün başlıkları üzerinde ürün arama.
- Klasik tam terim eşleşmesi (temel yöntem), BM25, karakter 3–4 gram TF-IDF ve doğrulama kümesinde seçilmiş hibrit sıralama.
- Harf silme, ekleme, komşu harfleri değiştirme, klavyede komşu harf ve bitişik kelime hatalarıyla **600 sabit seed'li, 2–4 kelimelik sorgu**; temiz sorgular da içerir. Ürün kümesi sızıntısını engellemek için doğrulama ve test ayrımı Cluster ID ile yapılır.
- Recall@5, Recall@10, MRR ve ortalama arama süresi; yöntem ve hata türü kırılımında JSON/CSV raporu ve uygulama içinde yöntem karşılaştırma grafiği.
- Çevrimdışı yazılım hata analizi: Python, JavaScript/TypeScript, C#, Java, PHP, SQL, C/C++, Go, Rust ve HTML/CSS için yaygın hata imzaları; koddan otomatik dil tespiti; Python kodunda güvenli sözdizimi/girinti kontrolü; VS Code ve derleyici satır/sütun konumları.
- Tekli ve CSV toplu analiz; toplu çıktı seçilen dosyanın yanına yazılır.
- Model-agnostik `src/model.py` arabirimi: `predict(pandas.DataFrame) -> pandas.DataFrame`.
- İsteğe bağlı çevrimiçi HaKING AI geçişi: metin ancak kullanıcı onaylarsa panoya kopyalanır. Gönderimi kullanıcı web sitesinde kendisi yapar.

## Windows'ta başlatma

1. ZIP paketini bir klasöre çıkar.
2. Python 3.11, 3.12 veya 3.13 kurulu olsun. Windows Python kurulumunda Tcl/Tk bileşenini etkin bırak.
3. `start.bat` dosyasına çift tıkla. İlk açılışta Python paketleri kurulur; bu ilk kurulum internet bağlantısı ister. Sonraki açılışlarda uygulama ve modeller yerel çalışır.

macOS/Linux'ta Python 3.11–3.13 ve Tk kurulu olmalı; terminalde uygulama klasörüne girip `chmod +x start.sh && PYTHON_BIN=python3.13 ./start.sh` çalıştır. Sistemindeki komut `python3.13` değilse `PYTHON_BIN` değerini kurulu desteklenen sürüme göre değiştir.

Kaynak koduyla çalışmak isteyenler:

```powershell
py -3.13 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python main.py
```

## Model ve metrikleri yeniden üretme

Önceden eğitilmiş `.joblib` modelleri indirme paketine eklenir; uygulamanın normal kullanımı veri kümesini yeniden indirmez. Eğitimi ve raporları yeniden üretmek için:

```powershell
python -m pip install -r requirements.txt
python train.py
```

İlk olarak UCI sayfasından **Product Classification and Clustering** ZIP dosyasını indirip `data/raw/uci_product_837.zip` konumuna koy ve `data/raw/uci_837/pricerunner_aggregate.csv` dosyasını ZIP içinden çıkar. Sonra `train.py` çalıştır. Üretilen `models/`, `results/metrics.json`, `results/synthetic_queries.csv` ve `results/test_predictions.csv` bu cihazda kalır. Tam kaynak/lisans bilgisi [`data/KAYNAK.md`](data/KAYNAK.md) dosyasındadır.

### Ölçüm yorumu

Metrikler veri kümesindeki ürün kümeleri üzerinde ve sabit seed ile sentetik sorgularda hesaplanır. Gerçek mağaza arama trafiğini temsil ettikleri söylenemez. Hibrit ağırlık yalnızca validation split'te seçilir; nihai metrikler ayrı test split'inden hesaplanır. Model dosyası içindeki eğitim tarihi ve `results/metrics.json` ölçüm ayrıntıları uygulamanın **Model Bilgisi** sekmesinde gösterilir.

### Çevrimdışı hata çözümleme sınırı

Bu özellik tam bir LLM, derleyici veya otomatik kod tamircisi değildir. İmza kataloğundaki yaygın hatalar için olası neden ve adım adım kontrol önerisi sunar; tanınmayan iletilerde belirsizliği bildirir. Dil seçimi Otomatik iken kaynak kodu ve hata imzalarını kullanır; Python kodu yalnızca ast.parse ile ayrıştırılır. Diğer dillerde kod statik olarak okunur ve çalıştırılmaz. VS Code Ln/Col ile yaygın derleyici satır:sütun konumları gösterilir. Sonuçları doğrulamadan üretim koduna uygulama.

Çevrimiçi düğme içerikleri otomatik göndermez: onaydan sonra tanı metnini panoya kopyalar ve `https://ai.haking.tr/` adresini açar. Panoya giden kodu gözden geçir; parola, API anahtarı veya kişisel veri ekleme.

## Gizlilik ve güvenlik

- Varsayılan çalışma çevrimdışıdır; sorgu, kod ve hata mesajı bu uygulama tarafından bir sunucuya gönderilmez.
- Dosya yükleme düz metin okur; tek dosyada 64 KiB, CSV'de 20 MiB ve 5.000 satır sınırı vardır. Hiçbir dosya, eklenti veya komut çalıştırılmaz.
- Hata mesajları token, parola, e-posta veya dahili URL içerebilir. Paylaşmadan önce maskele.
- Çevrimiçi aktarımı ayrı, açık onay gerektirir ve HaKING AI'nin çevrimiçi gizlilik koşullarına tabidir.

## Lisans

Uygulama kaynak kodu MIT lisansı altındadır (`LICENSE`). UCI veri kümesi kendi CC BY 4.0 lisansına ve kaynak atfına tabidir. Python bağımlılıklarının lisansları kendi paketlerine aittir.

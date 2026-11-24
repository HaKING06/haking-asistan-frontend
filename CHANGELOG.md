# 1.0.7 — 2026-11-19

## 1.4.1 — 2026-11-24

- Halka açık sayfalardan sağlayıcı plan kotaları, ortam değişkenleri ve yönetici kurulum yönlendirmeleri çıkarıldı.
- Model durumu metinleri kullanıcı diline çevrildi; kullanıcı kredileri ve veri kullanımı açıklamaları korundu.

## 1.4.0 — 2026-11-24

- Özgün canlı mor palet geri getirildi; serif başlıklar kaldırılıp Manrope / DM Sans kullanıldı.
- Kompakt giriş ekranı, küçük çalışma alanı önizlemesi ve yerel Google düğmesiyle yenilendi.
- Yan sayfalar modern kartlar, belirgin başlıklar ve ölçülü JS/CSS geçişleriyle güncellendi. Hareket azaltma tercihi desteklenir.
- Sohbet kabuğu görünür viewport'a sabitlendi; dış sayfa kayması engellendi. VisualViewport ile klavye/tarayıcı çubuğu değişimleri izlenir. Yalnızca mesaj listesi kayar.
- Oturum açılışı ve güvenlik akışı korunur; backend sürümü 1.3.0 kalır.

## 1.3.0 — 2026-11-24

- Tüm web sayfalarına koyu mürdüm Studio tasarım sistemi, sade gezinme ve okunabilir bölüm düzeni eklendi.
- Giriş ekranı sadeleştirildi; sistemin açık tema tercihinin mor kimliği değiştirmesi kaldırıldı.
- Kayıtlı oturumda çalışma alanı hemen açılır; sunucu doğrulaması bitene kadar gönderim kapalıdır. Geçici ağ hatası oturumu silmez; yeniden deneme sunulur.
- Oturum doğrulanırken Google ve Turnstile gereksiz yere yüklenmez.
- Mobil üst çubuğa erişilebilir yeni sohbet düğmesi eklendi.

## 1.2.0 — 2026-11-21

- Google Identity Services ile Google hesabı girişi ve kayıt eklendi; aynı Gmail mevcut hesabına bağlanır.
- Giriş yöntemleri, açık/koyu tema desteği ve mobil düzen güncellendi.
- Çerez/depolama bilgi kartı, erişilebilir ayrıntılar penceresi ve kısa kayıt bildirimi eklendi; Google ve Cloudflare veri akışları açıklandı.

## 1.1.0 — 2026-11-21

- Giriş ve kayıt ekranlarına Cloudflare Turnstile doğrulaması, hata/yenileme durumları ve işlem bazlı belirteçler eklendi.
- Vercel API adresi korundu; Cloudflare veri işleme açıklaması güncellendi.

- Switch production API endpoints from Render to Vercel.

# Değişiklik geçmişi

## 1.0.6 — 2026-11-09

- Kurucu kredi paneline, e-posta önekiyle çalışan ve yalnızca kurucu oturumuyla erişilen hesap önerileri eklendi.
- Öneri seçimi doğrudan mevcut hesap doğrulama akışını başlatıyor; klavye ile seçim ve mobil görünüm destekleniyor.
- İstemci varlıkları için önbellek sürümü 1.0.6'ya çıkarıldı.

## 1.0.5 — 2026-11-09

- HaKING AI Desktop indirme paketini v0.1.2 ile güncelledi; ürün arama ve hata analizi arayüzleri yenilendi.
- İndirme sayfasındaki geliştirme süreci bölümü kaldırıldı.
- İstemci varlıkları için önbellek sürümü 1.0.5'e çıkarıldı.

## 1.0.4 — 2026-11-09

- HaKING AI Desktop Windows başlangıcında Tk yazı tipi ayrıştırma hatası düzeltildi ve indirme paketi 0.1.1 sürümüne çıkarıldı.
- İndirme sayfasının altına ders projesi kapsamı ve yapay zekâ kodlama desteğini açıklayan geliştirme notu eklendi.
- Ön yüz sürümü ve istemci önbellek etiketleri 1.0.4 ile eşitlendi.

## 1.0.3 — 2026-11-09

- HaKING AI Desktop için herkese açık indirme ve kurulum sayfası eklendi.
- Oturum açma ekranına masaüstü uygulaması indirme bağlantısı eklendi.
- Cloudflare statik varlık yayınında `node_modules`, `.wrangler`, `.git` ve ortam sırları hariç tutuldu; büyük paket dosyalarının yanlışlıkla uygulama varlığı olarak derlenmesi önlendi.
- Sürüm bilgileri ve istemci önbellek etiketleri 1.0.3 ile eşitlendi.

## 1.0.2 — 2026-11-08

- Uzun yanıt akışlarında Markdown yeniden işleme sıklığı kademeli azaltıldı; kısa yanıtlardaki hızlı görünüm korunurken uzun çıktılarda tarayıcı iş yükü düşürüldü.
- Uygulama sürümü; paket tanımları, HTML sürüm bilgisi ve önbellek yenileme etiketleriyle 1.0.2 olarak eşitlendi.
- README tek güncel sürümü gösterecek ve Türkçe olacak şekilde düzenlendi.

## 1.0.1 — 2026-11-08

- Sayfa açılışında ve sekmeye dönüşte backend sağlık kontrolü yenilendi.
- Görünür ve oturum açmış sekmede Render servisini hafifçe uyandıran istek eklendi.
- Sürüm, katkı ve güvenlik belgeleri eklendi.

## 1.0.0

- İlk yayımlanan sürüm.
- Sohbet bağlamını koruma ve yarım kalan yanıta devam etme arayüzü eklendi.

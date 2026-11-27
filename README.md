![HaKING AI](./assets/img/og-haKING-ai.svg)

# HaKING AI — Ön yüz

HaKING AI; kod yazma, kodu açıklama ve hata ayıklama için Türkçe sohbet sunan statik bir web uygulamasıdır. Bu depo, Cloudflare Workers üzerinde yayınlanan ön yüzü içerir. Güncel sürüm: **1.8.1**.

## Teknoloji ve yayınlama

- HTML, CSS ve tarayıcı JavaScript'i; kullanıcı arayüzü için ek bir uygulama çatısı kullanılmaz.
- Dağıtım ve statik dosyalar Cloudflare Workers ile sunulur.
- Giriş, kayıt, e-posta doğrulama, ayarlar, kredi ve sohbet API'leri Vercel'deki FastAPI backend servisini kullanır.
- Yerel geliştirme: `npm run dev`
- Yayın öncesi derleme kontrolü: `npm run build` (Wrangler dry-run; yayın yapmaz)
- Yayınlama: `npm run deploy`

Cloudflare yapılandırmasında depo kök dizini `/`, derleme komutu `npm run build`, dağıtım komutu `npx wrangler deploy` olmalıdır. `robots.txt` ve `sitemap.xml` kök dizinden sunulur.

## Özellikler

- Tüm sayfalarda ortak koyu Studio tasarımı; yan sayfalarda bölüm dizini, mobilde doğrudan yeni sohbet düğmesi.
- Kayıtlı oturumda giriş ekranını bekletmeden çalışma alanı kabuğu gösterilir. Sunucudan onay gelmeden mesaj gönderilemez ve geçmiş yüklenmez; iptal edilmiş oturum girişe döner. Geçici ağ hatalarında kayıtlı oturum korunur ve tekrar deneme sunulur.
- `studio.css` ortak görsel sistem, `studio.js` yan sayfa gezinmesi ve uzun metinlerin açılır ayrıntı düzenidir. Ürünün mor/koyu kimliği sistemin açık tema tercihinden bağımsızdır.

- Google hesabıyla giriş/kayıt ve ayrı Gmail/şifre yöntemi; ortak 18+ ve Turnstile kontrolü. Google client ID backend'in `/auth/google/config` yanıtından alınır, frontend'e secret konmaz.
- Geliştirilmiş çerez/depolama kartı ve klavye ile kullanılabilen ayrıntılar penceresi. Kabul işleminden sonra tekrar modal açılmaz; seçim localStorage'da saklanır. Panel gerçek depolama ve sağlayıcı davranışlarını açıklar, işlevsiz analiz/reklam anahtarları içermez.

- Giriş ve kayıt öncesi Cloudflare Turnstile doğrulaması. Her istekten sonra yeni belirteç alınır; e-posta kodu aşaması tekrar CAPTCHA istemez.

- E-posta doğrulamalı kayıt, giriş, parola sıfırlama ve hesap silme akışları.
- Groq ve Google Gemini sağlayıcılarına yönlendirilen sohbet; yanıtlar akış halinde gösterilir.
- Normal sohbet ve önce proje brief'i hazırlayıp ardından yanıt üreten, kredi kullanan Çılgın Mod.
- Uygun yeni proje isteklerinde Tavily ile web araştırması; yanıt altında kullanılan hizmetlerin ve varsa kaynakların gösterilmesi.
- Kod bloklarında kopyalama ve indirme; tek HTML dosyasını güvenli, yalıtılmış önizlemede açma; çok dosyalı yanıtları dosya sekmeleri ve ZIP olarak sunma.
- Metin/kod dosyası ekleyerek içerik inceletme. Dosyalar tarayıcıda okunur; uygulama dosyaları çalıştırmaz veya kalıcı olarak saklamaz.
- Sohbet geçmişini hesap bazında tarayıcının `localStorage` alanında tutma; ayarlar ve kredi bakiyesi görünümü.
- Zorunlu tarayıcı depolaması için çerez tercihi açıklaması; şu an analiz ve reklam izleyicisi kullanılmaz.
- Mobil uyumlu koyu arayüz, gizlilik/hakkında sayfaları ve HaKING marka varlıkları.
- Herkese açık `download.html` sayfasında HaKING AI Desktop ZIP paketi, sistem gereksinimleri, kurulum, veri kaynağı, çevrimdışı kapsam ve güvenlik açıklamaları.

## Yanıt akışı ve hız

Sohbet, backend'den Server-Sent Events (SSE) akışı alır. Uzun yanıtlar boyunca Markdown'ı her gelen küçük parçada yeniden işlemek pahalı olduğundan, yanıt uzadıkça ekrandaki yeniden çizim sıklığı kademeli azaltılır; tamamlandığında son içerik hemen işlenir. Bu, uzun kod yanıtlarında tarayıcı tarafındaki gereksiz işi azaltır. Modelin üretim süresini, sağlayıcı kotasını veya Render'ın ücretsiz plandaki soğuk başlangıçlarını ortadan kaldırmaz.

Çılgın Mod'daki aşama göstergeleri işlemin hangi adımda olduğunu bildirir; modelin özel düşünme içeriğini göstermez. Yeni proje isteğinde araştırma açıksa Tavily kısa kaynak parçalarını brief aşamasına ekler. Kısa bilgi soruları ve mevcut kodu düzeltme istekleri proje araştırması akışına yönlendirilmez.

## Gizlilik ve güvenlik

- Backend anahtarlarını (`GROQ_API_KEY`, `GEMINI_API_KEY`, isteğe bağlı `TAVILY_API_KEY`, `RESEND_API_KEY`, veritabanı adresleri ve imzalama sırları) yalnızca özel Vercel ortam değişkenlerinde saklayın. Bu depoya veya Cloudflare ön yüz değişkenlerine koymayın.
- Oturum belirteci ve hesap bazlı sohbet geçmişi tarayıcı `localStorage` alanında tutulur; sohbet metni uygulama veritabanında arşivlenmez. Mesajlar yanıt üretmek için backend'e ve seçilen AI sağlayıcısına iletilir; yedek sağlayıcıya geçişte aynı istek ona da gönderilebilir.
- Sohbet eki olarak tek bir izinli metin/kod dosyası, en fazla 64 KiB olacak şekilde gönderilebilir. Gizli anahtar algılama sınırlı bir önlemdir; dosyaya parola, API anahtarı veya paylaşılmaması gereken veri koymayın.
- Üretilen HTML önizlemesi yalıtılmış iframe içinde çalıştırılır. Üretilen kodu indirmeden/çalıştırmadan önce inceleyin.
- Gizlilik sayfası sağlayıcıları ve mevcut veri akışlarını açıklar. Dağıtım ortamındaki gerçek yapılandırmayla belgeleri eşleşir tutun.

Backend'in yapılandırma ve yayınlama ayrıntıları backend deposundaki README'de yer alır. Güvenlik bildirimi için [`SECURITY.md`](./SECURITY.md), katkı kuralları için [`CONTRIBUTING.md`](./CONTRIBUTING.md), sürüm notları için [`CHANGELOG.md`](./CHANGELOG.md) dosyalarını inceleyin.

## Marka varlıkları

Güncel kimlik; taçlı mor kaplumbağa maskotunu, site simgelerini, sosyal medya görsellerini ve kredi paketi afişlerini içerir. Küçük arayüz simgelerinde maskotun sade baş görseli, büyük tanıtım çalışmalarında tam gövde görseli kullanılır. Paket fiyatı veya içeriği değişirse ilgili afişleri de güncelleyin. Kullanım notları `assets/brand/BRAND-GUIDE.md` dosyasındadır.

## Sürümleme

Güncel sürüm `1.8.1`'dır. Önceki sürümler yalnızca [`CHANGELOG.md`](./CHANGELOG.md) içinde yer alır. Sürüm numarasını `package.json`, `package-lock.json`, HTML varlık sürüm etiketleri ve uygulama bilgi ekranıyla eşleştirin.


## Sohbetle Prompt Atölyesi (1.6.0)

Prompt Modu'nda isteğini doğrudan yaz. Asistan agent, model, araç erişimi ve özel talimatları gerektiğinde
sohbet içinde sorar. Hazır görev kartı gösterilince küçük üretim düğmesi etkinleşir. Nihai üretim 5 kredidir.
Yeni görev düğmesi önceki prompttan bağımsız bir bağlam açar. Eski konuşmalar görünür kalır; yeni göreve gönderilmez.
Yeni moda ilk girişte önceki normal/çılgın sohbet otomatik gereksinim olarak alınmaz.


## Prompt karar belleği (1.8.1)

Görev kartı `prompt_state` ile sonraki tura taşınır. Prompt oturumunun kimliği, verilen kararlar ve hazırlık durumu
bu cihazdaki sohbet kaydında korunur; normal sohbet ve diğer prompt görevleri bu kapsama karışmaz.
Gerekli alanlar eksikken sorular ücretsizdir. Model/araç seçimini asistana bırakmak ilerlemeyi engellemez.
Codex model önerileri resmî model sayfasından günlük önbellekle kontrol edilir; canlı kaynak yoksa
24 Kasım 2026 doğrulanmış kaydı ve tarihi açıklanır. Hesapta görünmeyen model veya sınırsız Pro kotası vaat edilmez.
Nihai prompt istemini sohbetten yazmak da üretimi başlatabilir; eksik hedef/agent/platform varsa kredi alınmadan soru sorulur.
İç görev analizi ve denetim JSON çıktı moduyla yapılır. Kesilmiş JSON parçaları farklı sağlayıcılardan birleştirilmez.
Üretim sağlayıcıları ücretsiz katmanlı mevcut Groq/Gemini modelleridir; OpenAI ücretli API isteği eklenmez.

### Ortak krediler
Çılgın Mod isteği 10, Prompt Modu nihai üretimi 5 HaKING kredisi kullanır. İki mod aynı bakiyeden harcar; keşif ve normal sohbet ücretsizdir.

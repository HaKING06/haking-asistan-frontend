# Veri kaynağı ve lisans

## PriceRunner ürün verisi

- Kaynak: UCI Machine Learning Repository, **Product Classification and Clustering**.
- Veri kümesi: PriceRunner ürün teklifleri, 35.311 satır.
- DOI: `10.24432/C5M91Z`
- Sayfa: <https://archive.ics.uci.edu/dataset/837/product+classification>
- İndirme: <https://archive.ics.uci.edu/static/public/837/product%2Bclassification%2Band%2Bclustering.zip>
- Lisans: **CC BY 4.0**. Yeniden dağıtımda kaynağı ve lisans bilgisini koruyun.
- Bu kopya 9 Kasım 2026 tarihinde indirildi. Özgün dosya `data/raw/` altında tutulur ve indirme paketine eklenmez.

Eğitim, ürün başlıklarını arama belgeleri olarak kullanır. Küme kimliği hedef ürünün gerçek etiketidir. Sentetik yazım hatalı sorgular sabit seed ile üretilir; kümeye göre doğrulama/test ayrımı yapılır. Bu sentetik sorgular kullanıcı davranışını temsil ettiği iddiasında değildir.

## Hata sınıflandırıcısı

Hata modeli, `src/error_analyzer.py` içindeki düzenlenebilir, yapay hata imzası örnekleriyle eğitilir. Bunlar sentetik test örnekleridir; gerçek kullanıcı verisi, özel kod tabanı veya derleyici çıktısı değildir. Model her hata türünü veya her dil sürümünü kapsadığı iddiasında bulunmaz.

## Kaynak kodu ve atıf

UCI veri kümesi atfı: Product Classification and Clustering, UCI Machine Learning Repository, DOI: 10.24432/C5M91Z, CC BY 4.0. Lisans koşullarını veri kümesini yeniden dağıtmadan önce kaynak sayfasından tekrar doğrulayın.

# quicklify

> [English](README.md) | Türkçe

![Tests](https://github.com/omrfc/quicklify/actions/workflows/ci.yml/badge.svg)
[![Coverage](https://codecov.io/gh/omrfc/quicklify/branch/main/graph/badge.svg)](https://codecov.io/gh/omrfc/quicklify)
![npm](https://img.shields.io/npm/v/quicklify)
![Downloads](https://img.shields.io/npm/dw/quicklify)
![License](https://img.shields.io/badge/license-MIT-blue)
![GitHub stars](https://img.shields.io/github/stars/omrfc/quicklify?style=flat-square)
[![Socket Badge](https://socket.dev/api/badge/npm/package/quicklify)](https://socket.dev/npm/package/quicklify)

> Coolify'i tek bir komutla bulut VPS'e deploy edin

## 🚀 Quicklify Nedir?

Quicklify, [Coolify](https://coolify.io/) kurulumunu bulut VPS sağlayıcılarında otomatikleştiren bir CLI aracıdır. Coolify, Vercel/Netlify/Heroku'ya açık kaynaklı, kendi sunucunuzda barındırılan bir alternatiftir — Quicklify ise Coolify'i VPS'inize tek bir komutla kurar.

**Quicklify Olmadan:**

```
VPS'i manuel oluştur (5 dk)
Sunucuya SSH ile bağlan (2 dk)
Docker kur (10 dk)
Güvenlik duvarını yapılandır (5 dk)
Coolify'i kur (10 dk)
Toplam: ~30 dakika + manuel iş
```

**Quicklify ile:**

```bash
npx quicklify init
# Hetzner: ~4 dk | DigitalOcean: ~6 dk | Vultr: ~5 dk | Linode: ~6 dk
# Sıfır manuel iş ✨
```

## ✨ Özellikler

- 🎯 **Tek Komut Deploy** - VPS + Coolify tek bir komutla
- 💰 **Maliyet Tasarrufu** - $50-200/ay (Vercel/Netlify) → €3.79/ay
- 🔒 **Varsayılan Güvenlik** - Otomatik güvenlik yapılandırması
- 🌍 **Çoklu Bulut** - Hetzner Cloud, DigitalOcean, Vultr, Linode
- 💻 **Şık CLI** - Doğrulama destekli interaktif arayüz
- 🎨 **ARM64 Desteği** - Uygun fiyatlı ARM sunucu desteği
- ⚡ **Hızlı Kurulum** - Hetzner ~4 dk, DigitalOcean ~6 dk, Vultr ~5 dk, Linode ~6 dk
- ✨ **Dinamik Sunucu Tipleri** - Seçilen konum için yalnızca uyumlu tipler gösterilir
- 🔥 **Otomatik Güvenlik Duvarı** - 8000, 22, 80, 443 portları otomatik yapılandırılır
- 🚀 **SSH Gerektirmez** - Kurulumdan sonra doğrudan tarayıcıda açılır
- 📋 **Sunucu Yönetimi** - Listeleme, durum kontrolü, silme, yeniden başlatma, yedekleme, geri yükleme komutları
- 🔧 **Varsayılan Ayarlar** - Tekrarlayan soruları atlamak için varsayılanları belirleyin
- 🔑 **SSH Erişimi** - Sunuculara bağlanın veya uzaktan komut çalıştırın
- 🔄 **Coolify Güncelleme** - Coolify'i tek komutla güncelleyin
- 🏥 **Sağlık Kontrolü Yoklaması** - Coolify'in ne zaman hazır olduğunu algılar (artık körlemesine bekleme yok)
- 📊 **Sunucu İzleme** - CPU/RAM/Disk kullanımı ve Docker konteyner durumu
- 📜 **Log Görüntüleyici** - Coolify, Docker veya sistem loglarını takip moduyla görüntüleyin
- 🩺 **Ortam Doktoru** - Yerel kurulum sorunlarını teşhis edin
- 🫀 **Toplu Sağlık Kontrolü** - Tüm sunucuları aynı anda kontrol edin
- 🔥 **Güvenlik Duvarı Yönetimi** - UFW kurulumu, port ekleme/kaldırma, korumalı port güvenliği
- 🌐 **Domain Yönetimi** - Domain bağlama, DNS kontrolü, Coolify üzerinden otomatik SSL
- 🛡️ **SSH Güçlendirme** - Şifre girişini devre dışı bırakma, fail2ban, güvenlik denetimi ve puan
- 🧪 **Kuru Çalıştırma Modu** - Güvenlik duvarı/domain/güvenlik/yedekleme/geri yükleme komutlarını çalıştırmadan önce önizleyin
- 💾 **Yedekleme & Geri Yükleme** - Veritabanı + yapılandırma yedeklemesi SCP ile indirme, çift onaylı geri yükleme
- 📦 **Dışa/İçe Aktarma** - Sunucu listesini makineler arasında JSON olarak aktarın
- ⚡ **Tam Kurulum** - `--full-setup` bayrağı deploy sonrası güvenlik duvarı + SSH güçlendirmesini otomatik yapılandırır
- 📄 **YAML Yapılandırma** - `quicklify init --config quicklify.yml` ile tek komutluk deploy
- 📋 **Şablonlar** - `--template starter|production|dev` ile sağlayıcıya özel varsayılanlar
- 🤖 **Etkileşimsiz Mod** - `--provider --token --region --size --name` bayraklarıyla CI/CD uyumlu
- ➕ **Mevcut Sunucu Ekleme** - `quicklify add` ile mevcut Coolify sunucularını kaydedin
- 🔄 **Toplu İşlemler** - `--all` bayrağı ile status, update, backup komutlarını tüm sunucularda çalıştırın
- 🔁 **Otomatik Yeniden Başlatma** - `status --autostart` sunucu çalışıyor ama Coolify kapalıysa yeniden başlatır
- 🔧 **Tam Bakım** - `quicklify maintain` ile status, update, health check, reboot sıralı çalışır

## 🎯 Quicklify ile Neler Yapabilirsiniz?

### Dakikalar İçinde Coolify Sunucusu Kurun

```bash
npx quicklify init                              # İnteraktif kurulum
npx quicklify init --provider hetzner --full-setup  # Otomatik güvenlik duvarı + SSH güçlendirme
npx quicklify init --template production         # Üretime hazır varsayılanlar
npx quicklify init --config quicklify.yml        # YAML dosyasından yapılandırma
```

### Sunucularınızı Yönetin

```bash
quicklify list                    # Tüm kayıtlı sunucuları listele
quicklify status sunucum          # Sunucu + Coolify durumunu kontrol et
quicklify status --all            # Tüm sunucuları aynı anda kontrol et
quicklify ssh sunucum             # Sunucuya SSH ile bağlan
quicklify ssh sunucum -c "uptime" # Uzaktan komut çalıştır
```

### Her Şeyi Güncel & Sağlıklı Tutun

```bash
quicklify update sunucum          # Coolify'i son sürüme güncelle
quicklify restart sunucum         # Sunucuyu yeniden başlat
quicklify maintain sunucum        # Tam bakım: durum → güncelle → sağlık → yeniden başlat
quicklify maintain --all          # Tüm sunucuları sırayla bakımdan geçir
quicklify health                  # Tüm sunucular için hızlı sağlık kontrolü
```

### Yedekleme & Geri Yükleme

```bash
quicklify backup sunucum          # Veritabanı + yapılandırma dosyalarını yedekle
quicklify backup --all            # Tüm sunucuları yedekle
quicklify restore sunucum         # Yedekten geri yükle
quicklify export servers.json     # Sunucu listesini dışa aktar
quicklify import servers.json     # Başka makinede içe aktar
```

### Güvenlik & Ağ

```bash
quicklify firewall setup sunucum      # UFW'yi Coolify portlarıyla yapılandır
quicklify domain add sunucum --domain coolify.example.com  # Domain bağla + SSL
quicklify secure setup sunucum        # SSH güçlendirme + fail2ban
quicklify secure audit sunucum        # Güvenlik denetimi ve puanlama (0-4)
```

### İzleme & Teşhis

```bash
quicklify monitor sunucum         # Canlı CPU/RAM/Disk kullanımı
quicklify logs sunucum -f         # Coolify loglarını gerçek zamanlı takip et
quicklify doctor                  # Yerel ortamı kontrol et
quicklify status sunucum --autostart  # Coolify kapalıysa otomatik yeniden başlat
```

## 📦 Kurulum

### npx ile (Önerilen)

```bash
npx quicklify init
```

### Global Kurulum

```bash
npm install -g quicklify
quicklify init
```

## 🎬 Hızlı Başlangıç

### Adım 1: API Token Alın

**Hetzner Cloud:**

1. [Hetzner Konsolu](https://console.hetzner.cloud/)'nu ziyaret edin
2. Projenizi seçin
3. Security → API Tokens bölümüne gidin
4. "Generate API Token" butonuna tıklayın
5. İzinleri **Read & Write** olarak ayarlayın
6. Token'ı kopyalayın (yalnızca bir kez gösterilir!)

**DigitalOcean:**

1. [DigitalOcean API](https://cloud.digitalocean.com/account/api/tokens) sayfasını ziyaret edin
2. **Read & Write** kapsamında yeni token oluşturun
3. Token'ı kopyalayın

**Vultr:**

1. [Vultr API](https://my.vultr.com/settings/#settingsapi) sayfasını ziyaret edin
2. API'yi etkinleştirin ve API Key'i kopyalayın
3. IP adresinizi beyaz listeye ekleyin

**Linode (Akamai):** ⚠️ *Beta — henüz gerçek deployment ile test edilmedi*

1. [Linode API Tokens](https://cloud.linode.com/profile/tokens) sayfasını ziyaret edin
2. **Read/Write** kapsamında Personal Access Token oluşturun
3. Token'ı kopyalayın

### Adım 2: Coolify'i Deploy Edin

```bash
npx quicklify init
```

Sizden şunlar istenecek:

- ✅ **API Token** - Bulut sağlayıcı token'ınızı yapıştırın
- ✅ **Bölge** - Veri merkezi konumunu seçin
- ✅ **Sunucu Boyutu** - VPS özelliklerini seçin (CAX11 önerilir)
- ✅ **Sunucu Adı** - Örneğinize isim verin

### Adım 3: Coolify'e Erişin

Deploy sonrası (Hetzner ~4 dk, DigitalOcean ~6 dk, Vultr ~5 dk, Linode ~6 dk):

```
✅ Deployment Successful!
Server IP: 123.45.67.89
Access Coolify: http://123.45.67.89:8000
```

URL'yi ziyaret edin, admin hesabınızı oluşturun ve deploy etmeye başlayın!

## 🔒 Güvenlik Notları

**Önemli:** Port 8000, deploy sonrası herkese açıktır.

**Önerilen sonraki adımlar:**
1. **Tek komut kurulum:** `quicklify init --full-setup` (otomatik güvenlik duvarı + SSH güçlendirme)
2. **Veya manuel:** `quicklify firewall setup my-server`
3. **Domain ekleyin:** `quicklify domain add my-server --domain example.com`
4. **SSH güçlendirin:** `quicklify secure setup my-server`
5. **Güvenlik denetimi çalıştırın:** `quicklify secure audit my-server`
6. **Yedek oluşturun:** `quicklify backup my-server`
7. İlk girişte **güçlü bir şifre** belirleyin
8. DDoS koruması için **Cloudflare** kullanmayı düşünün

## 🌐 Desteklenen Sağlayıcılar

| Sağlayıcı | Durum | Başlangıç Fiyatı | Mimari |
|------------|-------|-------------------|--------|
| **Hetzner Cloud** | ✅ Mevcut | €3.79/ay | ARM64 + x86 |
| **DigitalOcean** | ✅ Mevcut | $12/ay | x86 |
| **Vultr** | ✅ Mevcut | $6/ay | x86 |
| **Linode (Akamai)** | ⚠️ Beta | $12/ay | x86 |

> **Not:** Linode desteği **beta** aşamasındadır — henüz gerçek deployment ile test edilmemiştir. Sorun bildirmek için [issue açın](https://github.com/omrfrkcpr/quicklify/issues).

## 💡 Kullanım Senaryoları

**Şunlar için ideal:**

- 🚀 Yan projeler ve MVP'ler
- 💼 Müşteri deploy'ları (serbest çalışanlar/ajanslar)
- 🎓 DevOps ve self-hosting öğrenmek
- 💸 Bulut barındırma maliyetlerini düşürmek
- 🏢 Küçük ekip iç araçları

**Alternatifleri ne zaman tercih etmeli:**

- Büyük kurumsal? → Coolify Cloud veya kurumsal PaaS
- Aşırı ölçek? → Kubernetes + yönetilen servisler

## 📊 Maliyet Karşılaştırması

| Çözüm | Aylık Maliyet | Kurulum Süresi | Yönetim |
|--------|---------------|----------------|---------|
| Vercel (Hobby) | $20+ | 5 dk | Kolay |
| Vercel (Pro) | $50+ | 5 dk | Kolay |
| Netlify (Pro) | $19+ | 5 dk | Kolay |
| **Quicklify + Hetzner** | **€3.79** | **~4 dk** | **Kolay** |
| **Quicklify + DigitalOcean** | **$12** | **~6 dk** | **Kolay** |
| **Quicklify + Vultr** | **$6** | **~5 dk** | **Kolay** |
| **Quicklify + Linode** | **$12** | **~6 dk** | **Kolay** |
| Manuel VPS + Coolify | €3.79 | 30+ dk | Zor |

**Tasarruf: Proje başına yılda ~$180-240!** 💰

## 📋 Son Güncellemeler

### v1.0.0 (2026-02-23)
- **Yeni sağlayıcılar:** Vultr ve Linode (Akamai) — artık 4 bulut sağlayıcı destekleniyor
- **Yeni komut:** `quicklify add` — mevcut Coolify sunucularını Quicklify yönetimine kaydedin
- **Yeni komut:** `quicklify maintain` — tam bakım döngüsü (status, update, health, reboot)
- **Toplu işlemler:** `--all` bayrağı `status`, `update`, `backup` komutlarında — tüm sunucularda aynı anda çalıştırın
- **Otomatik yeniden başlatma:** `status --autostart` — sunucu çalışıyor ama Coolify kapalıysa yeniden başlatır
- **`collectProviderTokens()`** — her sağlayıcının token'ını tüm sunucular boyunca yalnızca bir kez sorar
- 45 test paketi genelinde 947 test, %98+ statement coverage, sıfır yeni bağımlılık

### v0.9.0 (2026-02-21)
- **YAML Yapılandırma:** `quicklify init --config quicklify.yml` - yapılandırma dosyasından deploy
- **Şablonlar:** `--template starter|production|dev` - sağlayıcıya özel önceden tanımlı sunucu yapılandırmaları
- **Yapılandırma birleştirme:** Öncelik sırası: CLI bayrakları > YAML değerleri > şablon varsayılanları > interaktif sorular
- **Güvenlik:** YAML'daki token alanları algılanır ve uyarılır (token'ları yapılandırma dosyalarında saklamayın)
- 1 yeni bağımlılık (js-yaml), %98+ statement coverage ile 742 test

### v0.8.0 (2026-02-21)
- **Yeni komutlar:** `quicklify backup`, `quicklify restore`, `quicklify export`, `quicklify import`
- **Yedekleme:** pg_dump + yapılandırma arşivi, SCP ile `~/.quicklify/backups/` dizinine indirme, manifest.json metadata
- **Geri yükleme:** Yedeği sunucuya yükleme, Coolify'i durdur/başlat, DB + yapılandırma geri yükleme, çift onaylı güvenlik
- **Dışa/İçe aktarma:** `servers.json` dosyasını makineler arasında aktarma, kopya algılama, format doğrulama
- **`--full-setup` bayrağı:** `quicklify init --full-setup` deploy sonrası güvenlik duvarı + SSH güçlendirmesini otomatik yapılandırır
- Sıfır yeni bağımlılık, %98+ statement coverage ile 636 test

### v0.7.0 (2026-02-20)
- **Yeni komutlar:** `quicklify firewall`, `quicklify domain`, `quicklify secure`
- **Güvenlik duvarı yönetimi:** UFW kurulumu, port ekleme/kaldırma, korumalı port 22 güvenliği, Coolify port uyarıları
- **Domain yönetimi:** Coolify'e domain bağlama, DNS A kaydı kontrolü, otomatik SSL
- **SSH güçlendirme:** Şifre girişini devre dışı bırakma, yalnızca anahtar ile root girişi, fail2ban, 0-4 puan güvenlik denetimi
- **Kuru çalıştırma modu:** `--dry-run` bayrağı tüm komutları çalıştırmadan önizler
- Sıfır yeni bağımlılık, %97+ statement coverage ile 494 test

### v0.6.0 (2026-02-20)
- **Yeni komutlar:** `quicklify logs`, `quicklify monitor`, `quicklify health`, `quicklify doctor`
- **Log görüntüleyici:** `--follow` ile gerçek zamanlı akış ile Coolify/Docker/sistem loglarını görüntüleme
- **Sunucu izleme:** CPU/RAM/Disk kullanımı ve Docker konteyner listesi
- **Toplu sağlık kontrolü:** Tüm kayıtlı sunucuları yanıt süreleriyle aynı anda kontrol etme
- **Ortam doktoru:** Node.js, SSH, yapılandırma sorunlarını yerel olarak teşhis etme
- Sıfır yeni bağımlılık, %97+ statement coverage ile 354 test

### v0.5.0 (2026-02-20)
- **Yeni komutlar:** `quicklify config`, `quicklify ssh`, `quicklify update`, `quicklify restart`
- **Varsayılan yapılandırma:** `quicklify config set` ile sağlayıcı, bölge, boyut varsayılanlarını ayarlayın
- **SSH erişimi:** `quicklify ssh` ile sunuculara bağlanın veya `--command` ile komut çalıştırın
- **Coolify güncelleme:** `quicklify update` ile SSH üzerinden Coolify güncelleyin
- **Sunucu yeniden başlatma:** `quicklify restart` ile sağlayıcı API üzerinden yeniden başlatma
- %97+ statement coverage ile 311 test

### v0.4.0 (2026-02-20)
- **Yeni komutlar:** `quicklify list`, `quicklify status [sorgu]`, `quicklify destroy [sorgu]`
- **Etkileşimsiz mod:** CI/CD için `quicklify init --provider --token --region --size --name`
- **Sağlık kontrolü yoklaması:** Körlemesine bekleme yerine Coolify'in hazır olduğunu algılar
- %97+ statement coverage ile 246 test

### v0.3.1 (2026-02-19)
- Hetzner fiyatlandırması artık net fiyatları (KDV hariç) gösteriyor, web sitesi gösterimiyle uyumlu
- Hetzner sunucu tipleri konum başına gerçek uygunluk için `/datacenters` API'sini kullanıyor
- Kullanımdan kaldırılan Hetzner sunucu tipleri değiştirildi (cpx→cx23/cx33)
- "Sunucu adı zaten kullanılıyor" hatası artık yeni ad girmek için yönlendiriyor
- Konum devre dışı yeniden deneme artık sunucu tipi için tekrar soruyor

### v0.3.0 (2026-02-19)
- DigitalOcean sağlayıcı desteği (tam API entegrasyonu)
- İnteraktif sağlayıcı seçimi (Hetzner / DigitalOcean)
- Tüm sorularda adım bazlı geri navigasyon
- DigitalOcean cloud-init güvenilirliği için ağ bekleme döngüsü + kurulum loglama

## 🗺️ Yol Haritası

### v0.1.0 (Tamamlandı)

- [x] Hetzner Cloud entegrasyonu
- [x] İnteraktif CLI
- [x] Otomatik Coolify kurulumu
- [x] ARM64 desteği

### v0.2.0 (Tamamlandı)

- [x] Dinamik sunucu tipi filtreleme
- [x] Otomatik güvenlik duvarı yapılandırması
- [x] Fiyat formatlama düzeltmesi

### v0.2.x (Tamamlandı)

- [x] Kullanımdan kaldırılan sunucu tipi filtreleme
- [x] Kullanılamayan sunucu tiplerinde yeniden deneme
- [x] Dinamik deploy özeti
- [x] Dinamik önerilen seçim
- [x] Codecov entegrasyonu ve coverage rozeti
- [x] ESLint + Prettier kod kalite araçları
- [x] Sıfır `any` tipi - tam tip güvenliği

### v0.3.0 (Tamamlandı)

- [x] DigitalOcean desteği
- [x] İnteraktif sağlayıcı seçimi arayüzü
- [x] Adım bazlı geri navigasyon
- [x] Cloud-init güvenilirlik iyileştirmeleri (ağ bekleme, loglama)

### v0.4.0 (Tamamlandı)

- [x] Sunucu yönetim komutları (list, status, destroy)
- [x] CI/CD için etkileşimsiz mod
- [x] Coolify sağlık kontrolü yoklaması (körlemesine bekleme yerine)
- [x] Sunucu kaydı kalıcılığı (`~/.quicklify/servers.json`)
- [x] Provider arayüzünde `destroyServer()`
- [x] Silme için çift onaylı güvenlik

### v0.5.0 (Tamamlandı)

- [x] Varsayılan yapılandırma yönetimi (`quicklify config`)
- [x] Sunuculara SSH erişimi (`quicklify ssh`)
- [x] SSH üzerinden Coolify güncelleme (`quicklify update`)
- [x] Sağlayıcı API üzerinden sunucu yeniden başlatma (`quicklify restart`)
- [x] Paylaşılan sunucu seçimi ve token yardımcı araçları (DRY refaktör)

### v0.6.0 (Tamamlandı)

- [x] Sunucu izleme - CPU/RAM/Disk kullanımı (`quicklify monitor`)
- [x] Log görüntüleyici - Coolify/Docker/sistem logları (`quicklify logs`)
- [x] Tüm sunucular için toplu sağlık kontrolü (`quicklify health`)
- [x] Ortam teşhis (`quicklify doctor`)
- [x] Gerçek zamanlı log takibi için SSH akışı

### v0.7.0 (Tamamlandı)

- [x] Güvenlik duvarı yönetimi - UFW kurulumu, port ekleme/kaldırma (`quicklify firewall`)
- [x] Domain yönetimi - Domain bağlama, DNS kontrolü, SSL (`quicklify domain`)
- [x] SSH güçlendirme - Şifre devre dışı, fail2ban, güvenlik denetimi (`quicklify secure`)
- [x] Tüm güvenlik komutları için kuru çalıştırma modu

### v0.8.0 (Tamamlandı)

- [x] Coolify veritabanı + yapılandırma yedeklemesi (`quicklify backup`)
- [x] Çift onaylı yedekten geri yükleme (`quicklify restore`)
- [x] Sunucu listesi dışa/içe aktarma (`quicklify export`, `quicklify import`)
- [x] init sırasında otomatik güvenlik duvarı + SSH güçlendirme için `--full-setup` bayrağı

### v0.9.0 (Tamamlandı)

- [x] Tek komutluk deploy için YAML yapılandırma dosyası (`quicklify.yml`)
- [x] Şablon sistemi (`--template starter|production|dev`)
- [x] Öncelikli yapılandırma birleştirme: CLI > YAML > şablon > interaktif

### v1.0.0 (Tamamlandı)

- [x] Vultr sağlayıcı desteği
- [x] Linode (Akamai) sağlayıcı desteği
- [x] `quicklify add` — mevcut Coolify sunucularını kaydetme
- [x] `quicklify maintain` — tam bakım döngüsü
- [x] status, update, backup için `--all` bayrağı
- [x] `status --autostart` — Coolify kapalıysa otomatik yeniden başlatma

### Gelecek
- [ ] `quicklify snapshot` — bakım öncesi otomatik VPS snapshot'ları
- [ ] `init --mode production` — 2 sunuculu deploy (Coolify + worker)
- [ ] İnteraktif TUI kontrol paneli

## 🛠️ Teknoloji Altyapısı

- **Çalışma Ortamı:** Node.js 20+
- **Dil:** TypeScript
- **CLI Çatısı:** Commander.js
- **İnteraktif Sorular:** Inquirer.js
- **Stil:** Chalk (renkler) + Ora (yüklenme animasyonları)
- **HTTP İstemcisi:** Axios
- **YAML Ayrıştırıcı:** js-yaml
- **Bulut API'leri:** Hetzner Cloud API v1, DigitalOcean API v2, Vultr API v2, Linode API v4
- **Linting:** ESLint 10 + typescript-eslint
- **Formatlama:** Prettier

## 📖 CLI Referansı

### Komutlar

```bash
# Yeni Coolify örneği deploy et (interaktif)
quicklify init

# Etkileşimsiz deploy (CI/CD uyumlu)
export HETZNER_TOKEN="your-api-token"
quicklify init --provider hetzner --region nbg1 --size cax11 --name my-server

# Otomatik güvenlik duvarı + SSH güçlendirme ile deploy
quicklify init --full-setup

# YAML yapılandırma dosyasından deploy
quicklify init --config quicklify.yml

# Şablon kullanarak deploy
quicklify init --template production --provider hetzner

# Tüm kayıtlı sunucuları listele
quicklify list

# Sunucu ve Coolify durumunu kontrol et
quicklify status 123.45.67.89
quicklify status my-server
quicklify status --all                   # Tüm sunucuları aynı anda kontrol et
quicklify status my-server --autostart   # Coolify kapalıysa yeniden başlat

# Sunucu sil (çift onay ile)
quicklify destroy 123.45.67.89
quicklify destroy my-server

# Sunucuyu yerel ayarlardan kaldır (bulut sunucuyu silmeden)
quicklify remove sunucum
quicklify remove 123.45.67.89

# Varsayılan yapılandırmayı yönet
quicklify config set provider hetzner
quicklify config set region nbg1
quicklify config get provider
quicklify config list
quicklify config reset

# Sunucuya SSH ile bağlan
quicklify ssh my-server
quicklify ssh 123.45.67.89 -c "docker ps"

# Sunucudaki Coolify'i güncelle
quicklify update my-server
quicklify update --all                   # Tüm sunucuları sırayla güncelle

# Sunucuyu yeniden başlat
quicklify restart my-server

# Coolify loglarını görüntüle (son 50 satır)
quicklify logs my-server

# Coolify loglarını gerçek zamanlı takip et
quicklify logs my-server --follow

# Docker veya sistem loglarını görüntüle
quicklify logs my-server --service docker --lines 100
quicklify logs my-server --service system

# CPU/RAM/Disk kullanımını göster
quicklify monitor my-server

# Docker konteynerleriyle kullanımı göster
quicklify monitor my-server --containers

# Tüm sunucuların sağlığını kontrol et
quicklify health

# Ortam teşhisi çalıştır
quicklify doctor

# Güvenlik duvarı yönetimi
quicklify firewall setup my-server           # UFW kur + Coolify portlarını aç
quicklify firewall add my-server --port 3000  # 3000/tcp portunu aç
quicklify firewall add my-server --port 53 --protocol udp  # 53/udp portunu aç
quicklify firewall remove my-server --port 3000  # 3000 portunu kapat
quicklify firewall list my-server             # Güvenlik duvarı kurallarını göster
quicklify firewall status my-server           # UFW aktif/pasif durumu
quicklify firewall setup my-server --dry-run  # Çalıştırmadan önizle

# Domain yönetimi
quicklify domain add my-server --domain example.com     # Domain bağla + HTTPS
quicklify domain add my-server --domain example.com --no-ssl  # Yalnızca HTTP
quicklify domain remove my-server             # IP:8000'e geri dön
quicklify domain check my-server --domain example.com   # DNS doğrula
quicklify domain list my-server               # Mevcut domain'i göster
quicklify domain add my-server --domain example.com --dry-run  # Önizle

# SSH güçlendirme ve güvenlik
quicklify secure status my-server            # Güvenlik ayarlarını göster
quicklify secure audit my-server             # Güvenlik puanı (0-4)
quicklify secure setup my-server             # SSH güçlendir + fail2ban kur
quicklify secure setup my-server --port 2222  # SSH portunu değiştir
quicklify secure setup my-server --dry-run    # Çalıştırmadan önizle

# Coolify veritabanı ve yapılandırmasını yedekle
quicklify backup my-server                   # Tam yedekleme (pg_dump + yapılandırma)
quicklify backup --all                       # Tüm sunucuları sırayla yedekle
quicklify backup my-server --dry-run         # Yedekleme adımlarını önizle

# Yedekten geri yükle
quicklify restore my-server                  # İnteraktif yedek seçimi
quicklify restore my-server --backup 2026-02-21_15-30-45-123  # Belirli yedek
quicklify restore my-server --dry-run        # Geri yükleme adımlarını önizle

# Sunucu listesini dışa/içe aktar
quicklify export                             # ./quicklify-export.json'a aktar
quicklify export /path/to/file.json          # Özel yola aktar
quicklify import /path/to/file.json          # Sunucuları içe aktar (kopyaları atlar)

# Mevcut Coolify sunucusunu yönetime ekle
quicklify add                                # İnteraktif (sağlayıcı, token, IP, doğrulama)
quicklify add --provider hetzner --ip 1.2.3.4 --name my-server  # Etkileşimsiz
quicklify add --provider vultr --ip 1.2.3.4 --skip-verify       # Coolify kontrolünü atla

# Tam bakım döngüsü çalıştır
quicklify maintain my-server                 # Status → Update → Health → Reboot
quicklify maintain my-server --skip-reboot   # Yeniden başlatma adımını atla
quicklify maintain --all                     # Tüm sunucuları sırayla bakıma al
quicklify maintain my-server --dry-run       # Bakım adımlarını önizle

# Sürümü göster
quicklify --version

# Yardımı göster
quicklify --help
```

### Etkileşimsiz Mod

API token'ınızı ortam değişkeni olarak ayarlayın, ardından tüm seçenekleri bayrak olarak geçirin:

```bash
# Token ayarla (önerilen - kabuk geçmişinde görünmeyi önler)
export HETZNER_TOKEN="your-api-token"
# veya
export DIGITALOCEAN_TOKEN="your-api-token"
# veya
export VULTR_TOKEN="your-api-token"
# veya
export LINODE_TOKEN="your-api-token"

# Etkileşimsiz deploy
quicklify init \
  --provider hetzner \
  --region nbg1 \
  --size cax11 \
  --name production-coolify
```

Token çözümleme sırası: ortam değişkeni > interaktif soru. `--token` bayrağı mevcuttur ancak kabuk geçmişinde token'ı açığa çıkardığı için **önerilmez**.

Bazı bayraklar eksikse, yalnızca eksik değerler interaktif olarak sorulur.

### YAML Yapılandırma Dosyası

Tekrarlanabilir deploy'lar için bir `quicklify.yml` dosyası oluşturun:

```yaml
# quicklify.yml
template: production
provider: hetzner
region: nbg1
size: cx33
name: my-coolify-prod
fullSetup: true
```

Ardından deploy edin:

```bash
export HETZNER_TOKEN="your-api-token"
quicklify init --config quicklify.yml
```

**Güvenlik:** API token'larını yapılandırma dosyalarında asla saklamayın. Ortam değişkenlerini kullanın (`export HETZNER_TOKEN=...`).

**Yapılandırma birleştirme önceliği:** CLI bayrakları > YAML değerleri > şablon varsayılanları > interaktif sorular.

### Şablonlar

Şablonlar sağlayıcıya özel makul varsayılanlar sunar:

| Şablon | Hetzner | DigitalOcean | Vultr | Linode | Tam Kurulum |
|--------|---------|--------------|-------|--------|-------------|
| `starter` | nbg1 / cax11 (€3.79) | fra1 / s-2vcpu-2gb ($12) | ewr / vc2-2c-4gb ($24) | us-east / g6-standard-2 ($12) | Hayır |
| `production` | nbg1 / cx33 (€5.49) | fra1 / s-2vcpu-4gb ($24) | ewr / vc2-4c-8gb ($48) | us-east / g6-standard-4 ($36) | Evet |
| `dev` | nbg1 / cax11 (€3.79) | fra1 / s-2vcpu-2gb ($12) | ewr / vc2-2c-4gb ($24) | us-east / g6-standard-2 ($12) | Hayır |

```bash
# Hızlı production deploy
export HETZNER_TOKEN="your-api-token"
quicklify init --template production --provider hetzner --name my-server

# Test için ucuz starter
export DIGITALOCEAN_TOKEN="your-api-token"
quicklify init --template starter --provider digitalocean --name test-server
```

### İnteraktif Sorular

1. **Sağlayıcı Seçimi** - Hetzner Cloud, DigitalOcean, Vultr veya Linode seçin
2. **API Token** - Devam etmeden önce doğrulanır
3. **Bölge Seçimi** - Tercih ettiğiniz veri merkezini seçin
4. **Sunucu Boyutu** - Coolify gereksinimleri (2GB RAM, 2 vCPU) ile filtrelenir
5. **Sunucu Adı** - Format doğrulama (küçük harf, alfanümerik, kısa çizgi)
6. **Onay** - Deploy öncesi özet inceleme

Tüm adımlar önceki adıma dönmek için **← Geri** navigasyonunu destekler.

## 🧪 Testler

### Testleri Çalıştırma

```bash
# Tüm testleri çalıştır
npm test

# İzleme modunda testleri çalıştır
npm run test:watch

# Coverage raporu ile testleri çalıştır
npm run test:coverage

# Kodu lint'le
npm run lint

# Kodu formatla
npm run format
```

### Test Yapısı

```
tests/
├── __mocks__/              # Mock modülleri (axios, inquirer, ora, chalk)
├── unit/                   # Birim testleri
│   ├── cloudInit.test.ts
│   ├── config.test.ts          # Config CRUD işlemleri
│   ├── config-edge.test.ts     # Config uç durumları (bozulma, boş dosyalar)
│   ├── config-command.test.ts   # Config komut alt komutları
│   ├── defaults.test.ts        # Varsayılan config CRUD
│   ├── destroy.test.ts         # Destroy komutu birim testleri
│   ├── doctor.test.ts           # Doctor komutu testleri
│   ├── domain.test.ts           # Domain komutu testleri
│   ├── firewall.test.ts         # Firewall komutu testleri
│   ├── health-command.test.ts   # Health komutu testleri
│   ├── healthCheck.test.ts     # Sağlık kontrolü yoklama testleri
│   ├── healthCheck-edge.test.ts # Sağlık kontrolü uç durumları (302, 401, 500)
│   ├── list.test.ts            # List komutu birim testleri
│   ├── logger.test.ts
│   ├── logs.test.ts             # Logs komutu testleri
│   ├── monitor.test.ts          # Monitor komutu testleri
│   ├── prompts.test.ts
│   ├── providerFactory.test.ts # Provider factory testleri
│   ├── restart.test.ts         # Restart komutu testleri
│   ├── secure.test.ts           # Secure komutu testleri
│   ├── backup.test.ts           # Backup komutu testleri
│   ├── restore.test.ts          # Restore komutu testleri
│   ├── transfer.test.ts         # Export/Import komutu testleri
│   ├── templates.test.ts         # Şablon tanımları testleri
│   ├── yamlConfig.test.ts        # YAML yapılandırma yükleyici testleri
│   ├── configMerge.test.ts       # Yapılandırma birleştirme mantığı testleri
│   ├── init-fullsetup.test.ts   # Init --full-setup testleri
│   ├── serverSelect.test.ts    # Sunucu seçim yardımcı testleri
│   ├── ssh-command.test.ts     # SSH komutu testleri
│   ├── ssh-utils.test.ts       # SSH yardımcı testleri
│   ├── status.test.ts          # Status komutu birim testleri
│   ├── update.test.ts          # Update komutu testleri
│   ├── add.test.ts             # Add komutu testleri
│   ├── maintain.test.ts        # Maintain komutu testleri
│   └── validators.test.ts
├── integration/            # Entegrasyon testleri (sağlayıcı API çağrıları)
│   ├── hetzner.test.ts         # destroyServer testleri dahil
│   ├── digitalocean.test.ts    # destroyServer testleri dahil
│   ├── vultr.test.ts           # Vultr sağlayıcı testleri
│   └── linode.test.ts          # Linode sağlayıcı testleri
└── e2e/                    # Uçtan uca testler (tam komut akışları)
    ├── init.test.ts
    ├── init-noninteractive.test.ts  # Etkileşimsiz mod E2E
    ├── init-config.test.ts          # YAML yapılandırma + şablon E2E
    ├── status.test.ts               # Status komutu E2E
    └── destroy.test.ts              # Destroy komutu E2E
```

### CI/CD

Testler her push/PR'da GitHub Actions aracılığıyla otomatik çalışır:

- **İşletim Sistemi:** Ubuntu, macOS, Windows
- **Node.js:** 20, 22

### Coverage

Mevcut coverage: **%98+ statements/lines**, **%91+ branches**, **%98+ functions**. 45 test paketi genelinde 947 test.

## 🔧 Sorun Giderme

**"Invalid API token"**

- Token'ın Read & Write izinlerine sahip olduğundan emin olun
- Kopyalarken fazla boşluk olup olmadığını kontrol edin
- Gerekirse token'ı yeniden oluşturun

**"Server creation failed"**

- Bulut hesabında yeterli bakiye olduğunu doğrulayın
- Hesap limitlerini kontrol edin (yeni hesapların kısıtlamaları olabilir)
- Farklı bölge veya sunucu boyutu deneyin

**"Cannot access Coolify UI"**

- 3-5 dakika daha bekleyin (Coolify başlatma zaman alır)
- Kurulum logunu kontrol edin: `ssh root@YOUR_IP "cat /var/log/quicklify-install.log | tail -20"`
- Güvenlik duvarı ayarlarını kontrol edin (otomatik yapılandırılmalıdır)
- Bulut konsolunda sunucunun çalıştığını doğrulayın

## 🤝 Katkıda Bulunma

Katkılarınızı bekliyoruz! Geliştirme ortamı kurulumu, kod kuralları ve PR süreci için [CONTRIBUTING.md](CONTRIBUTING.md) dosyasına bakın.

**Katkı alanları:**

- Yeni bulut sağlayıcı entegrasyonları
- CLI iyileştirmeleri
- Dokümantasyon
- Hata düzeltmeleri

## 📄 Lisans

MIT © 2026 Ömer FC

Detaylar için [LICENSE](LICENSE) dosyasına bakın.

## 🙏 Teşekkürler

- [Coolify](https://coolify.io/) - Harika açık kaynaklı PaaS
- [Hetzner](https://www.hetzner.com/) - Uygun fiyatlı, güvenilir bulut altyapısı
- [DigitalOcean](https://www.digitalocean.com/) - Geliştirici dostu bulut platformu
- [Vultr](https://www.vultr.com/) - Yüksek performanslı bulut bilişim
- [Linode](https://www.linode.com/) - Basit, uygun fiyatlı bulut bilişim
- Tüm katkıda bulunanlar ve kullanıcılar!

## 💬 Destek & Topluluk

- 🐛 **Hata Raporları:** [GitHub Issues](https://github.com/omrfc/quicklify/issues)
- 💡 **Özellik İstekleri:** [GitHub Discussions](https://github.com/omrfc/quicklify/discussions)
- 🐦 **Güncellemeler:** [@omrfc](https://twitter.com/omrfc)
- 🌐 **Web Sitesi:** [quicklify.omrfc.dev](https://quicklify.omrfc.dev)

## ⭐ Desteğinizi Gösterin

Quicklify size yardımcı olduysa, lütfen:

- ⭐ Bu depoyu yıldızlayın
- 🐦 Twitter'da paylaşın
- 📝 Blog yazısı yazın
- 💬 Arkadaşlarınıza anlatın!

---

**[@omrfc](https://github.com/omrfc) tarafından ❤️ ile yapılmıştır**

*Geliştiricilerin zamanını kurtarıyor, her seferinde bir deploy.* ⚡

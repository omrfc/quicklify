# quicklify

> [English](README.md) | Türkçe

![Tests](https://github.com/omrfc/quicklify/actions/workflows/ci.yml/badge.svg)
[![Coverage](https://codecov.io/gh/omrfc/quicklify/branch/main/graph/badge.svg)](https://codecov.io/gh/omrfc/quicklify)
![npm](https://img.shields.io/npm/v/quicklify)
![Downloads](https://img.shields.io/npm/dt/quicklify)
![License](https://img.shields.io/badge/license-MIT-blue)
![GitHub stars](https://img.shields.io/github/stars/omrfc/quicklify?style=flat-square)
[![Socket Badge](https://socket.dev/api/badge/npm/package/quicklify)](https://socket.dev/npm/package/quicklify)

**Self-hosting basitleştirildi.**

Sunucularınızı deploy edin, güvence altına alın, yedekleyin, snapshot alın ve bakımını yapın — güvenle.

## Quicklify Neden Var?

Self-hosted Coolify sunucularının çoğu şu nedenlerle çöker:

- Yedekleme disiplini yok
- Güncelleme stratejisi yok
- Güvenlik sıkılaştırması yok
- İzleme yok
- Snapshot rutini yok

Coolify sunucunuza çocuk bakıcılığı yapmayı bırakın. Quicklify bunu çözmek için yapıldı.

## Hızlı Başlangıç

```bash
# 1. Hetzner, DigitalOcean, Vultr veya Linode'dan API token'ınızı alın
# 2. Kurulumu başlatın
npx quicklify init

# 3. Coolify'a http://<sunucu-ip>:8000 adresinden erişin
```

Hepsi bu kadar. Quicklify sunucu oluşturma, SSH anahtar kurulumu, güvenlik duvarı yapılandırması ve Coolify kurulumunu otomatik yapar.

## Quicklify'ı Farklı Kılan Ne?

| Problem | Çözüm |
|---------|-------|
| Güncelleme sunucuyu bozdu mu? | `maintain` ile güncelleme öncesi snapshot koruması |
| Sunucunuz sağlıklı mı bilmiyor musunuz? | Yerleşik izleme, sağlık kontrolleri ve `doctor` tanılama |
| Güvenlik sonradan mı düşünülüyor? | Güvenlik duvarı, SSH sıkılaştırma, SSL ve güvenlik denetimi hazır |
| Yedekleme? Belki bir gün... | Tek komutla yedekleme ve geri yükleme, manifest takibiyle |
| Birden fazla sunucu mu yönetiyorsunuz? | Yedekleme, bakım, durum ve sağlıkta `--all` desteği |
| Mevcut sunucu takip dışı mı? | `quicklify add` ile her Coolify sunucusunu yönetime alın |

## Neler Yapabilirsiniz?

### Kurulum
```bash
quicklify init                          # İnteraktif kurulum
quicklify init --provider hetzner       # Otomatik kurulum
quicklify init --config quicklify.yml   # YAML ile kurulum
quicklify init --template production    # Şablon kullanarak
```

### Yönetim
```bash
quicklify list                  # Sunucuları listele
quicklify status sunucum        # Sunucu ve Coolify durumu
quicklify status --all          # Tüm sunucuları kontrol et
quicklify ssh sunucum           # Sunucuya SSH bağlantısı
quicklify restart sunucum       # Sunucuyu yeniden başlat
quicklify destroy sunucum       # Bulut sunucusunu tamamen sil
quicklify add                   # Mevcut Coolify sunucusu ekle
quicklify remove sunucum        # Yerel yapılandırmadan kaldır
quicklify config set key value  # Varsayılan yapılandırma yönet
quicklify export                # Sunucu listesini JSON'a aktar
quicklify import servers.json   # JSON'dan sunucuları içe aktar
```

### Güncelleme ve Bakım
```bash
quicklify update sunucum        # Coolify'ı güncelle
quicklify maintain sunucum      # Tam bakım (snapshot + güncelleme + sağlık + yeniden başlatma)
quicklify maintain --all        # Tüm sunucuları bakıma al
```

### Yedekleme ve Geri Yükleme
```bash
quicklify backup sunucum        # Veritabanı + yapılandırma yedeği
quicklify backup --all          # Tüm sunucuları yedekle
quicklify restore sunucum       # Yedekten geri yükle
```

### Snapshot'lar
```bash
quicklify snapshot create sunucum   # VPS snapshot'ı oluştur (maliyet tahminiyle)
quicklify snapshot list sunucum     # Snapshot'ları listele
quicklify snapshot list --all       # Tüm sunuculardaki snapshot'ları listele
quicklify snapshot delete sunucum   # Snapshot sil
```

### Güvenlik
```bash
quicklify firewall status sunucum   # Güvenlik duvarı durumu
quicklify firewall setup sunucum    # UFW yapılandırması
quicklify secure audit sunucum      # Güvenlik denetimi
quicklify secure harden sunucum     # SSH sıkılaştırma + fail2ban
quicklify domain add sunucum --domain ornek.com  # Domain + SSL ayarla
```

### İzleme ve Hata Ayıklama
```bash
quicklify monitor sunucum             # CPU, RAM, disk kullanımı
quicklify logs sunucum                 # Coolify logları
quicklify logs sunucum -f              # Logları canlı takip et
quicklify health                       # Tüm sunucuların sağlık kontrolü
quicklify doctor                       # Yerel ortam kontrolü
```

## Desteklenen Sağlayıcılar

| Sağlayıcı | Durum | Bölgeler | Başlangıç Fiyatı |
|-----------|-------|----------|------------------|
| [Hetzner Cloud](https://hetzner.cloud) | Kararlı | Avrupa, ABD | ~€4/ay |
| [DigitalOcean](https://digitalocean.com) | Kararlı | Küresel | ~$18/ay |
| [Vultr](https://vultr.com) | Kararlı | Küresel | ~$10/ay |
| [Linode (Akamai)](https://linode.com) | Beta | Küresel | ~$24/ay |

> Fiyatlar provider başına varsayılan starter şablonunu yansıtır. Kurulum sırasında farklı boyut seçebilirsiniz. Linode desteği beta aşamasındadır — topluluk testleri memnuniyetle karşılanır.

## YAML Yapılandırması

Tek bir yapılandırma dosyasıyla kurulum yapın:

```yaml
# quicklify.yml
provider: hetzner
region: nbg1
size: cax11
name: sunucum
fullSetup: true
domain: coolify.ornek.com
```

```bash
quicklify init --config quicklify.yml
```

## Şablonlar

| Şablon | Kullanım Alanı | İçerik |
|--------|---------------|--------|
| `starter` | Test, yan projeler | 1–2 vCPU, 2–4 GB RAM |
| `production` | Canlı uygulamalar | 2–4 vCPU, 4–8 GB RAM, tam sıkılaştırma |
| `dev` | Geliştirme ve CI/CD | Starter ile aynı, sıkılaştırma yok |

```bash
quicklify init --template production --provider hetzner
```

## Güvenlik

Quicklify güvenlik öncelikli olarak geliştirilmektedir — 52 test suite'inde **1.200+ test**, özel güvenlik test suite'leri dahil.

- API token'ları asla diske kaydedilmez — çalışma zamanında sorulur veya ortam değişkenlerinden alınır
- SSH anahtarları gerekirse otomatik oluşturulur (Ed25519)
- Tüm SSH bağlantıları `StrictHostKeyChecking=accept-new` ile IP doğrulama ve ortam filtreleme kullanır
- Tüm kullanıcı girdilerinde shell injection koruması
- Provider hata mesajları token sızıntısını önlemek için temizlenir
- Yapılandırma dosyasında token tespiti (22+ anahtar pattern, büyük/küçük harf duyarsız, iç içe yapılar)
- İçe/dışa aktarma işlemleri hassas alanları temizler ve dosya izinlerini sıkılaştırır
- `--full-setup` güvenlik duvarı ve SSH sıkılaştırmasını otomatik etkinleştirir

## Kurulum

```bash
# Doğrudan çalıştırın (önerilen)
npx quicklify <komut>

# Veya global olarak kurun
npm install -g quicklify
quicklify <komut>
```

Node.js 20 veya üstü gereklidir.

## Sorun Giderme

**Sunucu oluşturma başarısız mı?**
API token'ınızı ve yerel ortamınızı doğrulamak için `quicklify doctor --check-tokens` komutunu çalıştırın.

**Coolify yanıt vermiyor mu?**
Durumu kontrol edip gerekirse otomatik yeniden başlatmak için `quicklify status sunucum --autostart` kullanın.

**Sıfırdan başlamak mı istiyorsunuz?**
`quicklify destroy sunucum` bulut sunucusunu tamamen kaldırır.

## Katkıda Bulunma

Geliştirme ortamı kurulumu, test ve katkı rehberi için [CONTRIBUTING.md](CONTRIBUTING.md) dosyasına bakın.

## Gelecek Planlar

- Zamanlanmış bakım (cron tabanlı otomatik bakım)
- Genel sunucu yönetimi (Coolify olmayan sunucular)
- İnteraktif TUI arayüzü

## Felsefe

> Altyapı sıkıcı, öngörülebilir ve güvenli olmalıdır.

Quicklify bir script değildir. Coolify için DevOps güvenlik katmanınızdır.

## Lisans

MIT — [LICENSE](LICENSE) dosyasına bakın

## Destek

- [GitHub Issues](https://github.com/omrfc/quicklify/issues) — Hata bildirimleri ve özellik istekleri
- [Changelog](CHANGELOG.md) — Sürüm geçmişi

---

[@omrfc](https://github.com/omrfc) tarafından geliştirilmektedir.

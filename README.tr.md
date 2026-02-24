# quicklify

> [English](README.md) | Türkçe

[![npm version](https://img.shields.io/npm/v/quicklify.svg)](https://www.npmjs.com/package/quicklify)
[![CI](https://github.com/omrfrkcpr/quicklify/actions/workflows/ci.yml/badge.svg)](https://github.com/omrfrkcpr/quicklify/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)

**Coolify'i tek komutla bulut VPS'inize kurun.**

Quicklify, [Coolify](https://coolify.io)'i bulut sunucunuza yaklaşık 4 dakikada kurar, yapılandırır ve yönetir. Verilerinizi yedekleyin, güvenliği sıkılaştırın, domain yönetin ve her şeyi güncel tutun — hepsi terminalden.

## Hızlı Başlangıç

```bash
# 1. Hetzner, DigitalOcean, Vultr veya Linode'dan API token'ınızı alın
# 2. Kurulumu başlatın
npx quicklify init

# 3. Coolify'a http://<sunucu-ip>:8000 adresinden erişin
```

Hepsi bu kadar. Quicklify sunucu oluşturma, SSH anahtar kurulumu, güvenlik duvarı yapılandırması ve Coolify kurulumunu otomatik yapar.

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
quicklify add                   # Mevcut Coolify sunucusu ekle
quicklify remove sunucum        # Yerel yapılandırmadan kaldır
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
| [Hetzner Cloud](https://hetzner.cloud) | Kararlı | Avrupa, ABD | €3,49/ay |
| [DigitalOcean](https://digitalocean.com) | Kararlı | Küresel | $12/ay |
| [Vultr](https://vultr.com) | Kararlı | Küresel | $10/ay |
| [Linode (Akamai)](https://linode.com) | Beta | Küresel | $12/ay |

> **Not:** Linode desteği beta aşamasındadır — topluluk testleri memnuniyetle karşılanır.

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
| `starter` | Test, yan projeler | En küçük sunucu |
| `production` | Canlı uygulamalar | 4+ vCPU, 8+ GB RAM |
| `dev` | Geliştirme ve CI/CD | Dengeli kaynaklar |

```bash
quicklify init --template production --provider hetzner
```

## Güvenlik

- API token'ları asla diske kaydedilmez — çalışma zamanında sorulur veya ortam değişkenlerinden alınır
- SSH anahtarları gerekirse otomatik oluşturulur (Ed25519)
- `--full-setup` güvenlik duvarı ve SSH sıkılaştırmasını otomatik etkinleştirir
- Tüm SSH bağlantıları `StrictHostKeyChecking=accept-new` kullanır
- Yapılandırma dosyasında token tespiti, YAML'da gizli bilgi saklamaya karşı uyarır

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

- Sunucu yönetimi için interaktif TUI arayüzü

## Lisans

MIT — [LICENSE](LICENSE) dosyasına bakın

## Destek

- [GitHub Issues](https://github.com/omrfrkcpr/quicklify/issues) — Hata bildirimleri ve özellik istekleri
- [Changelog](CHANGELOG.md) — Sürüm geçmişi

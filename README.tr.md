# quicklify

> Self-hosted PaaS'ınız, tamamen yönetilen. Deploy, güvenlik, yedekleme — tek komutla.

> [English](README.md) | Türkçe

![Tests](https://github.com/omrfc/quicklify/actions/workflows/ci.yml/badge.svg)
[![Coverage](https://codecov.io/gh/omrfc/quicklify/branch/main/graph/badge.svg)](https://codecov.io/gh/omrfc/quicklify)
![npm](https://img.shields.io/npm/v/quicklify)
![Downloads](https://img.shields.io/npm/dt/quicklify)
![License](https://img.shields.io/badge/license-MIT-blue)
![GitHub stars](https://img.shields.io/github/stars/omrfc/quicklify?style=flat-square)
[![Socket Badge](https://socket.dev/api/badge/npm/package/quicklify)](https://socket.dev/npm/package/quicklify)
[![Website](https://img.shields.io/website?url=https%3A%2F%2Fquicklify.omrfc.dev&label=website)](https://quicklify.omrfc.dev)

## Quicklify Neden Var?

Self-hosted sunucuların çoğu şu nedenlerle çöker:

- Yedekleme disiplini yok
- Güncelleme stratejisi yok
- Güvenlik sıkılaştırması yok
- İzleme yok
- Snapshot rutini yok

Sunucularınıza çocuk bakıcılığı yapmayı bırakın. Quicklify bunu çözmek için yapıldı.

## Hızlı Başlangıç

```bash
# İnteraktif mod — komut ezberlemeye gerek yok
npx quicklify
```

`quicklify` komutunu argümansız çalıştırdığınızda **interaktif bir menü** açılır. Tüm işlemleri kategorilere göre görebilir, ok tuşlarıyla seçim yapabilir ve alt seçenekleri adım adım yapılandırabilirsiniz — komut adı veya flag ezberlemek zorunda değilsiniz.

```
? What would you like to do?
  Server Management
❯   Deploy a new server
    Add an existing server
    List all servers
    Check server status
    ...
  Security
    Harden SSH & fail2ban
    Manage firewall (UFW)
    ...
```

Her işlem alt seçenekler (sunucu modu, şablon, log kaynağı, port numarası vb.) içerir ve istediğiniz noktada ana menüye dönmek için **← Back** seçeneği sunar.

Komutları zaten biliyorsanız, doğrudan da kullanabilirsiniz:

```bash
quicklify init                    # Yeni sunucu kur
quicklify status sunucum          # Sunucu durumunu kontrol et
quicklify backup --all            # Tüm sunucuları yedekle
```

Quicklify sunucu oluşturma, SSH anahtar kurulumu, güvenlik duvarı yapılandırması ve platform kurulumunu otomatik yapar.

## Quicklify'ı Farklı Kılan Ne?

| Problem | Çözüm |
|---------|-------|
| Güncelleme sunucuyu bozdu mu? | `maintain` ile güncelleme öncesi snapshot koruması |
| Sunucunuz sağlıklı mı bilmiyor musunuz? | Yerleşik izleme, sağlık kontrolleri ve `doctor` tanılama |
| Güvenlik sonradan mı düşünülüyor? | Güvenlik duvarı, SSH sıkılaştırma, SSL ve güvenlik denetimi hazır |
| Yedekleme? Belki bir gün... | Tek komutla yedekleme ve geri yükleme, manifest takibiyle |
| Birden fazla sunucu mu yönetiyorsunuz? | Yedekleme, bakım, durum ve sağlıkta `--all` desteği |
| Mevcut sunucu takip dışı mı? | `quicklify add` ile her sunucuyu yönetime alın |
| Komutları ezberlemek mi? | `quicklify` yazın — interaktif menü sizi yönlendirir |

## Neler Yapabilirsiniz?

### Kurulum
```bash
quicklify                               # İnteraktif menü (önerilen)
quicklify init                          # İnteraktif kurulum (doğrudan)
quicklify init --provider hetzner       # Otomatik kurulum
quicklify init --config quicklify.yml   # YAML ile kurulum
quicklify init --template production    # Şablon kullanarak
quicklify init --mode bare              # Genel VPS (Coolify olmadan)
```

### Yönetim
```bash
quicklify list                  # Sunucuları listele
quicklify status sunucum        # Sunucu durumu
quicklify status --all          # Tüm sunucuları kontrol et
quicklify ssh sunucum           # Sunucuya SSH bağlantısı
quicklify restart sunucum       # Sunucuyu yeniden başlat
quicklify destroy sunucum       # Bulut sunucusunu tamamen sil
quicklify add                   # Mevcut sunucu ekle
quicklify remove sunucum        # Yerel yapılandırmadan kaldır
quicklify config set key value  # Varsayılan yapılandırma yönet
quicklify export                # Sunucu listesini JSON'a aktar
quicklify import servers.json   # JSON'dan sunucuları içe aktar
```

### Güncelleme ve Bakım
```bash
quicklify update sunucum        # Coolify güncelle (Coolify sunucuları)
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
quicklify secure setup sunucum      # SSH sıkılaştırma + fail2ban
quicklify domain add sunucum --domain ornek.com  # Domain + SSL ayarla
```

### İzleme ve Hata Ayıklama
```bash
quicklify monitor sunucum             # CPU, RAM, disk kullanımı
quicklify logs sunucum                 # Sunucu logları
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

Quicklify güvenlik öncelikli olarak geliştirilmektedir — 78 test suite'inde **2.099 test**, özel güvenlik test suite'leri dahil.

- API token'ları asla diske kaydedilmez — çalışma zamanında sorulur veya ortam değişkenlerinden alınır
- SSH anahtarları gerekirse otomatik oluşturulur (Ed25519)
- Tüm SSH bağlantıları `StrictHostKeyChecking=accept-new` ile IP doğrulama (oktet aralığı) ve ortam filtreleme kullanır
- Tüm kullanıcı girdilerinde shell injection koruması (`spawn`/`spawnSync`, `execSync` yok)
- Provider hata mesajları token sızıntısını önlemek için temizlenir
- stderr temizleme — hata çıktısından IP'ler, home dizinleri, token'lar ve gizli veriler otomatik redakte edilir
- Yapılandırma dosyasında token tespiti (22+ anahtar pattern, büyük/küçük harf duyarsız, iç içe yapılar)
- İçe/dışa aktarma işlemleri hassas alanları temizler ve dosya izinlerini sıkılaştırır (`0o600`)
- `--full-setup` güvenlik duvarı ve SSH sıkılaştırmasını otomatik etkinleştirir
- MCP: SAFE_MODE (varsayılan: açık) tüm yıkıcı işlemleri engeller, tüm girdilerde Zod şema doğrulaması, yedek geri yüklemede path traversal koruması

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

## MCP Sunucusu (Yapay Zeka Entegrasyonu)

Quicklify, yapay zeka destekli sunucu yönetimi için yerleşik bir [Model Context Protocol](https://modelcontextprotocol.io/) sunucusu içerir. Claude Code, Cursor, Windsurf ve diğer MCP uyumlu istemcilerle çalışır.

```json
{
  "mcpServers": {
    "quicklify": {
      "command": "npx",
      "args": ["-y", "-p", "quicklify", "quicklify-mcp"],
      "env": {
        "HETZNER_TOKEN": "token-buraya",
        "DIGITALOCEAN_TOKEN": "token-buraya",
        "VULTR_TOKEN": "token-buraya",
        "LINODE_TOKEN": "token-buraya"
      }
    }
  }
}
```

Mevcut araçlar:

| Araç | Eylemler | Açıklama |
|------|----------|----------|
| `server_info` | list, status, health | Sunucu bilgilerini sorgula, bulut sağlayıcı ve Coolify durumunu kontrol et |
| `server_logs` | logs, monitor | SSH ile Coolify/Docker loglarını ve sistem metriklerini getir |
| `server_manage` | add, remove, destroy | Sunucuları kaydet, kaldır veya bulut sunucusunu sil |
| `server_maintain` | update, restart, maintain | Coolify güncelle, sunucuları yeniden başlat, tam bakım yap |
| `server_secure` | secure, firewall, domain | SSH sıkılaştırma, güvenlik duvarı kuralları, domain/SSL yönetimi (10 alt komut) |
| `server_backup` | backup, snapshot | Veritabanı yedekle/geri yükle ve VPS snapshot oluştur/yönet |
| `server_provision` | create | Bulut sağlayıcılarda yeni sunucu oluştur |

> Tüm yıkıcı işlemler (destroy, restore, snapshot-delete, provision, restart, maintain, snapshot-create) çalıştırılmak için `SAFE_MODE=false` gerektirir.

## Gelecek Planlar

- Zamanlanmış bakım (cron tabanlı otomatik bakım)
- Dokploy platform desteği (`--platform dokploy`)

## Felsefe

> Altyapı sıkıcı, öngörülebilir ve güvenli olmalıdır.

Quicklify bir script değildir. Self-hosted altyapınız için DevOps güvenlik katmanınızdır.

## Lisans

MIT — [LICENSE](LICENSE) dosyasına bakın

## Destek

- [GitHub Issues](https://github.com/omrfc/quicklify/issues) — Hata bildirimleri ve özellik istekleri
- [Changelog](CHANGELOG.md) — Sürüm geçmişi

---

[@omrfc](https://github.com/omrfc) tarafından geliştirilmektedir.

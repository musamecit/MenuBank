# Günlük Kod Yedekleme (GitHub Actions)

Bu proje artık yedekleme işlemini yerel bilgisayarınız yerine **GitHub Actions** üzerinden bulut ortamında gerçekleştirmektedir. 

## Avantajları
- Bilgisayarınızın açık olmasına gerek yoktur.
- macOS izin/güvenlik sorunlarından etkilenmez.
- Tamamen otomatiktir.

## Kurulum (Bir Kez Mahsus)
1. GitHub'da bir **Personal Access Token (classic)** oluşturun (İzinler: `repo`).
2. Ana reponuzun (QRMenu) **Settings > Secrets and variables > Actions** sayfasına gidin.
3. **New repository secret** butonuna basın.
4. Name: `BACKUP_TOKEN`, Value: (az önce oluşturduğunuz token).
5. Artık her gece saat **00:01 (TR)**'de otomatik yedeklenecektir.

---

## [LEGACY] Yerel macOS Yedekleme (Tavsiye Edilmez)

## Adım 1: Private Backup Repo Oluşturma

1. GitHub'da yeni bir repo oluşturun: https://github.com/new
2. **Repository name**: `MenuBank-backup` (veya `QRMenu-backup`)
3. **Private** seçin
4. **README, .gitignore eklemeyin** – boş repo olsun
5. Create repository

## Adım 2: Backup Remote Ekleme

Proje klasöründe terminalde:

```bash
cd /Users/musamecit/Desktop/QRMenu

# Backup remote ekle (URL'i kendi kullanıcı adınızla değiştirin)
git remote add backup https://github.com/musamecit/MenuBank-backup.git

# Kontrol
git remote -v
# origin  https://github.com/musamecit/MenuBank.git (fetch)
# origin  https://github.com/musamecit/MenuBank.git (push)
# backup  https://github.com/musamecit/MenuBank-backup.git (fetch)
# backup  https://github.com/musamecit/MenuBank-backup.git (push)
```

## Adım 3: İlk Yedekleme

```bash
./scripts/daily-backup.sh
```

Veya manuel:
```bash
git push backup main
```

## Adım 4: Günlük Otomatik Çalıştırma (macOS)

macOS'ta her gün saat 00:01'de çalışması için:

```bash
# Script'i çalıştırılabilir yap
chmod +x /Users/musamecit/Desktop/QRMenu/scripts/daily-backup.sh

# LaunchAgent plist dosyasını kopyala
cp /Users/musamecit/Desktop/QRMenu/scripts/com.menubank.backup.plist ~/Library/LaunchAgents/

# Servisi yükle
launchctl load ~/Library/LaunchAgents/com.menubank.backup.plist

# Durumu kontrol et
launchctl list | grep menubank
```

Durdurmak için:
```bash
launchctl unload ~/Library/LaunchAgents/com.menubank.backup.plist
```

## Özet

| Repo | Görünürlük | Amaç |
|------|------------|------|
| `origin` (MenuBank) | Public | Ana proje |
| `backup` (MenuBank-backup) | **Private** | Sadece sizin gördüğünüz yedek |

- **Lokal**: Tüm kodlar bilgisayarınızda durmaya devam eder
- **Günlük**: Script her gün saat 00:01'de `main` branch'ı backup repo'ya push eder (bilgisayar açıksa; kapalıysa bir sonraki gün dener)
- **Güvenlik**: Backup repo private olduğu için sadece siz erişirsiniz

## Alternatif Yöntemler

1. **GitHub Actions ile mirror**: Public repo'da bir workflow, günde bir private repo'ya mirror push yapabilir (PAT gerekir)
2. **GitLab / Bitbucket**: GitHub dışında başka bir serviste private mirror
3. **iCloud / Dropbox**: Proje klasörünü senkronize klasöre taşımak (git için ideal değil)
4. **Time Machine**: macOS yerel yedekleme – makine kaybında işe yarar, repo silinirse yeterli olmayabilir

Bu kurulum (private GitHub + günlük push) en temiz ve güvenilir yöntemdir.

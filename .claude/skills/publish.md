# Skill: npm Publish / Release

## Sira
1. `npm run build` — hatasiz
2. `npm run lint` — temiz
3. `npm test` — hepsi yesil
4. `git push` — CI 6/6 yesil bekle (`gh run list`)
5. `git tag v1.x.x` → `git push --tags`
6. GitHub Actions publish tetiklenir
7. `npm view kastell` — version dogrula

## Versiyon Kurallari
- Patch `1.x.X`: bug fix
- Minor `1.X.0`: yeni feature, backward-compatible
- Major `X.0.0`: breaking change

## Yayin Oncesi Kontrol
- [ ] CHANGELOG.md guncellendi mi?
- [ ] README.md guncellendi mi?
- [ ] `kastell --version` dogru versiyonu gosteriyor mu?
- [ ] Contract'taki tum kriterler karsilandi mi?

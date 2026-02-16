# quicklify

![Tests](https://github.com/omrfc/quicklify/actions/workflows/ci.yml/badge.svg)
[![Coverage](https://codecov.io/gh/omrfc/quicklify/branch/main/graph/badge.svg)](https://codecov.io/gh/omrfc/quicklify)
![npm](https://img.shields.io/npm/v/quicklify)
![Downloads](https://img.shields.io/npm/dw/quicklify)
![License](https://img.shields.io/badge/license-MIT-blue)
![GitHub stars](https://img.shields.io/github/stars/omrfc/quicklify?style=flat-square)
[![Socket Badge](https://socket.dev/api/badge/npm/package/quicklify)](https://socket.dev/npm/package/quicklify)

> Deploy Coolify to any cloud VPS in 4 minutes

## 🚀 What is Quicklify?

Quicklify is a CLI tool that automates Coolify installation on cloud VPS providers. One command to deploy your self-hosted PaaS platform.

**Before Quicklify:**

```
Create VPS manually (5 min)
SSH into server (2 min)
Install Docker (10 min)
Configure firewall (5 min)
Install Coolify (10 min)
Total: ~30 minutes + manual work
```

**With Quicklify:**

```bash
npx quicklify init
# Total: ~4 minutes + zero manual work ✨
```

## ✨ Features

- 🎯 **One Command Deploy** - VPS + Coolify in 4 minutes
- 💰 **Cost Savings** - $50-200/mo (Vercel/Netlify) → €3.85/mo
- 🔒 **Secure by Default** - Automated security setup
- 🌍 **Multi-Cloud** - Hetzner (DigitalOcean coming soon)
- 💻 **Beautiful CLI** - Interactive prompts with validation
- 🎨 **ARM64 Ready** - Support for cost-effective ARM servers
- ⚡ **Fast Setup** - Production-ready in minutes
- ✨ **Dynamic Server Types** - Only shows compatible types for selected location
- 🔥 **Auto Firewall** - Ports 8000, 22, 80, 443 configured automatically
- 🚀 **Zero SSH Required** - Opens directly in browser after deployment

## 📦 Installation

### Using npx (Recommended)

```bash
npx quicklify init
```

### Global Installation

```bash
npm install -g quicklify
quicklify init
```

## 🎬 Quick Start

### Step 1: Get API Token

**Hetzner Cloud:**

1. Visit [Hetzner Console](https://console.hetzner.cloud/)
2. Select your project
3. Navigate to Security → API Tokens
4. Click "Generate API Token"
5. Set permissions to **Read & Write**
6. Copy the token (shown only once!)

**DigitalOcean:** (Coming Soon)

1. Visit [DigitalOcean API](https://cloud.digitalocean.com/account/api/tokens)
2. Generate New Token
3. Copy token

### Step 2: Deploy Coolify

```bash
npx quicklify init
```

You'll be prompted for:

- ✅ **API Token** - Paste your cloud provider token
- ✅ **Region** - Select datacenter location
- ✅ **Server Size** - Choose VPS specs (CAX11 recommended)
- ✅ **Server Name** - Name your instance

### Step 3: Access Coolify

After ~3 minutes:

```
✅ Deployment Successful!
Server IP: 123.45.67.89
Access Coolify: http://123.45.67.89:8000
```

Visit the URL, create your admin account, and start deploying!

## 🔒 Security Notes

**Important:** Port 8000 is publicly accessible after deployment.

**Recommended next steps:**
1. **Add a domain** and enable SSL in Coolify settings
2. Use **Cloudflare** for DDoS protection
3. Set a **strong password** on first login
4. Consider **IP whitelisting** for sensitive deployments

For production use, we recommend setting up a domain instead of using the IP address directly.

## 🌐 Supported Providers

| Provider | Status | Starting Price | Architecture |
|----------|--------|----------------|--------------|
| **Hetzner Cloud** | ✅ Available | €3.85/mo | ARM64 + x86 |
| **DigitalOcean** | 🚧 Coming Soon | $4/mo | x86 |
| **Vultr** | 📋 Planned | $2.50/mo | x86 |
| **Linode** | 📋 Planned | $5/mo | x86 |

## 💡 Use Cases

**Perfect for:**

- 🚀 Side projects and MVPs
- 💼 Client deployments (freelancers/agencies)
- 🎓 Learning DevOps and self-hosting
- 💸 Cutting cloud hosting costs
- 🏢 Small team internal tools

**When to use alternatives:**

- Large enterprise? → Coolify Cloud or enterprise PaaS
- Extreme scale? → Kubernetes + managed services

## 📊 Cost Comparison

| Solution | Monthly Cost | Setup Time | Management |
|----------|--------------|------------|------------|
| Vercel (Hobby) | $20+ | 5 min | Easy |
| Vercel (Pro) | $50+ | 5 min | Easy |
| Netlify (Pro) | $19+ | 5 min | Easy |
| **Quicklify + Hetzner** | **€3.85** | **4 min** | **Easy** |
| Manual VPS + Coolify | €3.85 | 30+ min | Hard |

**Savings: ~$180-240/year per project!** 💰

## 📋 Recent Updates

### v0.2.8 (2026-02-16)
- Replaced all `any` types with proper TypeScript interfaces
- Added ESLint 9 + Prettier for code quality enforcement
- Added CHANGELOG.md and CONTRIBUTING.md

### v0.2.7 (2026-02-16)
- Fixed inaccurate README/SECURITY claims
- Added npm keywords for better discoverability

### v0.2.6 (2026-02-16)
- CI: Upgraded Codecov action to v5

### v0.2.5 (2026-02-16)
- CI: Added Codecov integration for automatic coverage badge

### v0.2.4 (2026-02-15)
- Refactor: Removed recommended label, excluded failed server types from retry list

### v0.2.3 (2026-02-15)
- Fix: Unsupported error retry, dynamic deployment summary, dynamic recommended selection

### v0.2.2 (2026-02-15)
- Feat: Filter deprecated server types and add retry on unavailable

### v0.2.1 (2026-02-14)
- Fixed URL protocol (http for initial Coolify setup)

### v0.2.0 (2026-02-14)
- Added dynamic server type filtering based on selected location
- Auto firewall configuration (ports 8000, 22, 80, 443)
- Improved price formatting
- Removed debug logs

## 🗺️ Roadmap

### v0.1.0 (Completed)

- [x] Hetzner Cloud integration
- [x] Interactive CLI
- [x] Automated Coolify installation
- [x] ARM64 support

### v0.2.0 (Completed)

- [x] Dynamic server type filtering
- [x] Auto firewall configuration
- [x] Price formatting fix

### v0.2.x (Completed)

- [x] Deprecated server type filtering
- [x] Retry on unavailable server types
- [x] Dynamic deployment summary
- [x] Dynamic recommended selection
- [x] Codecov integration with coverage badge
- [x] ESLint + Prettier code quality tooling
- [x] Zero `any` types - full type safety

### Future

- [ ] DigitalOcean support
- [ ] Domain configuration helper
- [ ] SSL certificate automation
- [ ] Health checks & monitoring
- [ ] Backup configuration
- [ ] Multi-server management
- [ ] Web dashboard
- [ ] GitHub Actions integration

## 🛠️ Tech Stack

- **Runtime:** Node.js 18+
- **Language:** TypeScript
- **CLI Framework:** Commander.js
- **Interactive Prompts:** Inquirer.js
- **Styling:** Chalk (colors) + Ora (spinners)
- **HTTP Client:** Axios
- **Cloud APIs:** Hetzner Cloud API v1
- **Linting:** ESLint 9 + typescript-eslint
- **Formatting:** Prettier

## 📖 CLI Reference

### Commands

```bash
# Deploy new Coolify instance
quicklify init

# Show version
quicklify --version

# Show help
quicklify --help
```

### Interactive Prompts

1. **API Token** - Validated before proceeding
2. **Region Selection** - Choose your preferred datacenter
3. **Server Size** - Recommended option marked
4. **Server Name** - Validates format (lowercase, alphanumeric, hyphens)
5. **Confirmation** - Review summary before deployment

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

### Test Structure

```
tests/
├── __mocks__/          # Mock modules (axios, inquirer, ora, chalk)
├── unit/               # Unit tests
│   ├── cloudInit.test.ts
│   ├── logger.test.ts
│   ├── prompts.test.ts
│   └── validators.test.ts
├── integration/        # Integration tests (provider API calls)
│   └── hetzner.test.ts
└── e2e/                # End-to-end tests (full init flow)
    └── init.test.ts
```

### CI/CD

Tests run automatically on every push/PR via GitHub Actions across:

- **OS:** Ubuntu, macOS, Windows
- **Node.js:** 18, 20, 22

### Coverage

Current coverage: **98%+ statements/lines**, **91%+ branches**, **100% functions**.

## 🔧 Troubleshooting

**"Invalid API token"**

- Ensure token has Read & Write permissions
- Check for extra spaces when copying
- Regenerate token if needed

**"Server creation failed"**

- Verify cloud account has sufficient funds
- Check account limits (new accounts may have restrictions)
- Try different region or server size

**"Cannot access Coolify UI"**

- Wait 1-2 more minutes (Coolify initialization)
- Check firewall settings (should auto-configure)
- Verify server is running in cloud console

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code guidelines, and PR process.

**Areas for contribution:**

- New cloud provider integrations
- CLI improvements
- Documentation
- Bug fixes

## 📄 License

MIT © 2026 Ömer FC

See [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Coolify](https://coolify.io/) - The amazing open-source PaaS
- [Hetzner](https://www.hetzner.com/) - Affordable, reliable cloud infrastructure
- All contributors and users!

## 💬 Support & Community

- 🐛 **Bug Reports:** [GitHub Issues](https://github.com/omrfc/quicklify/issues)
- 💡 **Feature Requests:** [GitHub Discussions](https://github.com/omrfc/quicklify/discussions)
- 🐦 **Updates:** [@omrfc](https://twitter.com/omrfc)
- 🌐 **Website:** [quicklify.omrfc.dev](https://quicklify.omrfc.dev)

## ⭐ Show Your Support

If Quicklify helped you, please:

- ⭐ Star this repository
- 🐦 Share on Twitter
- 📝 Write a blog post
- 💬 Tell your friends!

---

**Made with ❤️ by [@omrfc](https://github.com/omrfc)**

*Saving developers time, one deployment at a time.* ⚡

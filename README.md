# quicklify

![Tests](https://github.com/omrfc/quicklify/actions/workflows/ci.yml/badge.svg)
![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)
![npm](https://img.shields.io/npm/v/quicklify)
![Downloads](https://img.shields.io/npm/dw/quicklify)
![License](https://img.shields.io/badge/license-MIT-blue)

> Deploy Coolify to any cloud VPS in 60 seconds

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

- 🎯 **One Command Deploy** - VPS + Coolify in 60 seconds
- 💰 **Cost Savings** - $50-200/mo (Vercel/Netlify) → €3.85/mo
- 🔒 **Secure by Default** - Automated security setup
- 🌍 **Multi-Cloud** - Hetzner, DigitalOcean support
- 💻 **Beautiful CLI** - Interactive prompts with validation
- 🎨 **ARM64 Ready** - Support for cost-effective ARM servers
- ⚡ **Fast Setup** - Production-ready in minutes

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
Access Coolify: https://123.45.67.89:8000
```

Visit the URL, create your admin account, and start deploying!

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

## 🗺️ Roadmap

### v0.1.0 (Current)

- [x] Hetzner Cloud integration
- [x] Interactive CLI
- [x] Automated Coolify installation
- [x] ARM64 support

### v0.2.0 (Next)

- [ ] DigitalOcean support
- [ ] Domain configuration helper
- [ ] SSL certificate automation
- [ ] Health checks & monitoring

### Future

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
2. **Region Selection** - Nearest datacenter auto-highlighted
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

Current coverage: **100%** across all files (statements, branches, functions, lines).

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

Contributions are welcome! Here's how:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

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

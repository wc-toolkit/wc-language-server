# Web Components - Zed Extension

Complete Zed IDE extension for web components development with full Language Server Protocol support.

## 📚 Documentation Index

### Getting Started
- **[QUICKSTART.md](./QUICKSTART.md)** - Fast setup and usage guide
- **[README.md](./README.md)** - Complete user documentation

### Development
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Developer guide and contribution instructions
- **[CHECKLIST.md](./CHECKLIST.md)** - Pre-flight checklist and testing guide
- **[COMPARISON.md](./COMPARISON.md)** - Comparison with VS Code extension

### Reference
- **[CHANGELOG.md](./CHANGELOG.md)** - Version history and updates
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Technical implementation details
- **[LICENSE](./LICENSE)** - MIT License

## 🚀 Quick Links

**For Users:**
```bash
# Install in Zed
1. Press cmd-shift-p
2. Type "zed: install dev extension"
3. Select packages/zed directory
```

**For Developers:**
```bash
# Build the extension
cd packages/zed
./build.sh
```

## 📦 What's Included

### Core Files
- `extension.toml` - Extension metadata
- `Cargo.toml` - Rust dependencies
- `src/lib.rs` - Extension implementation
- `package.json` - Language server dependency
- `build.sh` - Build automation

### Documentation
- Comprehensive README with features and setup
- Development guide with technical details
- Quick start guide for immediate use
- Checklist for testing and publishing
- Comparison with VS Code extension
- Implementation summary

## ✨ Features

- ✅ Auto-completion for web components
- ✅ Hover documentation
- ✅ Go to definition
- ✅ Diagnostics and validation
- ✅ Multi-language support (HTML, JSX, Vue, etc.)
- ✅ Custom Elements Manifest integration
- ✅ Workspace configuration

## 🎯 Key Differences from VS Code

**Included:**
- Full Language Server Protocol support
- All core editing features
- Enhanced UI labels

**Not Included (Zed architecture differences):**
- Chat Participant (Zed uses Slash Commands)
- MCP Server (could be separate extension)
- Language Model Tools (different API in Zed)

## 🔧 Requirements

- Rust (via rustup)
- Node.js & pnpm
- Zed IDE
- `@wc-toolkit/language-server` package

## 📖 How to Use This Directory

1. **First time?** Start with [QUICKSTART.md](./QUICKSTART.md)
2. **Installing?** See [README.md](./README.md)
3. **Developing?** Read [DEVELOPMENT.md](./DEVELOPMENT.md)
4. **Publishing?** Follow [CHECKLIST.md](./CHECKLIST.md)
5. **Comparing?** Check [COMPARISON.md](./COMPARISON.md)

## 🤝 Contributing

See the main repository [CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution guidelines.

## 📄 License

MIT - See [LICENSE](./LICENSE) file for details.

## 🔗 Links

- [Main Repository](https://github.com/wc-toolkit/wc-language-server)
- [VS Code Extension](../vscode)
- [Language Server](../language-server)
- [Zed IDE](https://zed.dev)
- [Zed Extensions](https://github.com/zed-industries/extensions)

---

**Status:** ✅ Complete and ready for testing  
**Version:** 0.0.31  
**Last Updated:** 2024-11-21

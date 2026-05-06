<p align="center">
  <img src="android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png" alt="PDFortuna Logo" width="120" />
</p>

<h1 align="center">PDFortuna</h1>

<p align="center">
  <strong>View and share all your PDFs in one app.</strong>
</p>

<p align="center">
  <a href="#">
    <img src="https://img.shields.io/badge/platform-Android-3ddc84?style=for-the-badge&logo=android&logoColor=white" alt="Platform Android" />
  </a>
  <a href="https://github.com/gessendarien/pdfortuna-mobile/releases">
    <img src="https://img.shields.io/badge/version-0.1.0-blue?style=for-the-badge" alt="Version" />
  </a>
  <a href="https://github.com/gessendarien/pdfortuna-mobile/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-GPLv3-blue.svg?style=for-the-badge" alt="License GPLv3" />
  </a>
</p>

---

## Project Structure

```
PDFortuna/
├── App.tsx                    # Root component with navigation & intent handling
├── index.js                   # Application entry point
├── src/
│   ├── components/
│   │   ├── ConfirmModal.tsx    # Confirmation dialog
│   │   ├── CreditsModal.tsx    # App credits & info
│   │   ├── DocxViewerModal.tsx # DOCX preview modal
│   │   ├── FavoriteParticles.tsx # Animated favorite effects
│   │   ├── FileOptionsModal.tsx # File context menu
│   │   ├── FilterModal.tsx    # Filter & sort options
│   │   ├── MarqueeText.tsx    # Scrolling overflow text
│   │   ├── PdfGridItem.tsx    # Grid view item
│   │   ├── PdfItem.tsx        # List view item
│   │   ├── RenameModal.tsx    # File rename dialog
│   │   ├── SettingsModal.tsx  # App settings
│   │   └── UndoToast.tsx      # Undo delete notification
│   ├── screens/
│   │   ├── HomeScreen.tsx     # Main file browser screen
│   │   └── PdfViewerScreen.tsx # PDF viewer screen
│   ├── services/
│   │   ├── FileService.ts     # File system operations
│   │   └── StorageService.ts  # AsyncStorage wrapper
│   ├── theme/
│   │   └── index.ts           # Design tokens & colors
│   └── utils/
│       └── FileOpenerUtils.ts # Intent & content URI handling
├── android/                   # Native Android project
└── ios/                       # Native iOS project (unused)
```
---

## License

This project is licensed under the **GNU General Public License v3.0** — see the [LICENSE](LICENSE) file for details.

<p align="center">
  Made with 💚 by Gessén Darién for Cassca Play
</p>

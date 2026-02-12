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
    <img src="https://img.shields.io/badge/version-0.0.1-blue?style=for-the-badge" alt="Version" />
  </a>
  <a href="https://github.com/gessendarien/pdfortuna-mobile/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg?style=for-the-badge" alt="License CC BY-NC 4.0" />
  </a>
</p>

---

## ✨ Features

---

## 📸 Screenshots

<!-- Add your screenshots here -->
<!-- <p align="center">
  <img src="docs/screenshots/home.png" width="200" />
  <img src="docs/screenshots/viewer.png" width="200" />
  <img src="docs/screenshots/search.png" width="200" />
</p> -->

> _Screenshots coming soon_

---

## 📂 Project Structure

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

## 📝 License

This project is licensed under the **Creative Commons Attribution-NonCommercial 4.0 International License** — see the [LICENSE](LICENSE) file for details.

You are free to use, modify, and distribute this software for non-commercial purposes under the terms of the CC BY-NC 4.0 license.


<p align="center">
  Made with 💚 by Gessén Darién for Cassca Studios
</p>

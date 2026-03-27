/**
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: 'tr.feast.desk',
  productName: 'feast.  Desk',
  copyright: 'Copyright © 2026 feast. ',
  directories: {
    buildResources: 'resources',
    output: 'dist'
  },
  files: [
    'out/**/*',
    '!out/**/*.map'
  ],
  // CRITICAL: better-sqlite3 .node file must NOT be inside ASAR archive
  asarUnpack: [
    'node_modules/better-sqlite3/**',
    'node_modules/bindings/**'
  ],
  extraResources: [
    {
      from: 'resources/icons',
      to: 'icons'
    },
    {
      from: 'src/main/server/public',
      to: 'public'
    }
  ],
  mac: {
    target: [{ target: 'dmg', arch: ['arm64', 'x64'] }],
    icon: 'resources/icons/icon.icns',
    category: 'public.app-category.business',
    darkModeSupport: false
  },
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'resources/icons/icon.ico'
  },
  nsis: {
    oneClick: false,
    allowDirChange: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'feast.  Desk'
  },
  linux: {
    target: [{ target: 'AppImage', arch: ['x64'] }],
    icon: 'resources/icons/icon.png',
    category: 'Office'
  },
  publish: null
}

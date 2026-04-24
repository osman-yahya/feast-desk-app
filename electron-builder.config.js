/**
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: 'tr.feast.desk',
  productName: 'feast. Desk',
  copyright: 'Copyright © 2026 feast. ',
  icon: 'resources/icon.ico',
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
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'resources/icon.ico'
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'feast. Desk',
    installerIcon: 'resources/icon.ico',
    uninstallerIcon: 'resources/icon.ico'
  },
  publish: {
    provider: 'github',
    owner: 'osman-yahya',
    repo: 'feast-desk-releases',
    releaseType: 'release'
  }
}

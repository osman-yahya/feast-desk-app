import electronUpdater from 'electron-updater'
import { is } from '@electron-toolkit/utils'

const { autoUpdater } = electronUpdater

export function initAutoUpdater(getMainWindow) {
  if (is.dev) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  const send = (channel, payload) => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, payload)
    }
  }

  autoUpdater.on('update-available', (info) => {
    send('update:available', { version: info.version })
  })

  autoUpdater.on('download-progress', (progress) => {
    send('update:progress', { percent: Math.round(progress.percent) })
  })

  autoUpdater.on('update-downloaded', (info) => {
    send('update:downloaded', { version: info.version })
  })

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err?.message || err)
  })

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('Update check failed:', err?.message || err)
    })
  }, 10_000)
}

export function installUpdate() {
  autoUpdater.quitAndInstall()
}

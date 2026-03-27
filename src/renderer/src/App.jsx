import React, { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell.jsx'
import { ToastProvider } from './components/ui/Toast.jsx'
import { useRestaurantStore } from './store/useRestaurantStore.js'
import { PasswordGate } from './components/ui/PasswordGate.jsx'
import { LockGuard } from './components/layout/LockGuard.jsx'

import { ConnectPage } from './pages/Connect/ConnectPage.jsx'
import { DirectOrderPage } from './pages/DirectOrder/DirectOrderPage.jsx'
import { TablesPage } from './pages/Tables/TablesPage.jsx'
import { AnalyzePage } from './pages/Analyze/AnalyzePage.jsx'
import { ServerPage } from './pages/Server/ServerPage.jsx'
import { SettingsPage } from './pages/Settings/SettingsPage.jsx'

function LoadingScreen() {
  return (
    <div className="h-screen flex items-center justify-center bg-surface-bg">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-brand rounded-2xl flex items-center justify-center animate-pulse">
          <span className="text-white font-black text-lg">F</span>
        </div>
        <p className="text-sm text-ink-muted font-medium">Loading feast. Desk...</p>
      </div>
    </div>
  )
}

export default function App() {
  const { init, isConnected, isLoading } = useRestaurantStore()

  useEffect(() => {
    init()
  }, [])

  if (isLoading) return <LoadingScreen />

  return (
    <ToastProvider>
      <Routes>
        {!isConnected ? (
          <>
            <Route path="/connect" element={<ConnectPage />} />
            <Route path="*" element={<Navigate to="/connect" replace />} />
          </>
        ) : (
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/direct-order" replace />} />
            <Route path="/direct-order" element={
              <LockGuard moduleId="direct_order"><DirectOrderPage /></LockGuard>
            } />
            <Route path="/tables" element={
              <LockGuard moduleId="tables"><TablesPage /></LockGuard>
            } />
            <Route path="/tables/editor" element={
              <LockGuard moduleId="tables"><TablesPage editorMode /></LockGuard>
            } />
            <Route path="/analyze" element={
              <LockGuard moduleId="analyze">
                <PasswordGate feature="Analytics">
                  <AnalyzePage />
                </PasswordGate>
              </LockGuard>
            } />
            <Route path="/server" element={
              <LockGuard moduleId="server">
                <PasswordGate feature="Server">
                  <ServerPage />
                </PasswordGate>
              </LockGuard>
            } />
            <Route path="/settings/*" element={
              <PasswordGate feature="Settings">
                <SettingsPage />
              </PasswordGate>
            } />
            <Route path="*" element={<Navigate to="/direct-order" replace />} />
          </Route>
        )}
      </Routes>
    </ToastProvider>
  )
}

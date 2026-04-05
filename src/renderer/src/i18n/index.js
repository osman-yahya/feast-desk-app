import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import tr from './locales/tr.json'

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    tr: { translation: tr }
  },
  lng: localStorage.getItem('feast_language') || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
})

// Sync current language to SQLite DB so the server SPA can read it
if (window.feastAPI?.settings?.set) {
  window.feastAPI.settings.set('language', i18n.language)
}

export default i18n

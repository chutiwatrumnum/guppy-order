import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { ensureLiffInit } from './utils/liff'
import './index.css'

// LIFF ไม่ได้เปิด /o/{token} ตรง ๆ
// มันเปิดหน้าแรกพร้อม ?liff.state=%2Fo%2F{token} แล้วให้ SDK พาไป path จริงตอน init
//
// ถ้ารอไป init ในหน้าใบสรุป จะไม่มีวันทำงาน เพราะตอนนั้นแอปยังอยู่ที่ "/"
// แล้วโดน ProtectedRoute เด้งเข้าหน้าล็อกอินไปก่อน — ลูกค้าที่ไม่มีบัญชีจึงไปต่อไม่ได้
// จึงต้องจัดการ liff.state ให้เสร็จก่อนเรนเดอร์ route
async function resolveLiffPath() {
  const liffState = new URLSearchParams(window.location.search).get('liff.state')
  if (!liffState) return

  try {
    await ensureLiffInit()
  } catch (err) {
    console.warn('LIFF init failed:', err)
  }

  // ปกติ SDK จะ redirect ให้เอง แต่ถ้ายังค้างอยู่หน้าแรกก็พาไปเองซะเลย
  // เผื่อ init ล้มเหลว จะได้ไม่ทิ้งลูกค้าไว้ที่หน้าล็อกอิน
  if (window.location.pathname === '/' && liffState.startsWith('/')) {
    window.history.replaceState(null, '', liffState)
  }
}

resolveLiffPath().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </React.StrictMode>,
  )
})

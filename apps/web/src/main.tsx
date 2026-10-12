import '@formknit/react/styles.css'
import '@formknit/builder/styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './app.css'
import { AuthPage, AuthProvider, RequireAuth } from './auth'
import { FormPage, SubmissionPage } from './FormPage'
import { FormsPage } from './FormsPage'
import { PublicForm } from './PublicForm'
import { Shell } from './Shell'

const signedIn = (page: React.ReactNode) => (
  <RequireAuth>
    <Shell>{page}</Shell>
  </RequireAuth>
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/f/:slug" element={<PublicForm />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/" element={signedIn(<FormsPage />)} />
          <Route path="/forms/:id" element={signedIn(<FormPage />)} />
          <Route path="/submissions/:id" element={signedIn(<SubmissionPage />)} />
          <Route path="*" element={<div className="center muted">Page not found</div>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

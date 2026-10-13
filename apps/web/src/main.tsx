import '@formknit/react/styles.css'
import '@formknit/builder/styles.css'
import '@formknit/richtext/styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './app.css'
import { AccountPage } from './Account'
import { AuthPage, AuthProvider, ForgotPage, InvitePage, RequireAuth, ResetPage } from './auth'
import { DashboardPage } from './Dashboard'
import { FormPage, SubmissionPage } from './FormPage'
import { FormsPage } from './FormsPage'
import { PublicForm } from './PublicForm'
import { Shell } from './Shell'
import { TeamPage } from './Team'

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
          <Route path="/forgot" element={<ForgotPage />} />
          <Route path="/reset" element={<ResetPage />} />
          <Route path="/" element={signedIn(<DashboardPage />)} />
          <Route path="/forms" element={signedIn(<FormsPage />)} />
          <Route path="/invite" element={<InvitePage />} />
          <Route path="/team" element={signedIn(<TeamPage />)} />
          <Route path="/account" element={signedIn(<AccountPage />)} />
          <Route path="/forms/:id" element={signedIn(<FormPage />)} />
          <Route path="/submissions/:id" element={signedIn(<SubmissionPage />)} />
          <Route path="*" element={<div className="center muted">Page not found</div>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

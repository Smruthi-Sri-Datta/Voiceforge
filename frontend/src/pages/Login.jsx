import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}

function OtpBoxes({ value, onChange }) {
  const inputRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()]

  function handleChange(i, e) {
    const char = e.target.value.replace(/\D/g, '').slice(-1)
    const arr  = value.split(''); arr[i] = char; onChange(arr.join(''))
    if (char && i < 5) inputRefs[i + 1].current?.focus()
  }
  function handleKey(i, e) {
    if (e.key === 'Backspace' && !value[i] && i > 0) inputRefs[i - 1].current?.focus()
  }
  function handlePaste(e) {
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (p) { onChange(p.padEnd(6, '').slice(0, 6)); inputRefs[Math.min(p.length, 5)].current?.focus() }
    e.preventDefault()
  }

  return (
    <div style={{ display: 'flex', gap: '0.55rem', justifyContent: 'center' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input key={i} ref={inputRefs[i]} type="text" inputMode="numeric" maxLength={1}
          value={value[i] || ''}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          style={{
            width: '46px', height: '54px', textAlign: 'center',
            fontSize: '1.4rem', fontWeight: '700', borderRadius: '10px',
            border: `2px solid ${value[i] ? '#7c3aed' : '#2a2a4a'}`,
            background: value[i] ? '#7c3aed18' : '#0d0d14',
            color: '#e2e8f0', outline: 'none', transition: 'all 0.15s',
          }}
        />
      ))}
    </div>
  )
}

// ── Password Strength Checker ──────────────────────────────
function PasswordStrength({ password }) {
  const checks = [
    { label: 'Uppercase letter',     pass: /[A-Z]/.test(password) },
    { label: 'Lowercase letter',     pass: /[a-z]/.test(password) },
    { label: 'Number',               pass: /[0-9]/.test(password) },
    { label: 'Special character (e.g. !?<>@#$%)', pass: /[!?<>@#$%^&*]/.test(password) },
    { label: '8 characters or more', pass: password.length >= 8 },
  ]

  if (!password) return null

  return (
    <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      {checks.map(({ label, pass }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: pass ? '#22c55e' : '#888', transition: 'color 0.2s' }}>
          <span style={{ fontSize: '0.7rem' }}>{pass ? '✅' : '⭕'}</span>
          {label}
        </div>
      ))}
    </div>
  )
}

export default function Login() {
  const { loginWithGoogle, emailRegister, emailLogin, verifyOtp, resendOtp } = useAuth()
  const { isDark } = useTheme()

  const [mode, setMode]         = useState('login')    // 'login' | 'register' | 'otp'
  const [authTab, setAuthTab]   = useState('email')    // 'email' | 'google'

  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [otp, setOtp]           = useState('')

  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [success, setSuccess]   = useState(null)
  const [cooldown, setCooldown] = useState(0)

  const t = {
    bg:          isDark ? '#0d0d14' : '#f8f8fc',
    cardBg:      isDark ? '#13131f' : '#ffffff',
    cardBorder:  isDark ? '#1e1e2e' : '#e8e8ec',
    textColor:   isDark ? '#e2e8f0' : '#111118',
    labelColor:  isDark ? '#666'    : '#999',
    inputBg:     isDark ? '#0d0d14' : '#fafafa',
    inputBorder: isDark ? '#2a2a3a' : '#d8d8e0',
    divider:     isDark ? '#1e1e2e' : '#eeeeee',
    tabBg:       isDark ? '#0d0d14' : '#f4f4f8',
    tabActive:   isDark ? '#1e1e2e' : '#ffffff',
  }

  const clear = () => { setError(null); setSuccess(null) }

  const inputStyle = {
    width: '100%', padding: '0.78rem 1rem',
    background: t.inputBg, border: `1px solid ${t.inputBorder}`,
    borderRadius: '10px', color: t.textColor,
    fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
    fontFamily: "'Segoe UI', sans-serif", transition: 'border-color 0.15s',
  }

  const primaryBtn = (disabled) => ({
    width: '100%', padding: '0.85rem', borderRadius: '10px', border: 'none',
    background: disabled ? (isDark ? '#2a2a4a' : '#e5e5e8') : 'linear-gradient(135deg, #7c3aed, #a855f7)',
    color: disabled ? (isDark ? '#555' : '#bbb') : 'white',
    fontSize: '0.92rem', fontWeight: '700', cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: "'Segoe UI', sans-serif", transition: 'all 0.2s',
    boxShadow: disabled ? 'none' : '0 4px 16px rgba(124,58,237,0.3)',
  })

  async function handleRegister(e) {
    e.preventDefault(); clear()
    if (!name.trim()) { setError('Please enter your name.'); return }
    if (password.length < 8)          { setError('Password must be at least 8 characters.'); return }
    if (!/[A-Z]/.test(password))      { setError('Password must contain at least one uppercase letter.'); return }
    if (!/[a-z]/.test(password))      { setError('Password must contain at least one lowercase letter.'); return }
    if (!/[0-9]/.test(password))      { setError('Password must contain at least one number.'); return }
    if (!/[!?<>@#$%^&*]/.test(password)) { setError('Password must contain at least one special character.'); return }
    setLoading(true)
    try { await emailRegister(name.trim(), email, password); setMode('otp'); setSuccess('Check your email for a 6-digit code.') }
    catch (err) { setError(err.message) }
    setLoading(false)
  }

  async function handleLogin(e) {
    e.preventDefault(); clear(); setLoading(true)
    try { await emailLogin(email, password) }
    catch (err) {
      if (err.status === 403) { setMode('otp'); setSuccess('A verification code has been sent to your email.') }
      else setError(err.message)
    }
    setLoading(false)
  }

  async function handleOtp(e) {
    e?.preventDefault()
    if (otp.length < 6) { setError('Please enter the full 6-digit code.'); return }
    clear(); setLoading(true)
    try { await verifyOtp(email, otp) }
    catch (err) { setError(err.message); setOtp('') }
    setLoading(false)
  }

  async function handleResend() {
    if (cooldown > 0) return; clear()
    try {
      await resendOtp(email); setSuccess('A new code has been sent.')
      setCooldown(60)
      const iv = setInterval(() => setCooldown(p => { if (p <= 1) { clearInterval(iv); return 0 } return p - 1 }), 1000)
    } catch (err) { setError(err.message) }
  }

  const ErrorBox   = () => error   ? <div style={{ marginBottom: '1rem', padding: '0.7rem 0.9rem', background: isDark ? '#2a1a1a' : '#fff5f5', border: `1px solid ${isDark ? '#7f1d1d' : '#fecaca'}`, borderRadius: '8px', color: '#ef4444', fontSize: '0.82rem' }}>⚠️ {error}</div> : null
  const SuccessBox = () => success ? <div style={{ marginBottom: '1rem', padding: '0.7rem 0.9rem', background: isDark ? '#0f2a1a' : '#f0fdf4', border: `1px solid ${isDark ? '#14532d' : '#bbf7d0'}`, borderRadius: '8px', color: '#22c55e', fontSize: '0.82rem' }}>✅ {success}</div> : null

  return (
    <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI', sans-serif", padding: '2rem' }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: isDark ? 'radial-gradient(ellipse 70% 50% at 50% 10%, #7c3aed1a 0%, transparent 70%)' : 'radial-gradient(ellipse 70% 50% at 50% 10%, #7c3aed08 0%, transparent 70%)' }} />

      <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '22px', padding: '2.5rem', width: '100%', maxWidth: '420px', boxShadow: isDark ? '0 24px 60px rgba(0,0,0,0.45)' : '0 24px 60px rgba(0,0,0,0.1)', position: 'relative', zIndex: 1 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', margin: '0 auto 1rem', boxShadow: '0 8px 24px rgba(124,58,237,0.35)' }}>🎙️</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: t.textColor }}>VoiceForge</div>
          <div style={{ fontSize: '0.85rem', color: t.labelColor, marginTop: '0.3rem' }}>
            {mode === 'otp'      ? 'Enter your verification code'  :
             mode === 'register' ? 'Create your account'           : 'Sign in to continue'}
          </div>
        </div>

        {/* ── OTP step ── */}
        {mode === 'otp' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📬</div>
              <div style={{ fontSize: '0.85rem', color: t.labelColor, lineHeight: '1.7' }}>
                We sent a 6-digit code to<br />
                <strong style={{ color: t.textColor }}>{email}</strong>
              </div>
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <OtpBoxes value={otp} onChange={v => { setOtp(v); clear() }} />
            </div>
            <ErrorBox /><SuccessBox />
            <button onClick={handleOtp} disabled={loading || otp.length < 6} style={primaryBtn(loading || otp.length < 6)}>
              {loading ? '⏳ Verifying...' : 'Verify & Sign In'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '1.1rem', fontSize: '0.82rem', color: t.labelColor }}>
              Didn't receive it?{' '}
              <button onClick={handleResend} disabled={cooldown > 0}
                style={{ background: 'none', border: 'none', cursor: cooldown > 0 ? 'default' : 'pointer', color: cooldown > 0 ? t.labelColor : '#a78bfa', fontWeight: '700', fontSize: '0.82rem', padding: 0 }}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
            </div>
            <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
              <button onClick={() => { setMode('login'); setOtp(''); clear() }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.labelColor, fontSize: '0.8rem' }}>
                ← Back to sign in
              </button>
            </div>
          </>
        )}

        {/* ── Login / Register steps ── */}
        {mode !== 'otp' && (
          <>
            {/* Tabs */}
            <div style={{ display: 'flex', background: t.tabBg, borderRadius: '11px', padding: '3px', marginBottom: '1.6rem', gap: '3px' }}>
              {[{ key: 'email', label: '✉️ Email' }, { key: 'google', label: '🔵 Google' }].map(tab => (
                <button key={tab.key} onClick={() => { setAuthTab(tab.key); clear() }}
                  style={{ flex: 1, padding: '0.58rem', borderRadius: '9px', border: 'none', background: authTab === tab.key ? t.tabActive : 'transparent', color: authTab === tab.key ? t.textColor : t.labelColor, fontWeight: authTab === tab.key ? '600' : '400', fontSize: '0.86rem', cursor: 'pointer', transition: 'all 0.15s', boxShadow: authTab === tab.key && !isDark ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', fontFamily: "'Segoe UI', sans-serif" }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Google tab */}
            {authTab === 'google' && (
              <div>
                <button onClick={loginWithGoogle}
                  style={{ width: '100%', padding: '0.85rem 1.2rem', borderRadius: '10px', border: `1px solid ${t.cardBorder}`, background: isDark ? '#1a1a2e' : '#ffffff', color: t.textColor, fontSize: '0.92rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', transition: 'all 0.2s', fontFamily: "'Segoe UI', sans-serif", boxShadow: isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1.2rem' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed55'; e.currentTarget.style.background = isDark ? '#1e1a2e' : '#faf8ff'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(124,58,237,0.12)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = t.cardBorder; e.currentTarget.style.background = isDark ? '#1a1a2e' : '#ffffff'; e.currentTarget.style.boxShadow = isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <GoogleIcon /> Continue with Google
                </button>
                <div style={{ fontSize: '0.78rem', color: t.labelColor, textAlign: 'center', lineHeight: '1.6' }}>
                  Google sign-in automatically links to any existing email account with the same address.
                </div>
              </div>
            )}

            {/* Email tab */}
            {authTab === 'email' && (
              <form onSubmit={mode === 'register' ? handleRegister : handleLogin}>
                {mode === 'register' && (
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: t.labelColor, letterSpacing: '0.5px', display: 'block', marginBottom: '0.4rem' }}>NAME</label>
                    <input type="text" placeholder="Your full name" value={name} onChange={e => { setName(e.target.value); clear() }} style={inputStyle}
                      onFocus={e => e.target.style.borderColor = '#7c3aed'}
                      onBlur={e => e.target.style.borderColor = t.inputBorder} required />
                  </div>
                )}

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: t.labelColor, letterSpacing: '0.5px', display: 'block', marginBottom: '0.4rem' }}>EMAIL</label>
                  <input type="email" placeholder="you@example.com" value={email} onChange={e => { setEmail(e.target.value); clear() }} style={inputStyle}
                    onFocus={e => e.target.style.borderColor = '#7c3aed'}
                    onBlur={e => e.target.style.borderColor = t.inputBorder} required />
                </div>

                {/* ── PASSWORD FIELD + STRENGTH CHECKER ── */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: t.labelColor, letterSpacing: '0.5px', display: 'block', marginBottom: '0.4rem' }}>PASSWORD</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPass ? 'text' : 'password'} placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'} value={password} onChange={e => { setPassword(e.target.value); clear() }} style={{ ...inputStyle, paddingRight: '2.8rem' }}
                      onFocus={e => e.target.style.borderColor = '#7c3aed'}
                      onBlur={e => e.target.style.borderColor = t.inputBorder} required />
                    <button type="button" onClick={() => setShowPass(p => !p)}
                      style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: t.labelColor, fontSize: '0.85rem', padding: 0 }}>
                      {showPass ? '🙈' : '👁️'}
                    </button>
                  </div>
                  {/* Shows only on register mode, only when user starts typing */}
                  {mode === 'register' && <PasswordStrength password={password} />}
                </div>

                <ErrorBox /><SuccessBox />

                <button type="submit" disabled={loading} style={primaryBtn(loading)}>
                  {loading
                    ? (mode === 'register' ? '⏳ Creating account...' : '⏳ Signing in...')
                    : (mode === 'register' ? 'Create Account' : 'Sign In')}
                </button>

                <div style={{ textAlign: 'center', marginTop: '1.2rem', fontSize: '0.84rem', color: t.labelColor }}>
                  {mode === 'login'
                    ? <>Don't have an account?{' '}<button onClick={() => { setMode('register'); clear() }} type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a78bfa', fontWeight: '700', fontSize: '0.84rem', padding: 0 }}>Sign up</button></>
                    : <>Already have an account?{' '}<button onClick={() => { setMode('login'); clear() }} type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a78bfa', fontWeight: '700', fontSize: '0.84rem', padding: 0 }}>Sign in</button></>
                  }
                </div>
              </form>
            )}
          </>
        )}

        {/* Footer */}
        <div style={{ marginTop: '1.8rem', borderTop: `1px solid ${t.divider}`, paddingTop: '1.1rem', fontSize: '0.73rem', color: t.labelColor, textAlign: 'center', lineHeight: '1.6' }}>
          By continuing, you agree to use this platform responsibly.
        </div>
      </div>
    </div>
  )
}
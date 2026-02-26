import { useState } from 'react'
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

function OtpBoxes({ value, onChange, isDark }) {
  function handleChange(i, e) {
    const char = e.target.value.replace(/\D/g, '').slice(-1)
    const arr  = value.split(''); arr[i] = char; onChange(arr.join(''))
    if (char && i < 5) document.getElementById(`modal-otp-${i + 1}`)?.focus()
  }
  function handleKey(i, e) {
    if (e.key === 'Backspace' && !value[i] && i > 0) document.getElementById(`modal-otp-${i - 1}`)?.focus()
  }
  function handlePaste(e) {
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (p) { onChange(p.padEnd(6, '').slice(0, 6)); document.getElementById(`modal-otp-${Math.min(p.length, 5)}`)?.focus() }
    e.preventDefault()
  }
  return (
    <div style={{ display: 'flex', gap: '0.45rem', justifyContent: 'center' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input key={i} id={`modal-otp-${i}`} type="text" inputMode="numeric" maxLength={1}
          value={value[i] || ''}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          style={{
            width: '40px', height: '48px', textAlign: 'center',
            fontSize: '1.25rem', fontWeight: '700', borderRadius: '9px',
            border: `2px solid ${value[i] ? '#7c3aed' : (isDark ? '#2a2a4a' : '#d8d8e0')}`,
            background: value[i] ? '#7c3aed18' : (isDark ? '#0d0d14' : '#fafafa'),
            color: isDark ? '#e2e8f0' : '#111118',
            outline: 'none', transition: 'all 0.15s',
          }}
        />
      ))}
    </div>
  )
}

export default function AuthModal({ reason }) {
  const { loginWithGoogle, emailRegister, emailLogin, verifyOtp, resendOtp, forgotPassword, resetPassword, closeAuthModal } = useAuth()
  const { isDark } = useTheme()

  // 'main' | 'login' | 'register' | 'otp' | 'forgot' | 'reset'
  const [step, setStep]         = useState('main')
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
    cardBg:      isDark ? '#13131f' : '#ffffff',
    cardBorder:  isDark ? '#2a2a4a' : '#e5e5e8',
    textColor:   isDark ? '#e2e8f0' : '#111118',
    labelColor:  isDark ? '#888'    : '#999',
    divider:     isDark ? '#1e1e2e' : '#eeeeee',
    inputBg:     isDark ? '#0d0d14' : '#fafafa',
    inputBorder: isDark ? '#2a2a3a' : '#d8d8e0',
    rowBg:       isDark ? '#0d0d14' : '#f8f8fc',
  }

  const clear = () => { setError(null); setSuccess(null) }

  const inputStyle = {
    width: '100%', padding: '0.72rem 0.95rem',
    background: t.inputBg, border: `1px solid ${t.inputBorder}`,
    borderRadius: '9px', color: t.textColor, fontSize: '0.88rem',
    outline: 'none', boxSizing: 'border-box',
    fontFamily: "'Segoe UI', sans-serif", transition: 'border-color 0.15s',
  }

  const primaryBtn = (disabled) => ({
    width: '100%', padding: '0.8rem', borderRadius: '9px', border: 'none',
    background: disabled ? (isDark ? '#2a2a4a' : '#e5e5e8') : 'linear-gradient(135deg, #7c3aed, #a855f7)',
    color: disabled ? (isDark ? '#555' : '#bbb') : 'white',
    fontSize: '0.9rem', fontWeight: '700', cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: "'Segoe UI', sans-serif", transition: 'all 0.2s',
    boxShadow: disabled ? 'none' : '0 4px 14px rgba(124,58,237,0.28)',
  })

  const ErrorBox   = () => error   ? <div style={{ marginBottom: '0.9rem', padding: '0.65rem 0.85rem', background: isDark ? '#2a1a1a' : '#fff5f5', border: `1px solid ${isDark ? '#7f1d1d' : '#fecaca'}`, borderRadius: '8px', color: '#ef4444', fontSize: '0.8rem' }}>⚠️ {error}</div> : null
  const SuccessBox = () => success ? <div style={{ marginBottom: '0.9rem', padding: '0.65rem 0.85rem', background: isDark ? '#0f2a1a' : '#f0fdf4', border: `1px solid ${isDark ? '#14532d' : '#bbf7d0'}`, borderRadius: '8px', color: '#22c55e', fontSize: '0.8rem' }}>✅ {success}</div> : null

  // ── Handlers ──────────────────────────────────────────────
  async function handleRegister(e) {
    e.preventDefault(); clear()
    if (!name.trim()) { setError('Please enter your name.'); return }
    if (password.length < 8)              { setError('Password must be at least 8 characters.'); return }
    if (!/[A-Z]/.test(password))          { setError('Password must contain at least one uppercase letter.'); return }
    if (!/[a-z]/.test(password))          { setError('Password must contain at least one lowercase letter.'); return }
    if (!/[0-9]/.test(password))          { setError('Password must contain at least one number.'); return }
    if (!/[!?<>@#$%^&*]/.test(password))  { setError('Password must contain at least one special character.'); return }
    setLoading(true)
    try {
      await emailRegister(name.trim(), email, password)
      setStep('otp')
      setSuccess('Check your email for a 6-digit verification code.')
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  async function handleLogin(e) {
    e.preventDefault(); clear(); setLoading(true)
    try { await emailLogin(email, password) }
    catch (err) {
      if (err.status === 403) { setStep('otp'); setSuccess('A verification code has been sent to your email.') }
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

  async function handleForgotPassword(e) {
    e.preventDefault(); clear(); setLoading(true)
    try {
      await forgotPassword(email)
      setSuccess('Password reset code sent to your email.')
      setStep('reset')
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  async function handleResetPassword(e) {
    e.preventDefault(); clear()
    if (password.length < 8)              { setError('Password must be at least 8 characters.'); return }
    if (!/[A-Z]/.test(password))          { setError('Password must contain an uppercase letter.'); return }
    if (!/[a-z]/.test(password))          { setError('Password must contain a lowercase letter.'); return }
    if (!/[0-9]/.test(password))          { setError('Password must contain a number.'); return }
    if (!/[!?<>@#$%^&*]/.test(password))  { setError('Password must contain a special character.'); return }
    setLoading(true)
    try {
      await resetPassword(email, otp, password)
      setSuccess('Password reset! You can now sign in.')
      setStep('login'); setPassword(''); setOtp('')
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', fontFamily: "'Segoe UI', sans-serif", padding: '1rem' }}>
      <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: '20px', padding: '2rem', width: '100%', maxWidth: '370px', boxShadow: '0 24px 60px rgba(0,0,0,0.35)', position: 'relative' }}>

        {/* Close button */}
        <button onClick={closeAuthModal}
          style={{ position: 'absolute', top: '1rem', right: '1rem', width: '28px', height: '28px', borderRadius: '50%', background: isDark ? '#1e1e2e' : '#f0f0f5', border: 'none', cursor: 'pointer', color: t.labelColor, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.background = isDark ? '#2a2a4a' : '#e5e5e8'}
          onMouseLeave={e => e.currentTarget.style.background = isDark ? '#1e1e2e' : '#f0f0f5'}>✕</button>

        {/* Logo + title */}
        <div style={{ textAlign: 'center', marginBottom: '1.4rem' }}>
          <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', margin: '0 auto 0.75rem', boxShadow: '0 6px 20px rgba(124,58,237,0.3)' }}>🎙️</div>
          <div style={{ fontSize: '1.05rem', fontWeight: '700', color: t.textColor }}>
            {step === 'otp'      ? 'Verify your email'      :
             step === 'login'    ? 'Sign in'                :
             step === 'register' ? 'Create an account'      :
             step === 'forgot'   ? 'Reset your password'    :
             step === 'reset'    ? 'Set new password'       :
             reason === 'tts'    ? 'Free generation used'   :
             reason === 'clone'  ? 'Free clone used'        : 'Sign in to VoiceForge'}
          </div>
          <div style={{ fontSize: '0.78rem', color: t.labelColor, marginTop: '0.25rem' }}>
            {step === 'otp'    ? `Code sent to ${email}`           :
             step === 'reset'  ? `Code sent to ${email}`           :
             step === 'forgot' ? 'Enter your email to get a code'  :
             step === 'main'   ? (reason ? 'Sign in for unlimited access' : 'Choose how to continue') : ''}
          </div>
        </div>

        {/* ── MAIN step ── */}
        {step === 'main' && (
          <>
            {reason && (
              <div style={{ background: t.rowBg, border: `1px solid ${t.cardBorder}`, borderRadius: '10px', padding: '0.85rem', marginBottom: '1.2rem' }}>
                {['⚡ Unlimited TTS generations', '🎙️ Unlimited voice cloning', '🕑 History saved across sessions', '🌍 All 7 languages'].map((perk, i, arr) => (
                  <div key={i} style={{ fontSize: '0.78rem', color: t.textColor, padding: '0.28rem 0', borderBottom: i < arr.length - 1 ? `1px solid ${t.divider}` : 'none' }}>{perk}</div>
                ))}
              </div>
            )}

            <button onClick={loginWithGoogle}
              style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '10px', border: `1px solid ${t.cardBorder}`, background: isDark ? '#1a1a2e' : '#ffffff', color: t.textColor, fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.7rem', transition: 'all 0.2s', fontFamily: "'Segoe UI', sans-serif", boxShadow: isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '0.75rem' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed55'; e.currentTarget.style.background = isDark ? '#1e1a2e' : '#faf8ff' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = t.cardBorder; e.currentTarget.style.background = isDark ? '#1a1a2e' : '#ffffff' }}>
              <GoogleIcon /> Continue with Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '0.75rem' }}>
              <div style={{ flex: 1, height: '1px', background: t.divider }} />
              <span style={{ fontSize: '0.73rem', color: t.labelColor }}>or</span>
              <div style={{ flex: 1, height: '1px', background: t.divider }} />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button onClick={() => { setStep('login'); clear() }}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '9px', border: `1px solid ${t.cardBorder}`, background: 'transparent', color: t.textColor, fontSize: '0.86rem', fontWeight: '600', cursor: 'pointer', fontFamily: "'Segoe UI', sans-serif", transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed55'; e.currentTarget.style.background = isDark ? '#1a1a2e' : '#faf8ff' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = t.cardBorder; e.currentTarget.style.background = 'transparent' }}>
                Sign in
              </button>
              <button onClick={() => { setStep('register'); clear() }}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '9px', border: 'none', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: 'white', fontSize: '0.86rem', fontWeight: '700', cursor: 'pointer', fontFamily: "'Segoe UI', sans-serif", boxShadow: '0 4px 14px rgba(124,58,237,0.28)' }}>
                Sign up free
              </button>
            </div>

            <div style={{ fontSize: '0.72rem', color: t.labelColor, textAlign: 'center' }}>
              Free to join · No credit card required
            </div>
          </>
        )}

        {/* ── OTP step ── */}
        {step === 'otp' && (
          <>
            <OtpBoxes value={otp} onChange={v => { setOtp(v); clear() }} isDark={isDark} />
            <div style={{ marginTop: '1.2rem' }}>
              <ErrorBox /><SuccessBox />
              <button onClick={handleOtp} disabled={loading || otp.length < 6} style={primaryBtn(loading || otp.length < 6)}>
                {loading ? '⏳ Verifying...' : 'Verify & Sign In'}
              </button>
            </div>
            <div style={{ textAlign: 'center', marginTop: '0.85rem', fontSize: '0.79rem', color: t.labelColor }}>
              Didn't get the code?{' '}
              <button onClick={handleResend} disabled={cooldown > 0}
                style={{ background: 'none', border: 'none', cursor: cooldown > 0 ? 'default' : 'pointer', color: cooldown > 0 ? t.labelColor : '#a78bfa', fontWeight: '700', fontSize: '0.79rem', padding: 0 }}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend'}
              </button>
            </div>
            <div style={{ textAlign: 'center', marginTop: '0.6rem' }}>
              <button onClick={() => { setStep('main'); setOtp(''); clear() }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.labelColor, fontSize: '0.77rem' }}>← Back</button>
            </div>
          </>
        )}

        {/* ── Forgot Password step ── */}
        {step === 'forgot' && (
          <form onSubmit={handleForgotPassword}>
            <div style={{ marginBottom: '0.9rem' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: '700', color: t.labelColor, letterSpacing: '0.5px', display: 'block', marginBottom: '0.35rem' }}>EMAIL</label>
              <input type="email" placeholder="you@example.com" value={email} onChange={e => { setEmail(e.target.value); clear() }} style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#7c3aed'}
                onBlur={e => e.target.style.borderColor = t.inputBorder} required />
            </div>
            <ErrorBox /><SuccessBox />
            <button type="submit" disabled={loading} style={primaryBtn(loading)}>
              {loading ? '⏳ Sending...' : 'Send Reset Code'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
              <button type="button" onClick={() => { setStep('login'); clear() }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.labelColor, fontSize: '0.77rem' }}>← Back to sign in</button>
            </div>
          </form>
        )}

        {/* ── Reset Password step ── */}
        {step === 'reset' && (
          <form onSubmit={handleResetPassword}>
            <div style={{ marginBottom: '1rem' }}>
              <OtpBoxes value={otp} onChange={v => { setOtp(v); clear() }} isDark={isDark} />
            </div>
            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: '700', color: t.labelColor, letterSpacing: '0.5px', display: 'block', marginBottom: '0.35rem' }}>NEW PASSWORD</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} placeholder="At least 8 characters" value={password} onChange={e => { setPassword(e.target.value); clear() }} style={{ ...inputStyle, paddingRight: '2.6rem' }}
                  onFocus={e => e.target.style.borderColor = '#7c3aed'}
                  onBlur={e => e.target.style.borderColor = t.inputBorder} required />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  style={{ position: 'absolute', right: '0.7rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: t.labelColor, fontSize: '0.82rem', padding: 0 }}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <ErrorBox /><SuccessBox />
            <button type="submit" disabled={loading || otp.length < 6} style={primaryBtn(loading || otp.length < 6)}>
              {loading ? '⏳ Resetting...' : 'Reset Password'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
              <button type="button" onClick={() => { setStep('login'); clear() }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.labelColor, fontSize: '0.77rem' }}>← Back to sign in</button>
            </div>
          </form>
        )}

        {/* ── Login step ── */}
        {step === 'login' && (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '0.9rem' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: '700', color: t.labelColor, letterSpacing: '0.5px', display: 'block', marginBottom: '0.35rem' }}>EMAIL</label>
              <input type="email" placeholder="you@example.com" value={email} onChange={e => { setEmail(e.target.value); clear() }} style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#7c3aed'}
                onBlur={e => e.target.style.borderColor = t.inputBorder} required />
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: '700', color: t.labelColor, letterSpacing: '0.5px', display: 'block', marginBottom: '0.35rem' }}>PASSWORD</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} placeholder="Your password" value={password} onChange={e => { setPassword(e.target.value); clear() }} style={{ ...inputStyle, paddingRight: '2.6rem' }}
                  onFocus={e => e.target.style.borderColor = '#7c3aed'}
                  onBlur={e => e.target.style.borderColor = t.inputBorder} required />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  style={{ position: 'absolute', right: '0.7rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: t.labelColor, fontSize: '0.82rem', padding: 0 }}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Forgot password link */}
            <div style={{ textAlign: 'right', marginBottom: '1.2rem' }}>
              <button type="button" onClick={() => { setStep('forgot'); clear() }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a78bfa', fontSize: '0.77rem', fontWeight: '600', padding: 0 }}>
                Forgot password?
              </button>
            </div>

            <ErrorBox /><SuccessBox />
            <button type="submit" disabled={loading} style={primaryBtn(loading)}>
              {loading ? '⏳ Signing in...' : 'Sign In'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '0.9rem', fontSize: '0.8rem', color: t.labelColor }}>
              No account?{' '}
              <button type="button" onClick={() => { setStep('register'); clear() }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a78bfa', fontWeight: '700', fontSize: '0.8rem', padding: 0 }}>Sign up</button>
            </div>
            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <button type="button" onClick={() => { setStep('main'); clear() }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.labelColor, fontSize: '0.77rem' }}>← Back</button>
            </div>
          </form>
        )}

        {/* ── Register step ── */}
        {step === 'register' && (
          <form onSubmit={handleRegister}>
            <div style={{ marginBottom: '0.9rem' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: '700', color: t.labelColor, letterSpacing: '0.5px', display: 'block', marginBottom: '0.35rem' }}>NAME</label>
              <input type="text" placeholder="Your full name" value={name} onChange={e => { setName(e.target.value); clear() }} style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#7c3aed'}
                onBlur={e => e.target.style.borderColor = t.inputBorder} required />
            </div>
            <div style={{ marginBottom: '0.9rem' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: '700', color: t.labelColor, letterSpacing: '0.5px', display: 'block', marginBottom: '0.35rem' }}>EMAIL</label>
              <input type="email" placeholder="you@example.com" value={email} onChange={e => { setEmail(e.target.value); clear() }} style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#7c3aed'}
                onBlur={e => e.target.style.borderColor = t.inputBorder} required />
            </div>
            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: '700', color: t.labelColor, letterSpacing: '0.5px', display: 'block', marginBottom: '0.35rem' }}>PASSWORD</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} placeholder="At least 8 characters" value={password} onChange={e => { setPassword(e.target.value); clear() }} style={{ ...inputStyle, paddingRight: '2.6rem' }}
                  onFocus={e => e.target.style.borderColor = '#7c3aed'}
                  onBlur={e => e.target.style.borderColor = t.inputBorder} required />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  style={{ position: 'absolute', right: '0.7rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: t.labelColor, fontSize: '0.82rem', padding: 0 }}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <ErrorBox /><SuccessBox />
            <button type="submit" disabled={loading} style={primaryBtn(loading)}>
              {loading ? '⏳ Creating account...' : 'Create Account'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '0.9rem', fontSize: '0.8rem', color: t.labelColor }}>
              Already have an account?{' '}
              <button type="button" onClick={() => { setStep('login'); clear() }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a78bfa', fontWeight: '700', fontSize: '0.8rem', padding: 0 }}>Sign in</button>
            </div>
            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <button type="button" onClick={() => { setStep('main'); clear() }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.labelColor, fontSize: '0.77rem' }}>← Back</button>
            </div>
          </form>
        )}

      </div>
    </div>
  )
}
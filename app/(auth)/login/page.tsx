'use client'
import { useState, useRef, useEffect } from 'react'
import { sendOTP, verifyOTPAndLogin } from '@/lib/auth'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged, signOut, setPersistence, browserSessionPersistence, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export default function LoginPage() {
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [aadhar, setAadhar] = useState('')
  const [selectedRole, setSelectedRole] = useState<'citizen' | 'moderator'>('citizen')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const confirmationRef = useRef<any>(null)

  // Force clear session when login page loads
  useEffect(() => {
    const clearSession = async () => {
      try {
        await setPersistence(auth, browserSessionPersistence)
        await signOut(auth)
      } catch (e) {
        console.error(e)
      }
      localStorage.clear()
      sessionStorage.clear()
      try {
        const databases = await indexedDB.databases()
        databases.forEach(db => {
          if (db.name) indexedDB.deleteDatabase(db.name)
        })
      } catch (e) {
        console.error(e)
      }
    }
    clearSession()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (step === 'phone') handleSendOTP()
      if (step === 'otp') handleVerifyOTP()
    }
  }

  const handleSendOTP = async () => {
    if (!name.trim()) {
      setError('Please enter your name')
      return
    }
    if (aadhar.length !== 12) {
      setError('Aadhar must be exactly 12 digits')
      return
    }
    if (!phone || phone.length !== 10) {
      setError('Enter valid 10-digit phone number')
      return
    }
    setLoading(true)
    setError('')
    try {
      const confirmation = await sendOTP(phone)
      confirmationRef.current = confirmation
      setStep('otp')
    } catch (err: any) {
      setError('Failed to send OTP: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async () => {
    if (!otp || otp.length < 6) {
      setError('Enter 6-digit OTP')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { role } = await verifyOTPAndLogin(
        confirmationRef.current,
        otp,
        selectedRole,
        name,
        aadhar
      )
      
      // Hard redirect based on role
      if (role === 'moderator') {
        window.location.replace('/moderator')
      } else {
        window.location.replace('/dashboard')
      }
    } catch (err: any) {
      setLoading(false)
      if (err.code === 'auth/invalid-verification-code') {
        setError('Wrong OTP. Use 123456 for test number.')
      } else {
        setError('Login failed: ' + err.message)
      }
    }
  }

  const handleGoogleLogin = async (roleSelected: 'citizen' | 'moderator') => {
    setLoading(true)
    setError('')
    try {
      await signOut(auth)
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      const user = result.user

      const userRef = doc(db, 'users', user.uid)
      const userSnap = await getDoc(userRef)
      const cleanRole = roleSelected.trim().toLowerCase()

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          phone: user.phoneNumber || '',
          name: user.displayName || 'User',
          email: user.email || '',
          role: cleanRole,
          createdAt: serverTimestamp(),
          points: 0,
          trustScore: 100,
          civicImpactScore: 0,
          badges: ['Civic Pioneer'],
          pointHistory: [],
          ward: 'Ward 1'
        })
      } else {
        await updateDoc(userRef, {
          role: cleanRole,
          name: user.displayName || userSnap.data()?.name,
          lastLogin: serverTimestamp()
        })
      }

      if (cleanRole === 'moderator') {
        window.location.replace('/moderator')
      } else {
        window.location.replace('/dashboard')
      }
    } catch (err: any) {
      setError('Google login failed: ' + err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#080818] flex items-center justify-center p-4">
      <div id="recaptcha-container" />
      
      {/* Role selector - PROMINENT, impossible to miss */}
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">
            <span className="text-cyan-400">Civic</span>Pulse
          </h1>
          <p className="text-slate-400 mt-2">Hyperlocal Problem Solver</p>
        </div>

        {/* Role Selection - Large buttons, very clear */}
        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">
            I AM A
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSelectedRole('citizen')}
              className={`p-4 rounded-2xl border-2 transition-all text-left ${
                selectedRole === 'citizen'
                  ? 'border-cyan-400 bg-cyan-400/10 text-white'
                  : 'border-white/10 bg-white/5 text-slate-400'
              }`}
            >
              <div className="text-2xl mb-1">👤</div>
              <div className="font-semibold">Citizen</div>
              <div className="text-xs opacity-70">Report issues</div>
            </button>
            <button
              onClick={() => setSelectedRole('moderator')}
              className={`p-4 rounded-2xl border-2 transition-all text-left ${
                selectedRole === 'moderator'
                  ? 'border-orange-400 bg-orange-400/10 text-white'
                  : 'border-white/10 bg-white/5 text-slate-400'
              }`}
            >
              <div className="text-2xl mb-1">🛡️</div>
              <div className="font-semibold">Moderator</div>
              <div className="text-xs opacity-70">Manage ward</div>
            </button>
          </div>
          <p className="text-cyan-400 text-xs mt-2 text-center">
            Selected: <strong>{selectedRole.toUpperCase()}</strong>
          </p>
        </div>

        <div className="mt-4 space-y-2 mb-6">
          <button
            onClick={() => handleGoogleLogin(selectedRole)}
            disabled={loading}
            className="flex items-center justify-center gap-2 py-3 bg-white text-black rounded-xl font-semibold text-sm hover:bg-gray-100 transition-colors w-full disabled:opacity-50"
          >
            <img src="https://www.google.com/favicon.ico" className="w-4 h-4" />
            Sign in with Google
          </button>
          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-white/10"/>
            <span className="text-slate-500 text-xs">OR use phone OTP</span>
            <div className="flex-1 h-px bg-white/10"/>
          </div>
        </div>

        {step === 'phone' ? (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/50"
            />
            <div className="relative">
              <input
                type="text"
                placeholder="Aadhar number (12 digits)"
                value={aadhar}
                onChange={e => setAadhar(e.target.value.replace(/\D/g, '').slice(0, 12))}
                maxLength={12}
                onKeyDown={handleKeyDown}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/50"
              />
              <p className="text-slate-500 text-xs mt-1 text-left">
                {aadhar.length}/12
              </p>
            </div>
            <div className="flex">
              <span className="bg-white/10 border border-white/10 border-r-0 rounded-l-xl px-4 py-3 text-slate-400">
                +91
              </span>
              <input
                type="tel"
                placeholder="10-digit mobile number"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-white/5 border border-white/10 rounded-r-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/50"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={handleSendOTP}
              disabled={loading}
              className="w-full py-3 bg-cyan-400 text-black font-semibold rounded-xl hover:bg-cyan-300 transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send OTP →'}
            </button>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mt-2">
              <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Demo Credentials</p>
              <div className="space-y-1">
                <p className="text-xs text-slate-300">👤 Citizen: <span className="text-cyan-400 font-mono">9999999999</span> / OTP: <span className="text-cyan-400 font-mono">123456</span></p>
                <p className="text-xs text-slate-300">🛡️ Moderator: <span className="text-orange-400 font-mono">8888888888</span> / OTP: <span className="text-orange-400 font-mono">123456</span></p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">
              OTP sent to +91{phone}
            </p>
            <input
              type="text"
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={handleKeyDown}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/50 text-center text-2xl tracking-widest"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={handleVerifyOTP}
              disabled={loading}
              className="w-full py-3 bg-cyan-400 text-black font-semibold rounded-xl hover:bg-cyan-300 transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Login as ' + selectedRole.toUpperCase()}
            </button>
            <button
              onClick={() => { setStep('phone'); setError('') }}
              className="w-full py-2 text-slate-400 text-sm hover:text-white"
            >
              ← Change number
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

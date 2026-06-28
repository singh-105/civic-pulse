import { auth, db } from './firebase'
import { signInWithPhoneNumber, RecaptchaVerifier, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'

export const initRecaptcha = () => {
  if (typeof window === 'undefined') return null
  if ((window as any).recaptchaVerifier) {
    try { (window as any).recaptchaVerifier.clear() } catch {}
  }
  const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
    size: 'invisible',
    callback: () => {}
  })
  ;(window as any).recaptchaVerifier = verifier
  return verifier
}

export const sendOTP = async (phone: string) => {
  const formatted = '+91' + phone.trim().replace(/\D/g, '').replace(/^0/, '')
  const verifier = initRecaptcha()
  if (!verifier) throw new Error('Recaptcha failed')
  const confirmation = await signInWithPhoneNumber(auth, formatted, verifier)
  return confirmation
}

export const verifyOTPAndLogin = async (
  confirmationResult: any,
  otp: string,
  selectedRole: 'citizen' | 'moderator',
  name: string,
  aadhar: string
) => {
  // Sign out any existing session first
  await signOut(auth)
  await new Promise(r => setTimeout(r, 1000))
  
  const result = await confirmationResult.confirm(otp.trim())
  const user = result.user

  const userRef = doc(db, 'users', user.uid)
  const userSnap = await getDoc(userRef)

  // Clean role - no spaces, lowercase
  const cleanRole = selectedRole.trim().toLowerCase() as 'citizen' | 'moderator'

  if (!userSnap.exists()) {
    // New user - create with selected role
    await setDoc(userRef, {
      uid: user.uid,
      phone: user.phoneNumber,
      name: name.trim() || 'User_' + user.uid.slice(0, 6),
      aadhar: aadhar.trim(),
      role: cleanRole,
      createdAt: serverTimestamp(),
      points: 0,
      trustScore: 100,
      civicImpactScore: 0,
      badges: ['Civic Pioneer'],
      pointHistory: [],
      ward: 'Ward 1'
    })
    return { uid: user.uid, role: cleanRole }
  } else {
    // Existing user - ALWAYS update role to current selection
    // This is permanent fix - role always follows what user selects
    await updateDoc(userRef, {
      role: cleanRole,
      name: name.trim() || userSnap.data()?.name,  // UPDATE NAME
      aadhar: aadhar.trim() || userSnap.data()?.aadhar,
      lastLogin: serverTimestamp()
    })
    return { uid: user.uid, role: cleanRole }
  }
}

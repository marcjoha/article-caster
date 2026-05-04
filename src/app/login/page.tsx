'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [passcode, setPasscode] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ passcode }),
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      router.push('/');
    } else {
      setIsShaking(true);
      setPasscode('');
      setTimeout(() => setIsShaking(false), 300);
    }
  };

  return (
    <div className="login-container">
      <div className="card">

        <form 
          onSubmit={handleLogin} 
          style={{ display: 'flex', gap: '1rem' }}
          className={isShaking ? 'shake' : ''}
        >
          <input
            type="password" 
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Enter Passcode"
            className="input-field"
            style={{ marginBottom: 0 }}
          />
          <button type="submit" className="btn">
            Login
          </button>
        </form>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');

    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage('If an account exists for that email address, we sent a password reset link. Check your inbox and spam folder.');
    }
    setBusy(false);
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <form onSubmit={submit} className="card p-8 w-full max-w-md">
        <div className="font-black text-2xl"><span className="text-red-600">REBELS</span> RECRUIT</div>
        <h1 className="text-2xl font-black mt-8">Forgot your password?</h1>
        <p className="muted mt-1">Enter the email address you use for Rebels Recruit and we'll send you a secure reset link.</p>

        <div className="space-y-4 mt-6">
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          {message && <p className="text-sm text-green-700">{message}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={busy} className="btn btn-primary w-full">
            {busy ? 'Sending...' : 'Send reset link'}
          </button>
        </div>

        <p className="text-sm muted mt-6 text-center">
          Remember your password? <Link className="font-bold text-slate-900" href="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}

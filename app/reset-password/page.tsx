'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    createClient().auth.getSession().then(({ data }) => {
      if (active) {
        setReady(!!data.session);
        if (!data.session) setError('This password reset link is invalid or has expired. Please request a new one.');
      }
    });
    return () => { active = false; };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password.length < 8) {
      setError('Your new password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The passwords do not match.');
      return;
    }

    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      setError(error.message);
    } else {
      setMessage('Your password has been updated. You can now sign in on your phone.');
      setPassword('');
      setConfirm('');
    }
    setBusy(false);
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <form onSubmit={submit} className="card p-8 w-full max-w-md">
        <div className="font-black text-2xl"><span className="text-red-600">REBELS</span> RECRUIT</div>
        <h1 className="text-2xl font-black mt-8">Set a new password</h1>
        <p className="muted mt-1">Choose a new password for your Rebels Recruit account.</p>

        {ready && (
          <div className="space-y-4 mt-6">
            <input
              className="input"
              type="password"
              placeholder="New password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <input
              className="input"
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            {message && <p className="text-sm text-green-700">{message}</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={busy} className="btn btn-primary w-full">
              {busy ? 'Updating...' : 'Update password'}
            </button>
            {message && <Link href="/login" className="btn w-full text-center">Back to sign in</Link>}
          </div>
        )}

        {!ready && error && <p className="text-sm text-red-600 mt-6">{error}</p>}
      </form>
    </div>
  );
}

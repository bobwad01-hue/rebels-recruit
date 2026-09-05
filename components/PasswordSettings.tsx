'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

export default function PasswordSettings() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 8) {
      setError('Your new password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password });

    if (error) {
      setError(error.message);
    } else {
      setPassword('');
      setConfirmPassword('');
      setSuccess('Your password has been updated successfully.');
    }

    setBusy(false);
  }

  return (
    <div className="card p-6">
      <h2 className="font-black text-lg">Password</h2>
      <p className="muted mt-1">Change the password you use to sign in to Rebels Recruit.</p>

      <form onSubmit={updatePassword} className="space-y-4 mt-5">
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          placeholder="New password (8+ characters)"
          minLength={8}
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          placeholder="Confirm new password"
          minLength={8}
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          required
        />

        {success && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800">{success}</div>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={busy} className="btn btn-primary">
          {busy ? 'Updating password...' : 'Update password'}
        </button>
      </form>
    </div>
  );
}

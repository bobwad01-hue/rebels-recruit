import { Suspense } from 'react';
import NewActivityForm from './NewActivityForm';

export default function NewActivityPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center muted">Loading...</div>}>
      <NewActivityForm />
    </Suspense>
  );
}

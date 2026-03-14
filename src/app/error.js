'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      gap: '16px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h2>Something went wrong!</h2>
      <p style={{ color: 'var(--text-secondary)' }}>{error.message || 'An unexpected error occurred.'}</p>
      <button
        onClick={() => reset()}
        style={{
          padding: '8px 16px',
          background: 'var(--accent)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer'
        }}
      >
        Try again
      </button>
    </div>
  );
}

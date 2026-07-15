import React from 'react';

export function StatusText({ tone = 'neutral', children }) {
  const live = tone === 'error' ? { role: 'alert' } : tone === 'loading' || tone === 'success' ? { role: 'status', 'aria-live': 'polite' } : {};
  return <p className={`mg-status mg-status--${tone}`} {...live}>{children}</p>;
}

import React from 'react';

export function BrandLockup({ channel, inverse = false }) {
  return (
    <span className={`mg-lockup${inverse ? ' mg-lockup--inverse' : ''}`} aria-label={channel ? `문장군 ${channel}` : '문장군'}>
      <strong className="mg-lockup__ko">문장군</strong>
      <span className="mg-lockup__en" aria-hidden="true">MUNJANGGUN{channel ? ` · ${channel}` : ''}</span>
    </span>
  );
}

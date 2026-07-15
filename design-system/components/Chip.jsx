import React from 'react';

export function Chip({ selected = false, children, ...rest }) {
  return (
    <button className="mg-chip" type="button" aria-pressed={selected} {...rest}>
      <span aria-hidden="true">{selected ? '✓' : '+'}</span>{children}
    </button>
  );
}

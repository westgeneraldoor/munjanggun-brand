import React from 'react';

export function Button({ children, variant = 'primary', loading = false, disabled = false, href, className = '', ...rest }) {
  const classes = `mg-button mg-button--${variant} ${className}`.trim();
  if (href && !loading && !disabled) {
    return <a className={classes} href={href} {...rest}>{children}</a>;
  }
  return (
    <button
      className={classes}
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <><span className="mg-spinner" aria-hidden="true" />확인 중</> : children}
    </button>
  );
}

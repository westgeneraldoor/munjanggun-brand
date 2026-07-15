import React from 'react';

export function Field({ id, label, error, hint, required = false, className = '', ...rest }) {
  const messageId = `${id}-message`;
  return (
    <div className={`mg-field-group ${className}`.trim()}>
      <label htmlFor={id}>{label}{required ? <span aria-hidden="true"> *</span> : null}</label>
      <input
        id={id}
        className="mg-field"
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={(error || hint) ? messageId : undefined}
        {...rest}
      />
      {(error || hint) ? <span id={messageId} className={error ? 'mg-field-message mg-field-message--error' : 'mg-field-message'}>{error || hint}</span> : null}
    </div>
  );
}

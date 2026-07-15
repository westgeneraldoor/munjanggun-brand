import React from 'react';

export function SectionHeading({ eyebrow, title, description, align = 'start', id }) {
  return (
    <header className={`mg-section-heading mg-section-heading--${align}`}>
      {eyebrow ? <span className="mg-eyebrow">{eyebrow}</span> : null}
      <h2 id={id}>{title}</h2>
      {description ? <p>{description}</p> : null}
    </header>
  );
}

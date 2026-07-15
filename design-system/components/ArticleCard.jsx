import React from 'react';

export function ArticleCard({ title, summary, eyebrow, imageUrl, imageAlt, href, actionLabel = '자세히 보기', state = 'ready', className = '', ...rest }) {
  const interactive = Boolean(href || rest.onClick);
  const content = (
    <>
      <div className="mg-article-card__media">
        {imageUrl ? <img src={imageUrl} alt={imageAlt || ''} /> : <span role="img" aria-label={imageAlt || '준비 중인 공간 이미지'} />}
      </div>
      <div className="mg-article-card__body">
        {eyebrow ? <span className="mg-eyebrow">{eyebrow}</span> : null}
        <h3>{title}</h3>
        <p>{summary}</p>
        {interactive ? <span className="mg-card-action">{actionLabel} <span aria-hidden="true">→</span></span> : null}
      </div>
    </>
  );
  const classes = `mg-article-card mg-article-card--${state} ${className}`.trim();
  if (href) return <a className={classes} href={href} {...rest}>{content}</a>;
  if (rest.onClick) return <button className={classes} type="button" {...rest}>{content}</button>;
  return <article className={classes} {...rest}>{content}</article>;
}

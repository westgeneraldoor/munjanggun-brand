import React, { useEffect, useRef, useState } from 'react';
import { BrandLockup } from './BrandLockup.jsx';
import { Button } from './Button.jsx';

export function GlassNav({ items = [], onNavigate, actionLabel, onAction, theme, onThemeToggle, channel = 'SYSTEM', ariaLabel = '컴포넌트 탐색' }) {
  const [open, setOpen] = useState(false);
  const menuButton = useRef(null);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape' && open) {
        setOpen(false);
        menuButton.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function choose(action) {
    setOpen(false);
    action();
  }

  return (
    <nav className="mg-glass-nav" aria-label={ariaLabel}>
      <button className="mg-brand-button" type="button" onClick={() => choose(() => onNavigate?.('start'))} aria-label="문장군 컴포넌트 시작점">
        <BrandLockup channel={channel} />
      </button>
      <button
        ref={menuButton}
        className="mg-menu-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="mg-mobile-menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="mg-menu-icon" aria-hidden="true" />
        <span className="mg-menu-label">메뉴</span>
      </button>
      <div id="mg-mobile-menu" className="mg-nav-panel" data-open={open ? 'true' : 'false'}>
        <ul>
          {items.map((item) => (
            <li key={item.id}><button type="button" onClick={() => choose(() => onNavigate?.(item.id))}>{item.label}</button></li>
          ))}
        </ul>
        <button className="mg-theme-toggle" type="button" onClick={() => choose(() => onThemeToggle?.())} aria-label={`${theme === 'light' ? '다크' : '라이트'} 테마로 전환`}>
          <span aria-hidden="true">{theme === 'light' ? '◐' : '○'}</span><span>테마</span>
        </button>
        {actionLabel && onAction ? <Button variant="secondary" onClick={() => choose(onAction)}>{actionLabel}</Button> : null}
      </div>
    </nav>
  );
}

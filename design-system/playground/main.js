const root = document.documentElement;
const themeToggle = document.getElementById('theme-toggle');
const motionStatus = document.getElementById('motion-status');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

themeToggle.addEventListener('click', () => {
  const next = root.dataset.mgTheme === 'light' ? 'dark' : 'light';
  root.dataset.mgTheme = next;
  themeToggle.setAttribute('aria-pressed', String(next === 'dark'));
  themeToggle.textContent = next === 'dark' ? '라이트 테마' : '다크 테마';
});

for (const chip of document.querySelectorAll('[data-chip]')) {
  chip.addEventListener('click', () => {
    const selected = chip.getAttribute('aria-pressed') === 'true';
    chip.setAttribute('aria-pressed', String(!selected));
    chip.querySelector('[aria-hidden="true"]').textContent = selected ? '+' : '✓';
  });
}

function updateMotionStatus(event) {
  motionStatus.textContent = event.matches
    ? 'Reduced motion이 활성화되어 큰 전환을 줄입니다.'
    : '기본 모션이 활성화되어 있습니다.';
}

updateMotionStatus(reducedMotion);
reducedMotion.addEventListener('change', updateMotionStatus);

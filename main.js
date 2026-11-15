/**
 * Stingo Auto Services - Interactive Web Logic
 * - Theme Switcher (Dark & Light Mode with localStorage & OS preference)
 * - Mobile Navigation Drawer
 * - FAQ Accordion
 */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMobileMenu();
  initFaqAccordion();
});

/* --------------------------------------------------------------------------
   1. Theme Management (System, Light, Dark Dropdown Selection)
   -------------------------------------------------------------------------- */
function initTheme() {
  const themeSelect = document.getElementById('themeSelect');
  const mobileThemeSelect = document.getElementById('mobileThemeSelect');
  const systemIcon = document.getElementById('themeIconSystem');
  const sunIcon = document.getElementById('themeIconSun');
  const moonIcon = document.getElementById('themeIconMoon');
  const mobileSystemIcon = document.getElementById('mobileThemeIconSystem');
  const mobileSunIcon = document.getElementById('mobileThemeIconSun');
  const mobileMoonIcon = document.getElementById('mobileThemeIconMoon');
  const root = document.documentElement;

  // Modes: 'system' | 'light' | 'dark' (defaults to 'system')
  let currentMode = localStorage.getItem('stingo_theme_mode') || 'system';
  applyThemeMode(currentMode);

  // Sync change on header dropdown
  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
      const mode = e.target.value;
      if (['system', 'light', 'dark'].includes(mode)) {
        currentMode = mode;
        applyThemeMode(currentMode);
        localStorage.setItem('stingo_theme_mode', currentMode);
      }
    });
  }

  // Sync change on mobile drawer dropdown
  if (mobileThemeSelect) {
    mobileThemeSelect.addEventListener('change', (e) => {
      const mode = e.target.value;
      if (['system', 'light', 'dark'].includes(mode)) {
        currentMode = mode;
        applyThemeMode(currentMode);
        localStorage.setItem('stingo_theme_mode', currentMode);
      }
    });
  }

  function applyThemeMode(mode) {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    let effectiveTheme = mode;

    if (mode === 'system') {
      effectiveTheme = prefersDark ? 'dark' : 'light';
      root.setAttribute('data-theme', effectiveTheme);
      root.setAttribute('data-theme-mode', 'system');

      updateIcons('system');
    } else if (mode === 'light') {
      root.setAttribute('data-theme', 'light');
      root.setAttribute('data-theme-mode', 'light');

      updateIcons('light');
    } else if (mode === 'dark') {
      root.setAttribute('data-theme', 'dark');
      root.setAttribute('data-theme-mode', 'dark');

      updateIcons('dark');
    }

    // Keep both select dropdowns in sync
    if (themeSelect && themeSelect.value !== mode) {
      themeSelect.value = mode;
    }
    if (mobileThemeSelect && mobileThemeSelect.value !== mode) {
      mobileThemeSelect.value = mode;
    }
  }

  function updateIcons(mode) {
    // Header icons
    if (systemIcon) systemIcon.style.display = mode === 'system' ? 'block' : 'none';
    if (sunIcon) sunIcon.style.display = mode === 'light' ? 'block' : 'none';
    if (moonIcon) moonIcon.style.display = mode === 'dark' ? 'block' : 'none';

    // Mobile drawer icons
    if (mobileSystemIcon) mobileSystemIcon.style.display = mode === 'system' ? 'block' : 'none';
    if (mobileSunIcon) mobileSunIcon.style.display = mode === 'light' ? 'block' : 'none';
    if (mobileMoonIcon) mobileMoonIcon.style.display = mode === 'dark' ? 'block' : 'none';
  }

  // Live listener for OS preference changes when in 'system' mode
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      const mode = localStorage.getItem('stingo_theme_mode') || 'system';
      if (mode === 'system') {
        applyThemeMode('system');
      }
    });
  }
}

/* --------------------------------------------------------------------------
   2. Mobile Drawer Navigation
   -------------------------------------------------------------------------- */
function initMobileMenu() {
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileDrawer = document.getElementById('mobileDrawer');
  const hamburgerIcon = document.getElementById('hamburgerIcon');
  const closeMenuIcon = document.getElementById('closeMenuIcon');
  const drawerLinks = document.querySelectorAll('.mobile-drawer-link');

  if (!mobileMenuBtn || !mobileDrawer) return;

  mobileMenuBtn.addEventListener('click', () => {
    const isOpen = mobileDrawer.classList.contains('open');
    if (isOpen) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });

  drawerLinks.forEach(link => {
    link.addEventListener('click', () => {
      closeDrawer();
    });
  });

  // Close with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileDrawer.classList.contains('open')) {
      closeDrawer();
    }
  });

  // Close if resized back to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768 && mobileDrawer.classList.contains('open')) {
      closeDrawer();
    }
  });

  function openDrawer() {
    mobileDrawer.classList.add('open');
    mobileDrawer.setAttribute('aria-hidden', 'false');
    mobileMenuBtn.setAttribute('aria-expanded', 'true');
    document.body.classList.add('menu-open');
    if (hamburgerIcon) hamburgerIcon.style.display = 'none';
    if (closeMenuIcon) closeMenuIcon.style.display = 'block';
  }

  function closeDrawer() {
    mobileDrawer.classList.remove('open');
    mobileDrawer.setAttribute('aria-hidden', 'true');
    mobileMenuBtn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
    if (hamburgerIcon) hamburgerIcon.style.display = 'block';
    if (closeMenuIcon) closeMenuIcon.style.display = 'none';
  }
}

/* --------------------------------------------------------------------------
   3. FAQ Accordion
   -------------------------------------------------------------------------- */
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const questionBtn = item.querySelector('.faq-question');
    if (!questionBtn) return;

    questionBtn.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      // Close all other open items for clean accordion UX
      faqItems.forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.classList.remove('active');
        }
      });

      // Toggle current
      if (isActive) {
        item.classList.remove('active');
      } else {
        item.classList.add('active');
      }
    });
  });
}

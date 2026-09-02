import { useEffect, useState } from 'react';

/** ติดตาม media query แบบสด — ใช้สลับ Dialog บนจอคอมพ์ / Drawer บนมือถือ */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** true เมื่อจอแคบกว่า breakpoint md ของ Tailwind */
export const useIsMobile = () => !useMediaQuery('(min-width: 768px)');

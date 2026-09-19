import { useState, useCallback } from 'react';

/** 把抛错的 store action 包成 alert 条，不把异常抛到渲染树 */
export function useActionError() {
  const [error, setError] = useState<string | null>(null);
  const run = useCallback((fn: () => void) => {
    setError(null);
    try {
      fn();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }, []);
  return { error, setError, run };
}

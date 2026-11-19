import { useCallback, useEffect, useRef, useState } from "react";

// Runs `loader` on mount and again on reload(). Returns { data, error, loading, reload }.
export function useResource(loader) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => loaderRef.current())
      .then((data) => active && setState({ data, error: null, loading: false }))
      .catch((error) => active && setState({ data: null, error, loading: false }));
    return () => {
      active = false;
    };
  }, [tick]);

  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true }));
    setTick((n) => n + 1);
  }, []);

  return { ...state, reload };
}

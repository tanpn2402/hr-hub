import { useEffect, useRef, useState } from './lib.js';

// Current sub-route ('' = list, 'edit:<CODE>', 'run:<CODE>', 'results:<CODE>'); null until HR Hub answers.
export function useRoute() {
  const [path, setPath] = useState(null);
  useEffect(() => {
    let alive = true;
    window.hrhub.route.get().then((value) => alive && setPath(value));
    const off = window.hrhub.route.onChange(setPath);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return path;
}

// { status: 'loading' | 'ready' | 'error', value, error, reload } for an async loader.
export function useLoad(load, deps) {
  const [state, setState] = useState({ status: 'loading', value: null, error: null });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((current) => ({ ...current, status: 'loading' }));
    load()
      .then((value) => alive && setState({ status: 'ready', value, error: null }))
      .catch((error) => alive && setState({ status: 'error', value: null, error }));
    return () => {
      alive = false;
    };
  }, [...deps, version]);
  return { ...state, reload: () => setVersion((v) => v + 1) };
}

// Seconds left until `endsAt` on the server clock (hrhub.realtime.now()), ticking 4x per second.
export function useCountdown(endsAt) {
  const secondsLeft = () => Math.max(0, Math.ceil((endsAt - window.hrhub.realtime.now()) / 1000));
  const [left, setLeft] = useState(secondsLeft);
  const timer = useRef(null);
  useEffect(() => {
    const tick = () => setLeft(secondsLeft());
    tick();
    timer.current = setInterval(tick, 250);
    return () => clearInterval(timer.current);
  }, [endsAt]);
  return left;
}

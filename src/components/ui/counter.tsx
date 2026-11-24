'use client';
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

type Fmt = (n: number) => string;

/** Número que "conta" até o valor ao aparecer (GSAP). Respeita "reduzir movimento". */
export default function Counter({ value, format = (n) => String(Math.round(n)) }: { value: number; format?: Fmt }) {
  const el = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  useEffect(() => {
    const node = el.current; if (!node) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { node.textContent = format(value); prev.current = value; return; }
    const obj = { v: prev.current };
    const tween = gsap.to(obj, { v: value, duration: 0.8, ease: 'power3.out', onUpdate: () => { node.textContent = format(obj.v); } });
    prev.current = value;
    return () => { tween.kill(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <><span ref={el} aria-hidden="true">{format(0)}</span><span className="gd-sr">{format(value)}</span></>;
}

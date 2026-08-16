import { useEffect, useRef } from "react";

interface ShadowHtmlProps {
  html: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders a trusted, self-contained HTML string (receipt previews, etc.)
 * with the same style isolation as an <iframe srcDoc=...> — but WITHOUT
 * using an actual iframe.
 *
 * Why: any <iframe> in the DOM on Android WebView causes the browser to
 * recalculate the whole page's viewport to the iframe's (narrow, receipt-
 * paper-width) size, visibly shrinking the entire app UI. Shadow DOM gives
 * the same encapsulation (scoped <style>, no leaking CSS) without touching
 * the viewport at all, so it's safe to use unconditionally on every platform.
 */
export function ShadowHtml({ html, className, style }: ShadowHtmlProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    shadow.innerHTML = html || "";
  }, [html]);

  return <div ref={hostRef} className={className} style={style} />;
}

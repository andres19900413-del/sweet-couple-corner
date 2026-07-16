import { useEffect, useState } from "react";

/**
 * Devuelve cuántos píxeles está "tapando" el teclado del celular en la
 * parte de abajo de la pantalla (0 si el teclado está cerrado).
 *
 * El problema que resuelve: en iOS Safari, los elementos con
 * `position: fixed` se ubican respecto a la altura TOTAL de la pantalla,
 * no respecto a lo que realmente se ve arriba del teclado — así que una
 * barra fija "bottom-0" termina escondida detrás del teclado en vez de
 * quedar pegada justo encima.
 *
 * `window.visualViewport` sí conoce el área realmente visible, así que
 * comparamos su altura contra la altura total de la ventana para saber
 * cuánto hay que "empujar hacia arriba" los elementos fijos.
 */
export function useKeyboardOffset(): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return; // navegadores muy viejos sin soporte: nos quedamos en 0, sin romper nada

    const measure = () => {
      const keyboardHeight = window.innerHeight - vv.height - vv.offsetTop;
      setOffset(keyboardHeight > 60 ? keyboardHeight : 0);
    };

    // iOS a veces dispara el evento "resize" ANTES de que termine la
    // animación de apertura del teclado, dando una altura incompleta.
    // Por eso volvemos a medir varias veces durante ~350ms (lo que dura
    // la animación) en vez de confiar en una sola lectura.
    const measureWithRetries = () => {
      measure();
      [50, 150, 250, 350].forEach((delay) => setTimeout(measure, delay));
    };

    measure();
    vv.addEventListener("resize", measureWithRetries);
    vv.addEventListener("scroll", measure);

    // Respaldo adicional: en iOS, el foco/desenfoque de un input es una
    // señal más inmediata y confiable de que el teclado va a abrir o
    // cerrar que esperar al evento resize del viewport.
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") measureWithRetries();
    };
    const onFocusOut = () => measureWithRetries();

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);

    return () => {
      vv.removeEventListener("resize", measureWithRetries);
      vv.removeEventListener("scroll", measure);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return offset;
}

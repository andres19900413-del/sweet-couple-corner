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

    const update = () => {
      const keyboardHeight = window.innerHeight - vv.height - vv.offsetTop;
      setOffset(keyboardHeight > 60 ? keyboardHeight : 0); // ignoramos diferencias chiquitas (barras de navegador, etc.)
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return offset;
}

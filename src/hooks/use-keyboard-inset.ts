import { useEffect, useState } from "react";

/**
 * Devuelve la altura (px) que el teclado en pantalla está tapando
 * de la ventana, usando la VisualViewport API. 0 cuando el teclado
 * está cerrado. Esto evita que los elementos `fixed bottom-*` queden
 * escondidos detrás del teclado en iOS Safari.
 */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const offset = window.innerHeight - vv.height - vv.offsetTop;
      setInset(offset > 0 ? Math.round(offset) : 0);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}

import { useState, useEffect, useCallback } from "react";
import "./Gallery.css";

const EXT = "jpg"; // cambia a png, webp, etc. según tus archivos
const TOTAL = 9;

const images = Array.from(
  { length: TOTAL },
  (_, i) => `/imgs/img_${i + 1}.${EXT}`
);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function Gallery() {
  // se mezclan una sola vez al montar el componente
  const [items] = useState(() => shuffle(images));
  const [current, setCurrent] = useState(null); // índice abierto o null

  const close = () => setCurrent(null);
  const next = useCallback(
    () => setCurrent((c) => (c + 1) % items.length),
    [items.length]
  );
  const prev = useCallback(
    () => setCurrent((c) => (c - 1 + items.length) % items.length),
    [items.length]
  );

  // teclado: Esc cierra, flechas navegan
  useEffect(() => {
    if (current === null) return;
    const onKey = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, next, prev]);

  return (
    <section id="galeria" className="gallery">
      <div className="gallery-grid">
        {items.map((src, i) => (
          <button
            key={src}
            className="gallery-thumb"
            onClick={() => setCurrent(i)}
          >
            <img src={src} alt="Imagem da galeria" loading="lazy" />
          </button>
        ))}
      </div>

      {current !== null && (
        <div className="gallery-modal" onClick={close}>
          <button
            className="gallery-close"
            aria-label="Fechar"
            onClick={close}
          >
            &times;
          </button>

          <button
            className="gallery-nav gallery-prev"
            aria-label="Anterior"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
          >
            &lt;
          </button>

          <img
            src={items[current]}
            alt="Imagem da galeria"
            onClick={(e) => e.stopPropagation()}
          />

          <button
            className="gallery-nav gallery-next"
            aria-label="Próxima"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
          >
            &gt;
          </button>
        </div>
      )}
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./CityArticle.module.css";

type Props = {
  src: string;
  alt: string;
  title?: string;
  width?: string | number;
  height?: string | number;
};

export function ArticleImage({ src, alt, title, width, height }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
  const label = alt || title || "City photograph";
  const close = () => dialog.current?.close();
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={styles.thumbnail}
        aria-label={`Enlarge image: ${label}`}
        aria-haspopup="dialog"
        onClick={() => {
          if (!dialog.current || dialog.current.open) return;
          dialog.current.showModal();
          setOpen(true);
        }}
      >
        <img
          src={src}
          alt={alt}
          title={title}
          width={width}
          height={height}
          loading="lazy"
          decoding="async"
        />
        <span className={styles.expandIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </span>
      </button>
      {title ? (
        <figcaption className={styles.imageCaption}>{title}</figcaption>
      ) : null}
      <dialog
        data-polish-dialog
        ref={dialog}
        className={styles.imageDialog}
        aria-label={`Image: ${label}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        onClose={() => {
          setOpen(false);
          trigger.current?.focus({ preventScroll: true });
        }}
      >
        <div className={styles.dialogHeader}>
          <p>{label}</p>
          <button type="button" aria-label="Close image" onClick={close}>
            ×
          </button>
        </div>
        {open ? (
          <img
            className={styles.fullImage}
            src={src}
            alt={alt}
            width={width}
            height={height}
          />
        ) : null}
      </dialog>
    </>
  );
}

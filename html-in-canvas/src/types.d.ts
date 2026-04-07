declare global {
  interface HTMLCanvasElement {
    requestPaint(): void;
  }
}

declare namespace preact.JSX {
  interface HTMLAttributes<T extends EventTarget = EventTarget> {
    layoutsubtree?: boolean;
  }
}

export {};

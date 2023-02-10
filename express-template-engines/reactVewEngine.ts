/* eslint-disable */

type Locals = Record<string, any>;
type RenderCallback = (err: Error | null, rendered?: string) => void;

import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

export async function reactViewEngine(filePath: string, locals: Locals, callback: RenderCallback) {
  const { default: component } = await import(filePath);
  const { settings, ...props } = locals;
  const rendered = renderToString(createElement(component, props));
  return callback(null, rendered);
}

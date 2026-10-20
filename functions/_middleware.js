import { handle } from './_lib/engine.js';

export async function onRequest(context) {
  return handle(context);
}

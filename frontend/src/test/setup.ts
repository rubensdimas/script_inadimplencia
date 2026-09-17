import "@testing-library/jest-dom/vitest";
import { File } from "node:buffer";
import { fetch, FormData, Headers, Request, Response } from "undici";
import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./server";

// jsdom instala seu proprio FormData/File no ambiente de teste, distintos dos
// usados pelo fetch nativo do Node (undici). Isso faz o fetch nao reconhecer
// o body como multipart e omitir o Content-Type com boundary. Alinhamos tudo
// com a mesma implementacao (undici) so no ambiente de teste; em browser real
// essas globais ja sao consistentes entre si.
Object.assign(globalThis, { fetch, File, FormData, Headers, Request, Response });

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

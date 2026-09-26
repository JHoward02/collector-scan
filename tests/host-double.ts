import { vi } from "vitest";
import type {
  AgentServerRequest,
  CanvasExtensionHost,
  CanvasExtensionPageContext,
  CanvasExtensionPageMount,
} from "../src/host.ts";

export interface HostDouble {
  host: CanvasExtensionHost;
  /** Mounts registered during activation, in registration order. */
  mounts: Map<string, CanvasExtensionPageMount>;
  registeredIds: string[];
  unregister: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
  request: ReturnType<typeof vi.fn>;
  /** Invoke a registered page mount and return its disposer. */
  open(id: string, context: Partial<CanvasExtensionPageContext> & { container: HTMLElement }): Promise<() => void>;
}

export function createHostDouble(options: { apiVersion?: string; backendId?: string } = {}): HostDouble {
  const mounts = new Map<string, CanvasExtensionPageMount>();
  const registeredIds: string[] = [];
  const unregister = vi.fn();
  const navigate = vi.fn();
  const request = vi.fn(async (_request: AgentServerRequest) => ({}) as unknown);

  const host: CanvasExtensionHost = {
    apiVersion: options.apiVersion ?? "1",
    extension: { name: "collector-scan", version: "0.1.0", resolvedRef: "test-ref" },
    backend: { id: options.backendId ?? "local-test", kind: "local", orgId: null },
    registerPage: vi.fn((id: string, mount: CanvasExtensionPageMount) => {
      registeredIds.push(id);
      mounts.set(id, mount);
      return unregister;
    }),
    navigate,
    // The host's request helper is generic; the double returns a fixed payload.
    agentServer: { request: request as unknown as CanvasExtensionHost["agentServer"]["request"] },
  };

  return {
    host,
    mounts,
    registeredIds,
    unregister,
    navigate,
    request,
    async open(id, context) {
      const mount = mounts.get(id);
      if (!mount) throw new Error(`Page ${id} was not registered`);
      const disposer = await mount({
        container: context.container,
        path: context.path ?? "",
        navigate: context.navigate ?? navigate,
      });
      return (disposer as () => void) ?? (() => {});
    },
  };
}

/** Minimal Response-like object for stubbing global fetch. */
export function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

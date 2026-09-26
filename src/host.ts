/**
 * Canvas Extensions API, host API 1.
 *
 * Declared locally because the host contract is injected at runtime rather than
 * published as an npm package. Keep this in sync with the host API 1 ABI.
 */

export interface CanvasExtensionPageContext {
  container: HTMLElement;
  /** Route remainder below the declared page path, without a leading slash. */
  path: string;
  navigate(path: string): void;
}

export type CanvasExtensionPageMount = (
  context: CanvasExtensionPageContext,
) => void | (() => void) | Promise<void | (() => void)>;

export interface AgentServerRequest {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface CanvasExtensionHost {
  readonly apiVersion: string;
  readonly extension: Readonly<{
    name: string;
    version: string;
    resolvedRef: string | null;
  }>;
  readonly backend: Readonly<{
    id: string;
    kind: "local" | "cloud";
    orgId: string | null;
  }>;
  registerPage(contributionId: string, mount: CanvasExtensionPageMount): () => void;
  navigate(path: string): void;
  agentServer: {
    request<T = unknown>(request: AgentServerRequest): Promise<T>;
  };
}

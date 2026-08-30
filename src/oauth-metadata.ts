const DEFAULT_MCP_URL = "https://mcp.youtubetranscript.dev";
const DEFAULT_ISSUER = "https://www.youtubetranscript.dev";

export function mcpPublicOrigin(): string {
  return (process.env.MCP_PUBLIC_URL ?? DEFAULT_MCP_URL).replace(/\/+$/, "");
}

export function isPublicMcpPath(urlPath: string): boolean {
  try {
    const pathname = new URL(urlPath, "http://localhost").pathname;
    return pathname.startsWith("/.well-known/");
  } catch {
    return false;
  }
}

export function protectedResourceMetadata(resource: string, issuer = DEFAULT_ISSUER) {
  const origin = resource.replace(/\/+$/, "");
  return {
    resource: origin,
    authorization_servers: [issuer.replace(/\/+$/, "")],
    bearer_methods_supported: ["header"],
    scopes_supported: ["mcp"],
  };
}

export function authorizationServerMetadata(issuer = DEFAULT_ISSUER) {
  const origin = issuer.replace(/\/+$/, "");
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/api/mcp/oauth/authorize`,
    token_endpoint: `${origin}/api/mcp/oauth/token`,
    registration_endpoint: `${origin}/api/mcp/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    client_id_metadata_document_supported: true,
    scopes_supported: ["mcp"],
  };
}

export function wwwAuthenticateHeader(resource: string) {
  const origin = resource.replace(/\/+$/, "");
  return `Bearer realm="YouTube Transcript MCP", resource_metadata="${origin}/.well-known/oauth-protected-resource", scope="mcp"`;
}

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, x-api-token, MCP-Protocol-Version, Accept",
    "Access-Control-Expose-Headers": "WWW-Authenticate",
    "Access-Control-Max-Age": "86400",
  };
}

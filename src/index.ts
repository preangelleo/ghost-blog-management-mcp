import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { Props } from "./types";
import { GitHubHandler } from "./auth/github-handler";
import { registerAllTools } from "./tools/register-tools";

export class MyMCP extends McpAgent<Env, Record<string, never>, Props> {
	server = new McpServer({
		name: "Ghost Blog Content Creation MCP Server",
		version: "2.0.0",
	});

	async init() {
		// Register all Ghost Blog tools based on user permissions
		registerAllTools(this.server, this.env, this.props);
		
		console.log(`Content Creation MCP Server initialized for user: ${this.props.login} (${this.props.name})`);
		console.log('Connected to Ghost Blog Smart API at animagent.ai');
	}
}

export default new OAuthProvider({
	apiHandlers: {
		'/sse': MyMCP.serveSSE('/sse') as any,
		'/mcp': MyMCP.serve('/mcp') as any,
	},
	authorizeEndpoint: "/authorize",
	clientRegistrationEndpoint: "/register",
	defaultHandler: GitHubHandler as any,
	tokenEndpoint: "/token",
});
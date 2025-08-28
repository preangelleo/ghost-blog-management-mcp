import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Props } from "../types";
import { registerGhostBlogTools } from "./ghost-blog-tools";

/**
 * Register all MCP tools based on user permissions
 * Ghost Blog Smart API integration for content creation
 */
export function registerAllTools(server: McpServer, env: Env, props: Props) {
	// Register Ghost Blog tools (13 tools for blog management)
	registerGhostBlogTools(server, env, props);
	
	// Future tools can be registered here
	// registerOtherTools(server, env, props);
}
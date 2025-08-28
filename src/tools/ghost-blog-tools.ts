import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Props } from "../types";

// Ghost Blog Smart API base URL
const API_BASE_URL = 'https://animagent.ai/ghost-blog-api';
const GHOST_BLOG_API_KEY = '1fc21aec-7246-48c5-acef-d4743485de01'; // Should match COOKIE_ENCRYPTION_KEY in Worker

// Removed ApiResponse interface as it's not used anymore
// The API returns data directly which we wrap in our own structure

async function callGhostBlogApi(
	endpoint: string, 
	method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET', 
	body?: any,
	timeout: number = 300000, // Default 5 minutes for all operations to handle image generation
	env?: Env,
	customGhostCredentials?: {
		ghost_admin_api_key?: string;
		ghost_api_url?: string;
	}
): Promise<any> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	try {
		// Build headers with three-level priority system
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'X-API-Key': GHOST_BLOG_API_KEY,
			'User-Agent': 'Content-Creation-MCP/1.0'
		};

		// Priority 1: LLM-provided credentials (highest priority)
		if (customGhostCredentials?.ghost_admin_api_key) {
			headers['X-Ghost-API-Key'] = customGhostCredentials.ghost_admin_api_key;
		}
		if (customGhostCredentials?.ghost_api_url) {
			headers['X-Ghost-API-URL'] = customGhostCredentials.ghost_api_url;
		}
		
		// Priority 2: Worker environment variables (if no LLM credentials provided)
		if (!customGhostCredentials?.ghost_admin_api_key && env?.CUSTOM_GHOST_ADMIN_API_KEY) {
			headers['X-Ghost-API-Key'] = env.CUSTOM_GHOST_ADMIN_API_KEY;
		}
		if (!customGhostCredentials?.ghost_api_url && env?.CUSTOM_GHOST_API_URL) {
			headers['X-Ghost-API-URL'] = env.CUSTOM_GHOST_API_URL;
		}
		
		// Priority 3: Backend API server defaults (no headers added, server uses its own config)

		const response = await fetch(`${API_BASE_URL}${endpoint}`, {
			method,
			headers,
			body: body ? JSON.stringify(body) : undefined,
			signal: controller.signal
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
		}

		const jsonResponse = await response.json();
		// The Ghost Blog Smart API returns {success, timestamp, data} structure
		return jsonResponse;
	} catch (error: any) {
		clearTimeout(timeoutId);
		
		if (error.name === 'AbortError') {
			return {
				success: false,
				error: `Request timed out after ${timeout / 1000} seconds. This may happen with image generation - try again or use is_test=true.`,
				timestamp: new Date().toISOString()
			};
		}
		
		console.error(`Ghost Blog API call failed (${method} ${endpoint}):`, error);
		return {
			success: false,
			error: `API call failed: ${error instanceof Error ? error.message : String(error)}`,
			timestamp: new Date().toISOString()
		};
	}
}


export function registerGhostBlogTools(server: McpServer, env: Env, props: Props) {
	// Check authorization based on AUTHORIZED_USERS environment variable
	// If AUTHORIZED_USERS is not set or empty, allow all authenticated users (public mode)
	// If AUTHORIZED_USERS is set, only allow listed users (private mode)
	const authorizedUsersStr = env.AUTHORIZED_USERS?.trim();
	
	if (authorizedUsersStr) {
		// Private mode: check if user is in the allowed list
		const authorizedUsers = authorizedUsersStr.split(',').map(u => u.trim()).filter(u => u);
		
		if (!authorizedUsers.includes(props.login)) {
			console.log(`User ${props.login} is not authorized to use Ghost Blog tools. Authorized users: ${authorizedUsers.join(', ')}`);
			return;
		}
		console.log(`Tools registered for authorized user: ${props.login} (private mode)`);
	} else {
		// Public mode: allow all authenticated GitHub users
		console.log(`Tools registered for authenticated user: ${props.login} (public mode)`);
	}

	// Tool 1: Health Check
	server.tool(
		"ghost_health_check",
		"Check if the Ghost Blog Smart API is running and healthy. Returns API status, version, and available features.",
		{},
		async () => {
			const result = await callGhostBlogApi('/health', 'GET', undefined, 30000, env);
			
			if (!result.success) {
				return {
					content: [{
						type: "text",
						text: `**Ghost Blog API Error**\n\n${result.error}`,
						isError: true
					}]
				};
			}

			return {
				content: [{
					type: "text",
					text: `**Ghost Blog API is Ready! ✅**\n\nStatus: ${result.data?.status || 'healthy'}\nVersion: ${result.data?.version || '1.1.0'}\n\n**What you can do:**\n• Create blog posts with AI enhancement\n• Generate feature images automatically\n• Manage existing blog content\n• Search and analyze your posts\n\n**Quick Start:**\n- Use \`ghost_smart_create\` to write a post from ideas\n- Use \`ghost_create_post\` for manual post creation\n- Use \`ghost_get_posts\` to see existing content`
				}]
			};
		}
	);

	// Tool 2: API Info
	server.tool(
		"ghost_api_info",
		"Get basic information about the Ghost Blog Smart API including name, description, version, and available endpoints.",
		{},
		async () => {
			const result = await callGhostBlogApi('/', 'GET', undefined, 30000, env);
			
			if (!result.success) {
				return {
					content: [{
						type: "text",
						text: `**Error getting API info**\n\n${result.error}`,
						isError: true
					}]
				};
			}

			return {
				content: [{
					type: "text",
					text: `**Ghost Blog Content Creation System**\n\n${result.data?.description || 'REST API for Ghost CMS blog management with AI-powered features'}\n\n**🚀 Quick Actions:**\n1. **Write with AI**: Use \`ghost_smart_create\` - just provide your ideas\n2. **Create Post**: Use \`ghost_create_post\` with title and content\n3. **View Posts**: Use \`ghost_get_posts\` to see what's published\n4. **Search**: Use \`ghost_advanced_search\` to find specific content\n\n**✨ Special Features:**\n• AI content generation with Google Gemini\n• Auto image creation (Flux: 3-7s, Imagen: 10-15s)\n• Test mode for safe experimentation (is_test=true)\n• Batch operations for efficiency\n\n**💡 Example:**\n"Use ghost_smart_create to write about 'AI trends in 2025' as a draft"`
				}]
			};
		}
	);

	// Tool 3: Create Post
	server.tool(
		"ghost_create_post",
		"Create a new blog post or page in Ghost CMS. Use post_type='page' to create static pages like About, Contact, etc. Can optionally generate an AI feature image using Replicate Flux or Google Imagen. Set is_test=true to test without creating real posts. You can specify ghost_admin_api_key and ghost_api_url to post to a different blog than the default.",
		{
			title: z.string().min(1).describe("Title of the blog post or page"),
			content: z.string().min(1).describe("Content in HTML or Markdown format"),
			post_type: z.enum(["post", "page"]).default("post").describe("Type: 'post' for blog posts, 'page' for static pages like About, Contact, etc."),
			excerpt: z.string().optional().describe("Brief excerpt/summary of the post"),
			tags: z.array(z.string()).optional().describe("Array of tag names to assign to the post (not applicable for pages)"),
			status: z.enum(["draft", "published"]).default("draft").describe("Post/page status: draft or published"),
			featured: z.boolean().optional().describe("Whether to feature this post (not applicable for pages)"),
			use_generated_feature_image: z.boolean().optional().describe("Generate AI feature image (adds 60-300s)"),
			prefer_flux: z.boolean().optional().describe("Use Replicate Flux for faster image generation (3-7s)"),
			prefer_imagen: z.boolean().optional().describe("Use Google Imagen for professional quality (10-15s)"),
			image_aspect_ratio: z.enum(["16:9", "1:1", "9:16", "4:3", "3:2"]).optional().describe("Aspect ratio for generated image"),
			is_test: z.boolean().default(true).describe("Test mode - simulate without creating real post/page"),
			ghost_admin_api_key: z.string().optional().describe("Optional: Override default Ghost Admin API Key to post to a different blog"),
			ghost_api_url: z.string().optional().describe("Optional: Override default Ghost blog URL to post to a different blog")
		},
		async (params) => {
			const timeout = params.use_generated_feature_image ? 300000 : 30000; // 5 minutes for images
			
			// Extract custom credentials and prepare request body
			const { ghost_admin_api_key, ghost_api_url, ...requestBody } = params;
			const customCredentials = (ghost_admin_api_key || ghost_api_url) ? {
				ghost_admin_api_key,
				ghost_api_url
			} : undefined;
			
			const result = await callGhostBlogApi('/api/posts', 'POST', requestBody, timeout, env, customCredentials);
			
			if (!result.success) {
				return {
					content: [{
						type: "text",
						text: `**Failed to create post**\n\n${result.error}${params.use_generated_feature_image ? '\n\n💡 Tip: Image generation can timeout. Try without images or use prefer_flux=true for faster generation.' : ''}`,
						isError: true
					}]
				};
			}

			const post = result.data || {};
			// Handle the actual response structure from Ghost Blog Smart API
			const postUrl = post.url || post.link || (params.is_test ? 'Test mode - no real URL' : 'URL not available');
			const postId = post.post_id || post.id || (params.is_test ? 'test-id' : 'Unknown');
			const postTitle = post.title || post.generated_title || params.title;
			const postTags = post.tags || post.generated_tags || params.tags || [];
			const postExcerpt = post.excerpt || post.generated_excerpt || params.excerpt || 'No excerpt';
			const contentType = params.post_type === 'page' ? 'Page' : 'Post';
			
			return {
				content: [{
					type: "text",
					text: `**${contentType} ${params.is_test ? 'Test Completed' : 'Created Successfully'}! ✅**\n\n**Title:** ${postTitle}\n**Type:** ${params.post_type || 'post'}\n**Status:** ${post.status || params.status}\n**${contentType} ID:** ${postId}\n**URL:** ${postUrl}\n${params.post_type !== 'page' ? `**Tags:** ${Array.isArray(postTags) ? postTags.join(', ') : 'None'}\n**Featured:** ${post.featured !== undefined ? (post.featured ? 'Yes' : 'No') : (params.featured ? 'Yes' : 'No')}\n` : ''}${post.feature_image ? `**Feature Image:** Generated successfully` : ''}\n\n**Excerpt:**\n${postExcerpt}\n\n${params.is_test ? `⚠️ Test mode - no actual ${contentType.toLowerCase()} was created` : `✨ Your ${contentType.toLowerCase()} is now ${(post.status || params.status) === 'published' ? 'live' : 'saved as draft'}!`}`
				}]
			};
		}
	);

	// Tool 4: Smart Create
	server.tool(
		"ghost_smart_create",
		"Create a blog post or page using AI to enhance your input. Provide notes or ideas, and AI will generate a complete post/page with title, content, and tags. Uses Google Gemini for content generation. You can specify ghost_admin_api_key and ghost_api_url to post to a different blog.",
		{
			user_input: z.string().min(1).describe("Your ideas, notes, or topic to be enhanced by AI into a full blog post or page"),
			post_type: z.enum(["post", "page"]).default("post").describe("Type: 'post' for blog posts, 'page' for static pages like About, Contact, etc."),
			status: z.enum(["draft", "published"]).default("draft").describe("Post/page status after creation"),
			preferred_language: z.string().default("English").describe("Language for the generated content"),
			is_test: z.boolean().default(true).describe("Test mode - simulate without creating real post/page"),
			ghost_admin_api_key: z.string().optional().describe("Optional: Override default Ghost Admin API Key to post to a different blog"),
			ghost_api_url: z.string().optional().describe("Optional: Override default Ghost blog URL to post to a different blog")
		},
		async (params) => {
			const { ghost_admin_api_key, ghost_api_url, ...requestBody } = params;
			const customCredentials = (ghost_admin_api_key || ghost_api_url) ? {
				ghost_admin_api_key,
				ghost_api_url
			} : undefined;
			
			const result = await callGhostBlogApi('/api/smart-create', 'POST', requestBody, 60000, env, customCredentials);
			
			if (!result.success) {
				return {
					content: [{
						type: "text",
						text: `**Failed to create AI-enhanced post**\n\n${result.error}`,
						isError: true
					}]
				};
			}

			const post = result.data || {};
			// Handle the smart-create response structure
			const postUrl = post.url || (params.is_test ? 'Test mode URL' : 'URL not available');
			const postId = post.post_id || (params.is_test ? 'test-id' : 'Unknown');
			const postTitle = post.generated_title || post.rewritten_data?.title || 'AI-generated title';
			const postTags = post.generated_tags || post.rewritten_data?.tags || [];
			const postExcerpt = post.generated_excerpt || post.rewritten_data?.excerpt || 'AI-generated excerpt';
			const contentType = params.post_type === 'page' ? 'Page' : 'Post';
			
			return {
				content: [{
					type: "text",
					text: `**AI-Enhanced ${contentType} ${params.is_test ? 'Test Completed' : 'Created'}! 🤖✅**\n\n**Title:** ${postTitle}\n**Type:** ${params.post_type || 'post'}\n**Status:** ${post.status || params.status}\n**${contentType} ID:** ${postId}\n**URL:** ${postUrl}\n${params.post_type !== 'page' ? `**Tags:** ${Array.isArray(postTags) ? postTags.join(', ') : 'AI-generated'}\n` : ''}**Language:** ${params.preferred_language}\n\n**AI-Generated Excerpt:**\n${postExcerpt}\n\n${params.is_test ? `⚠️ Test mode - no actual ${contentType.toLowerCase()} was created` : `✨ AI has transformed your ideas into a ${(post.status || params.status) === 'published' ? `live ${contentType.toLowerCase()}` : 'draft'}!`}\n\n**Original Input:**\n"${params.user_input}"`
				}]
			};
		}
	);

	// Tool 5: Get Posts
	server.tool(
		"ghost_get_posts",
		"Retrieve a list of blog posts from Ghost CMS with optional filters for status and featured posts. You can specify ghost_admin_api_key and ghost_api_url to query a different blog.",
		{
			limit: z.number().int().min(1).max(100).default(10).describe("Maximum number of posts to retrieve (1-100)"),
			status: z.enum(["draft", "published", "all"]).default("all").describe("Filter by post status"),
			featured: z.boolean().optional().describe("Filter to show only featured posts"),
			ghost_admin_api_key: z.string().optional().describe("Optional: Override default Ghost Admin API Key to query a different blog"),
			ghost_api_url: z.string().optional().describe("Optional: Override default Ghost blog URL to query a different blog")
		},
		async (params) => {
			const { ghost_admin_api_key, ghost_api_url, ...queryOptions } = params;
			const customCredentials = (ghost_admin_api_key || ghost_api_url) ? {
				ghost_admin_api_key,
				ghost_api_url
			} : undefined;
			
			const queryParams = new URLSearchParams();
			queryParams.append('limit', queryOptions.limit.toString());
			queryParams.append('status', queryOptions.status);
			if (queryOptions.featured !== undefined) {
				queryParams.append('featured', queryOptions.featured.toString());
			}

			const result = await callGhostBlogApi(`/api/posts?${queryParams.toString()}`, 'GET', undefined, 30000, env, customCredentials);
			
			if (!result.success) {
				return {
					content: [{
						type: "text",
						text: `**Failed to retrieve posts**\n\n${result.error}`,
						isError: true
					}]
				};
			}

			const posts = Array.isArray(result.data) ? result.data : (result.data?.posts || []);
			if (posts.length === 0) {
				return {
					content: [{
						type: "text",
						text: `**No posts found**\n\nTry adjusting your filters or create some posts first!`
					}]
				};
			}

			const postList = posts.map((post: any, index: number) => {
				const tags = post.tags?.map((tag: any) => typeof tag === 'string' ? tag : tag.name).join(', ') || 'None';
				return `${index + 1}. **${post.title}**\n   ID: ${post.id}\n   Status: ${post.status}${post.featured ? ' ⭐ Featured' : ''}\n   Tags: ${tags}\n   Published: ${post.published_at || 'Not published'}`;
			}).join('\n\n');

			return {
				content: [{
					type: "text",
					text: `**Found ${posts.length} post${posts.length !== 1 ? 's' : ''}**\n\n${postList}\n\n**Filters Applied:**\n• Status: ${params.status}\n• Limit: ${params.limit}${params.featured !== undefined ? `\n• Featured: ${params.featured}` : ''}`
				}]
			};
		}
	);

	// Tool 6: Advanced Search
	server.tool(
		"ghost_advanced_search",
		"Search blog posts with advanced filters including text search and tag filtering. You can specify ghost_admin_api_key and ghost_api_url to search a different blog.",
		{
			search: z.string().optional().describe("Search term to find in post title or content"),
			tag: z.string().optional().describe("Filter posts by specific tag name"),
			status: z.enum(["draft", "published", "all"]).default("all").describe("Filter by post status"),
			limit: z.number().int().min(1).max(50).default(5).describe("Maximum results to return (1-50)"),
			ghost_admin_api_key: z.string().optional().describe("Optional: Override default Ghost Admin API Key to search a different blog"),
			ghost_api_url: z.string().optional().describe("Optional: Override default Ghost blog URL to search a different blog")
		},
		async (params) => {
			const { ghost_admin_api_key, ghost_api_url, ...searchOptions } = params;
			const customCredentials = (ghost_admin_api_key || ghost_api_url) ? {
				ghost_admin_api_key,
				ghost_api_url
			} : undefined;
			
			const queryParams = new URLSearchParams();
			if (searchOptions.search) queryParams.append('search', searchOptions.search);
			if (searchOptions.tag) queryParams.append('tag', searchOptions.tag);
			queryParams.append('status', searchOptions.status);
			queryParams.append('limit', searchOptions.limit.toString());

			const result = await callGhostBlogApi(`/api/posts/advanced?${queryParams.toString()}`, 'GET', undefined, 30000, env, customCredentials);
			
			if (!result.success) {
				return {
					content: [{
						type: "text",
						text: `**Search failed**\n\n${result.error}`,
						isError: true
					}]
				};
			}

			const posts = Array.isArray(result.data) ? result.data : (result.data?.posts || []);
			if (posts.length === 0) {
				return {
					content: [{
						type: "text",
						text: `**No posts found matching your search**\n\n**Search Criteria:**\n${params.search ? `• Search term: "${params.search}"` : ''}${params.tag ? `\n• Tag: "${params.tag}"` : ''}\n• Status: ${params.status}`
					}]
				};
			}

			const postList = posts.map((post: any, index: number) => {
				const tags = post.tags?.map((tag: any) => typeof tag === 'string' ? tag : tag.name).join(', ') || 'None';
				return `${index + 1}. **${post.title}**\n   ID: ${post.id}\n   Status: ${post.status}\n   Tags: ${tags}\n   Excerpt: ${post.excerpt ? post.excerpt.substring(0, 100) + '...' : 'No excerpt'}`;
			}).join('\n\n');

			return {
				content: [{
					type: "text",
					text: `**Found ${posts.length} matching post${posts.length !== 1 ? 's' : ''}**\n\n${postList}\n\n**Search Criteria:**\n${params.search ? `• Search: "${params.search}"` : ''}${params.tag ? `\n• Tag: "${params.tag}"` : ''}\n• Status: ${params.status}\n• Limit: ${params.limit}`
				}]
			};
		}
	);

	// Tool 7: Get Post Details
	server.tool(
		"ghost_get_post_details",
		"Get complete details of a specific blog post by its ID, including content, tags, and metadata. You can specify ghost_admin_api_key and ghost_api_url to query from a different blog.",
		{
			post_id: z.string().min(1).describe("The Ghost post ID (24-character hex string)"),
			ghost_admin_api_key: z.string().optional().describe("Optional: Override default Ghost Admin API Key to query a different blog"),
			ghost_api_url: z.string().optional().describe("Optional: Override default Ghost blog URL to query a different blog")
		},
		async (params) => {
			const { post_id, ghost_admin_api_key, ghost_api_url } = params;
			const customCredentials = (ghost_admin_api_key || ghost_api_url) ? {
				ghost_admin_api_key,
				ghost_api_url
			} : undefined;
			
			const result = await callGhostBlogApi(`/api/posts/${post_id}`, 'GET', undefined, 30000, env, customCredentials);
			
			if (!result.success) {
				return {
					content: [{
						type: "text",
						text: `**Failed to get post details**\n\n${result.error}`,
						isError: true
					}]
				};
			}

			const post = result.data;
			return {
				content: [{
					type: "text",
					text: `**Post Details**\n\n**Title:** ${post.title}\n**ID:** ${post.id}\n**Status:** ${post.status}${post.featured ? ' ⭐ Featured' : ''}\n**URL:** ${post.url || 'Not available'}\n**Tags:** ${post.tags?.join(', ') || 'None'}\n**Created:** ${post.created_at}\n**Updated:** ${post.updated_at}\n**Published:** ${post.published_at || 'Not published'}\n\n**Excerpt:**\n${post.excerpt || 'No excerpt'}\n\n**Content Preview:**\n${post.content ? post.content.substring(0, 500) + '...' : 'No content'}\n\n${post.feature_image ? '**Feature Image:** ' + post.feature_image : '**Feature Image:** None'}`
				}]
			};
		}
	);

	// Tool 8: Update Post
	server.tool(
		"ghost_update_post",
		"Update an existing blog post's content, metadata, or status. Only provide the fields you want to change. You can specify ghost_admin_api_key and ghost_api_url to update a post on a different blog.",
		{
			post_id: z.string().min(1).describe("The Ghost post ID to update"),
			title: z.string().optional().describe("New title for the post"),
			content: z.string().optional().describe("New content in HTML or Markdown"),
			excerpt: z.string().optional().describe("New excerpt/summary"),
			tags: z.array(z.string()).optional().describe("New array of tag names"),
			status: z.enum(["draft", "published"]).optional().describe("Change post status"),
			featured: z.boolean().optional().describe("Update featured status"),
			ghost_admin_api_key: z.string().optional().describe("Optional: Override default Ghost Admin API Key to update a post on a different blog"),
			ghost_api_url: z.string().optional().describe("Optional: Override default Ghost blog URL to update a post on a different blog")
		},
		async (params) => {
			const { post_id, ghost_admin_api_key, ghost_api_url, ...updateData } = params;
			const customCredentials = (ghost_admin_api_key || ghost_api_url) ? {
				ghost_admin_api_key,
				ghost_api_url
			} : undefined;
			
			const result = await callGhostBlogApi(`/api/posts/${post_id}`, 'PUT', updateData, 30000, env, customCredentials);
			
			if (!result.success) {
				return {
					content: [{
						type: "text",
						text: `**Failed to update post**\n\n${result.error}`,
						isError: true
					}]
				};
			}

			const post = result.data;
			const updatedFields = Object.keys(updateData).filter(key => key !== 'post_id');
			
			return {
				content: [{
					type: "text",
					text: `**Post Updated Successfully! ✅**\n\n**Title:** ${post.title}\n**ID:** ${post.id}\n**Status:** ${post.status}\n**URL:** ${post.url || 'Not available'}\n\n**Updated Fields:**\n${updatedFields.map(field => `• ${field}`).join('\n')}\n\n**Updated at:** ${post.updated_at}`
				}]
			};
		}
	);

	// Tool 9: Update Post Image
	server.tool(
		"ghost_update_post_image",
		"Generate and update the feature image for an existing blog post using AI. Takes 60-300 seconds to complete. Uses either Replicate Flux (faster) or Google Imagen (higher quality). You can specify ghost_admin_api_key and ghost_api_url to update an image on a different blog.",
		{
			post_id: z.string().min(1).describe("The Ghost post ID to update image for"),
			use_generated_feature_image: z.boolean().default(true).describe("Must be true to generate image"),
			prefer_imagen: z.boolean().optional().describe("Use Google Imagen (10-15s generation, professional quality)"),
			image_aspect_ratio: z.enum(["16:9", "1:1", "9:16", "4:3", "3:2"]).default("16:9").describe("Image aspect ratio"),
			ghost_admin_api_key: z.string().optional().describe("Optional: Override default Ghost Admin API Key to update image on a different blog"),
			ghost_api_url: z.string().optional().describe("Optional: Override default Ghost blog URL to update image on a different blog")
		},
		async (params) => {
			const { post_id, ghost_admin_api_key, ghost_api_url, ...imageOptions } = params;
			const customCredentials = (ghost_admin_api_key || ghost_api_url) ? {
				ghost_admin_api_key,
				ghost_api_url
			} : undefined;
			
			const result = await callGhostBlogApi(`/api/posts/${post_id}/image`, 'PUT', imageOptions, 300000, env, customCredentials); // 5 minutes timeout
			
			if (!result.success) {
				return {
					content: [{
						type: "text",
						text: `**Failed to update post image**\n\n${result.error}\n\n💡 Tip: Image generation can take time. Try using prefer_imagen=false for faster generation with Flux.`,
						isError: true
					}]
				};
			}

			const post = result.data;
			return {
				content: [{
					type: "text",
					text: `**Feature Image Updated! 🎨✅**\n\n**Post:** ${post.title}\n**ID:** ${post.id}\n**Image URL:** ${post.feature_image || 'Generation completed'}\n**Aspect Ratio:** ${params.image_aspect_ratio}\n**Provider:** ${params.prefer_imagen ? 'Google Imagen (Professional)' : 'Replicate Flux (Fast)'}\n\n✨ The new feature image is now live on your post!`
				}]
			};
		}
	);

	// Tool 10: Delete Post
	server.tool(
		"ghost_delete_post",
		"Permanently delete a blog post from Ghost CMS. This action cannot be undone. You can specify ghost_admin_api_key and ghost_api_url to delete from a different blog.",
		{
			post_id: z.string().min(1).describe("The Ghost post ID (24-character hex string)"),
			ghost_admin_api_key: z.string().optional().describe("Optional: Override default Ghost Admin API Key to delete from a different blog"),
			ghost_api_url: z.string().optional().describe("Optional: Override default Ghost blog URL to delete from a different blog")
		},
		async (params) => {
			const { post_id, ghost_admin_api_key, ghost_api_url } = params;
			const customCredentials = (ghost_admin_api_key || ghost_api_url) ? {
				ghost_admin_api_key,
				ghost_api_url
			} : undefined;
			
			const result = await callGhostBlogApi(`/api/posts/${post_id}`, 'DELETE', undefined, 30000, env, customCredentials);
			
			if (!result.success) {
				return {
					content: [{
						type: "text",
						text: `**Failed to delete post**\n\n${result.error}`,
						isError: true
					}]
				};
			}

			return {
				content: [{
					type: "text",
					text: `**Post Deleted Successfully! 🗑️✅**\n\n**Post ID:** ${post_id}\n**Status:** Permanently deleted\n\n⚠️ This action cannot be undone. The post and all its data have been removed from Ghost CMS.`
				}]
			};
		}
	);

	// Tool 11: Posts Summary
	server.tool(
		"ghost_posts_summary",
		"Get summary statistics about blog posts including counts by status and recent activity. You can specify ghost_admin_api_key and ghost_api_url to get statistics from a different blog.",
		{
			days: z.number().int().min(1).max(365).default(30).describe("Number of days to analyze (1-365)"),
			ghost_admin_api_key: z.string().optional().describe("Optional: Override default Ghost Admin API Key to get summary from a different blog"),
			ghost_api_url: z.string().optional().describe("Optional: Override default Ghost blog URL to get summary from a different blog")
		},
		async (params) => {
			const { ghost_admin_api_key, ghost_api_url, days } = params;
			const customCredentials = (ghost_admin_api_key || ghost_api_url) ? {
				ghost_admin_api_key,
				ghost_api_url
			} : undefined;
			
			const queryParams = new URLSearchParams();
			queryParams.append('days', days.toString());

			const result = await callGhostBlogApi(`/api/posts/summary?${queryParams.toString()}`, 'GET', undefined, 30000, env, customCredentials);
			
			if (!result.success) {
				return {
					content: [{
						type: "text",
						text: `**Failed to get posts summary**\n\n${result.error}`,
						isError: true
					}]
				};
			}

			const summary = result.data;
			return {
				content: [{
					type: "text",
					text: `**Blog Posts Summary (Last ${params.days} Days)**\n\n**Total Posts:** ${summary.total_posts || 0}\n**Published:** ${summary.published || 0}\n**Drafts:** ${summary.drafts || 0}\n**Featured:** ${summary.featured || 0}\n\n**Recent Activity:**\n• Posts created: ${summary.recent_created || 0}\n• Posts updated: ${summary.recent_updated || 0}\n• Posts published: ${summary.recent_published || 0}\n\n**Top Tags:**\n${summary.top_tags ? summary.top_tags.map((tag: any) => `• ${tag.name} (${tag.count} posts)`).join('\n') : 'No tags found'}\n\n**Analysis Period:** Last ${params.days} days\n**Generated:** ${new Date().toISOString()}`
				}]
			};
		}
	);

	// Tool 12: Batch Get Details
	server.tool(
		"ghost_batch_get_details",
		"Get details for multiple posts in a single request. More efficient than multiple individual requests. You can specify ghost_admin_api_key and ghost_api_url to query from a different blog.",
		{
			post_ids: z.array(z.string()).min(1).max(10).describe("Array of Ghost post IDs (max 10)"),
			ghost_admin_api_key: z.string().optional().describe("Optional: Override default Ghost Admin API Key to query a different blog"),
			ghost_api_url: z.string().optional().describe("Optional: Override default Ghost blog URL to query a different blog")
		},
		async (params) => {
			const { ghost_admin_api_key, ghost_api_url, post_ids } = params;
			const customCredentials = (ghost_admin_api_key || ghost_api_url) ? {
				ghost_admin_api_key,
				ghost_api_url
			} : undefined;
			
			const result = await callGhostBlogApi('/api/posts/batch-details', 'POST', { post_ids }, 30000, env, customCredentials);
			
			if (!result.success) {
				return {
					content: [{
						type: "text",
						text: `**Failed to get batch details**\n\n${result.error}`,
						isError: true
					}]
				};
			}

			const posts = Array.isArray(result.data) ? result.data : (result.data?.posts || []);
			if (posts.length === 0) {
				return {
					content: [{
						type: "text",
						text: `**No posts found**\n\nThe provided post IDs may be invalid or deleted.`
					}]
				};
			}

			const postDetails = posts.map((post: any) => {
				const tags = post.tags?.map((tag: any) => typeof tag === 'string' ? tag : tag.name).join(', ') || 'None';
				return `**${post.title}**\nID: ${post.id}\nStatus: ${post.status}${post.featured ? ' ⭐' : ''}\nTags: ${tags}\nURL: ${post.url || 'Not available'}`;
			}).join('\n\n---\n\n');

			return {
				content: [{
					type: "text",
					text: `**Retrieved ${posts.length} of ${post_ids.length} Posts**\n\n${postDetails}\n\n${posts.length < post_ids.length ? `⚠️ ${post_ids.length - posts.length} post(s) not found or inaccessible` : '✅ All requested posts retrieved successfully'}`
				}]
			};
		}
	);

	// Tool 13: Search by Date
	server.tool(
		"ghost_search_by_date",
		"Search posts by date pattern. Useful for finding posts from specific time periods. You can specify ghost_admin_api_key and ghost_api_url to search a different blog.",
		{
			pattern: z.string().min(4).describe("Date pattern: YYYY (year), YYYY-MM (month), or YYYY-MM-DD (specific date)"),
			limit: z.number().int().min(1).max(50).default(5).describe("Maximum results (1-50)"),
			ghost_admin_api_key: z.string().optional().describe("Optional: Override default Ghost Admin API Key to search a different blog"),
			ghost_api_url: z.string().optional().describe("Optional: Override default Ghost blog URL to search a different blog")
		},
		async (params) => {
			const { ghost_admin_api_key, ghost_api_url, pattern, limit } = params;
			const customCredentials = (ghost_admin_api_key || ghost_api_url) ? {
				ghost_admin_api_key,
				ghost_api_url
			} : undefined;
			
			const queryParams = new URLSearchParams();
			queryParams.append('pattern', pattern);
			queryParams.append('limit', limit.toString());

			const result = await callGhostBlogApi(`/api/posts/search/by-date-pattern?${queryParams.toString()}`, 'GET', undefined, 30000, env, customCredentials);
			
			if (!result.success) {
				return {
					content: [{
						type: "text",
						text: `**Date search failed**\n\n${result.error}`,
						isError: true
					}]
				};
			}

			const posts = Array.isArray(result.data) ? result.data : (result.data?.posts || []);
			if (posts.length === 0) {
				return {
					content: [{
						type: "text",
						text: `**No posts found for date pattern: ${params.pattern}**\n\nTry a different date pattern:\n• Year: YYYY (e.g., 2024)\n• Month: YYYY-MM (e.g., 2024-03)\n• Day: YYYY-MM-DD (e.g., 2024-03-15)`
					}]
				};
			}

			const postList = posts.map((post: any, index: number) => {
				const tags = post.tags?.map((tag: any) => typeof tag === 'string' ? tag : tag.name).join(', ') || 'None';
				return `${index + 1}. **${post.title}**\n   Date: ${post.published_at || post.created_at}\n   Status: ${post.status}\n   Tags: ${tags}`;
			}).join('\n\n');

			return {
				content: [{
					type: "text",
					text: `**Found ${posts.length} post${posts.length !== 1 ? 's' : ''} for pattern: ${params.pattern}**\n\n${postList}\n\n**Search Pattern:** ${params.pattern}\n**Limit:** ${params.limit}`
				}]
			};
		}
	);

	console.log(`Ghost Blog tools registered for user: ${props.login} (${props.name})`);
	console.log(`Total tools registered: 13`);
	console.log(`API endpoint: ${API_BASE_URL}`);
}
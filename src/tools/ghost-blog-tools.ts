import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Props } from "../types";

const ALLOWED_USERNAMES = new Set<string>([
	'preangelleo'   // Only authorized user - project owner
]);

// Ghost Blog Smart API base URL
const API_BASE_URL = 'https://animagent.ai/ghost-blog-api';
const GHOST_BLOG_API_KEY = '1fc21aec-7246-48c5-acef-d4743485de01'; // Should match COOKIE_ENCRYPTION_KEY in Worker

interface ApiResponse {
	success: boolean;
	data?: any;
	error?: string;
	message?: string;
	timestamp?: string;
	version?: string;
}

async function callGhostBlogApi(
	endpoint: string, 
	method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET', 
	body?: any,
	timeout: number = 30000
): Promise<ApiResponse> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeout);

	try {
		const response = await fetch(`${API_BASE_URL}${endpoint}`, {
			method,
			headers: {
				'Content-Type': 'application/json',
				'X-API-Key': GHOST_BLOG_API_KEY,
				'User-Agent': 'Content-Creation-MCP/1.0'
			},
			body: body ? JSON.stringify(body) : undefined,
			signal: controller.signal
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
		}

		return await response.json();
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


export function registerGhostBlogTools(server: McpServer, _env: Env, props: Props) {
	// Only register tools for authorized users
	if (!ALLOWED_USERNAMES.has(props.login)) {
		console.log(`User ${props.login} is not authorized to use Ghost Blog tools`);
		return;
	}

	// Tool 1: Health Check
	server.tool(
		"ghost_health_check",
		"Check if the Ghost Blog Smart API is running and healthy. Returns API status, version, and available features.",
		{},
		async () => {
			const result = await callGhostBlogApi('/health');
			
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
			const result = await callGhostBlogApi('/');
			
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
		"Create a new blog post in Ghost CMS. Can optionally generate an AI feature image using Replicate Flux or Google Imagen. Set is_test=true to test without creating real posts.",
		{
			title: z.string().min(1).describe("Title of the blog post"),
			content: z.string().min(1).describe("Content in HTML or Markdown format"),
			excerpt: z.string().optional().describe("Brief excerpt/summary of the post"),
			tags: z.array(z.string()).optional().describe("Array of tag names to assign to the post"),
			status: z.enum(["draft", "published"]).default("draft").describe("Post status: draft or published"),
			featured: z.boolean().optional().describe("Whether to feature this post"),
			use_generated_feature_image: z.boolean().optional().describe("Generate AI feature image (adds 60-300s)"),
			prefer_flux: z.boolean().optional().describe("Use Replicate Flux for faster image generation (3-7s)"),
			prefer_imagen: z.boolean().optional().describe("Use Google Imagen for professional quality (10-15s)"),
			image_aspect_ratio: z.enum(["16:9", "1:1", "9:16", "4:3", "3:2"]).optional().describe("Aspect ratio for generated image"),
			is_test: z.boolean().default(true).describe("Test mode - simulate without creating real post")
		},
		async (params) => {
			const timeout = params.use_generated_feature_image ? 300000 : 30000; // 5 minutes for images
			const result = await callGhostBlogApi('/api/posts', 'POST', params, timeout);
			
			if (!result.success) {
				return {
					content: [{
						type: "text",
						text: `**Failed to create post**\n\n${result.error}${params.use_generated_feature_image ? '\n\n💡 Tip: Image generation can timeout. Try without images or use prefer_flux=true for faster generation.' : ''}`,
						isError: true
					}]
				};
			}

			const post = result.data;
			return {
				content: [{
					type: "text",
					text: `**Post ${params.is_test ? 'Test Completed' : 'Created Successfully'}! ✅**\n\n**Title:** ${post.title}\n**Status:** ${post.status}\n**URL:** ${post.url || 'Test mode - no URL'}\n**Tags:** ${post.tags?.join(', ') || 'None'}\n**Featured:** ${post.featured ? 'Yes' : 'No'}\n${post.feature_image ? `**Feature Image:** Generated successfully` : ''}\n\n**Excerpt:**\n${post.excerpt || 'No excerpt'}\n\n${params.is_test ? '⚠️ Test mode - no actual post was created' : `✨ Your post is now ${post.status === 'published' ? 'live' : 'saved as draft'}!`}`
				}]
			};
		}
	);

	// Tool 4: Smart Create
	server.tool(
		"ghost_smart_create",
		"Create a blog post using AI to enhance your input. Provide notes or ideas, and AI will generate a complete post with title, content, and tags. Uses Google Gemini for content generation.",
		{
			user_input: z.string().min(1).describe("Your ideas, notes, or topic to be enhanced by AI into a full blog post"),
			status: z.enum(["draft", "published"]).default("draft").describe("Post status after creation"),
			preferred_language: z.string().default("English").describe("Language for the generated content"),
			is_test: z.boolean().default(true).describe("Test mode - simulate without creating real post")
		},
		async (params) => {
			const result = await callGhostBlogApi('/api/smart-create', 'POST', params, 60000);
			
			if (!result.success) {
				return {
					content: [{
						type: "text",
						text: `**Failed to create AI-enhanced post**\n\n${result.error}`,
						isError: true
					}]
				};
			}

			const post = result.data;
			return {
				content: [{
					type: "text",
					text: `**AI-Enhanced Post ${params.is_test ? 'Test Completed' : 'Created'}! 🤖✅**\n\n**Title:** ${post.title}\n**Status:** ${post.status}\n**URL:** ${post.url || 'Test mode - no URL'}\n**Tags:** ${post.tags?.join(', ') || 'None'}\n**Language:** ${params.preferred_language}\n\n**AI-Generated Excerpt:**\n${post.excerpt || 'No excerpt'}\n\n${params.is_test ? '⚠️ Test mode - no actual post was created' : `✨ AI has transformed your ideas into a ${post.status === 'published' ? 'live post' : 'draft'}!`}\n\n**Original Input:**\n"${params.user_input}"`
				}]
			};
		}
	);

	// Tool 5: Get Posts
	server.tool(
		"ghost_get_posts",
		"Retrieve a list of blog posts from Ghost CMS with optional filters for status and featured posts.",
		{
			limit: z.number().int().min(1).max(100).default(10).describe("Maximum number of posts to retrieve (1-100)"),
			status: z.enum(["draft", "published", "all"]).default("all").describe("Filter by post status"),
			featured: z.boolean().optional().describe("Filter to show only featured posts")
		},
		async (params) => {
			const queryParams = new URLSearchParams();
			queryParams.append('limit', params.limit.toString());
			queryParams.append('status', params.status);
			if (params.featured !== undefined) {
				queryParams.append('featured', params.featured.toString());
			}

			const result = await callGhostBlogApi(`/api/posts?${queryParams.toString()}`);
			
			if (!result.success) {
				return {
					content: [{
						type: "text",
						text: `**Failed to retrieve posts**\n\n${result.error}`,
						isError: true
					}]
				};
			}

			const posts = result.data || [];
			if (posts.length === 0) {
				return {
					content: [{
						type: "text",
						text: `**No posts found**\n\nTry adjusting your filters or create some posts first!`
					}]
				};
			}

			const postList = posts.map((post: any, index: number) => 
				`${index + 1}. **${post.title}**\n   ID: ${post.id}\n   Status: ${post.status}${post.featured ? ' ⭐ Featured' : ''}\n   Tags: ${post.tags?.join(', ') || 'None'}\n   Published: ${post.published_at || 'Not published'}`
			).join('\n\n');

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
		"Search blog posts with advanced filters including text search and tag filtering.",
		{
			search: z.string().optional().describe("Search term to find in post title or content"),
			tag: z.string().optional().describe("Filter posts by specific tag name"),
			status: z.enum(["draft", "published", "all"]).default("all").describe("Filter by post status"),
			limit: z.number().int().min(1).max(50).default(5).describe("Maximum results to return (1-50)")
		},
		async (params) => {
			const queryParams = new URLSearchParams();
			if (params.search) queryParams.append('search', params.search);
			if (params.tag) queryParams.append('tag', params.tag);
			queryParams.append('status', params.status);
			queryParams.append('limit', params.limit.toString());

			const result = await callGhostBlogApi(`/api/posts/advanced?${queryParams.toString()}`);
			
			if (!result.success) {
				return {
					content: [{
						type: "text",
						text: `**Search failed**\n\n${result.error}`,
						isError: true
					}]
				};
			}

			const posts = result.data || [];
			if (posts.length === 0) {
				return {
					content: [{
						type: "text",
						text: `**No posts found matching your search**\n\n**Search Criteria:**\n${params.search ? `• Search term: "${params.search}"` : ''}${params.tag ? `\n• Tag: "${params.tag}"` : ''}\n• Status: ${params.status}`
					}]
				};
			}

			const postList = posts.map((post: any, index: number) => 
				`${index + 1}. **${post.title}**\n   ID: ${post.id}\n   Status: ${post.status}\n   Tags: ${post.tags?.join(', ') || 'None'}\n   Excerpt: ${post.excerpt ? post.excerpt.substring(0, 100) + '...' : 'No excerpt'}`
			).join('\n\n');

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
		"Get complete details of a specific blog post by its ID, including content, tags, and metadata.",
		{
			post_id: z.string().min(1).describe("The Ghost post ID (24-character hex string)")
		},
		async ({ post_id }) => {
			const result = await callGhostBlogApi(`/api/posts/${post_id}`);
			
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
		"Update an existing blog post's content, metadata, or status. Only provide the fields you want to change.",
		{
			post_id: z.string().min(1).describe("The Ghost post ID to update"),
			title: z.string().optional().describe("New title for the post"),
			content: z.string().optional().describe("New content in HTML or Markdown"),
			excerpt: z.string().optional().describe("New excerpt/summary"),
			tags: z.array(z.string()).optional().describe("New array of tag names"),
			status: z.enum(["draft", "published"]).optional().describe("Change post status"),
			featured: z.boolean().optional().describe("Update featured status")
		},
		async ({ post_id, ...updateData }) => {
			const result = await callGhostBlogApi(`/api/posts/${post_id}`, 'PUT', updateData);
			
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
		"Generate and update the feature image for an existing blog post using AI. Takes 60-300 seconds to complete. Uses either Replicate Flux (faster) or Google Imagen (higher quality).",
		{
			post_id: z.string().min(1).describe("The Ghost post ID to update image for"),
			use_generated_feature_image: z.boolean().default(true).describe("Must be true to generate image"),
			prefer_imagen: z.boolean().optional().describe("Use Google Imagen (10-15s generation, professional quality)"),
			image_aspect_ratio: z.enum(["16:9", "1:1", "9:16", "4:3", "3:2"]).default("16:9").describe("Image aspect ratio")
		},
		async (params) => {
			const result = await callGhostBlogApi(`/api/posts/${params.post_id}/image`, 'PUT', {
				use_generated_feature_image: params.use_generated_feature_image,
				prefer_imagen: params.prefer_imagen,
				image_aspect_ratio: params.image_aspect_ratio
			}, 300000); // 5 minutes timeout
			
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
		"Permanently delete a blog post from Ghost CMS. This action cannot be undone.",
		{
			post_id: z.string().min(1).describe("The Ghost post ID (24-character hex string)")
		},
		async ({ post_id }) => {
			const result = await callGhostBlogApi(`/api/posts/${post_id}`, 'DELETE');
			
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
		"Get summary statistics about blog posts including counts by status and recent activity.",
		{
			days: z.number().int().min(1).max(365).default(30).describe("Number of days to analyze (1-365)")
		},
		async (params) => {
			const queryParams = new URLSearchParams();
			queryParams.append('days', params.days.toString());

			const result = await callGhostBlogApi(`/api/posts/summary?${queryParams.toString()}`);
			
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
		"Get details for multiple posts in a single request. More efficient than multiple individual requests.",
		{
			post_ids: z.array(z.string()).min(1).max(10).describe("Array of Ghost post IDs (max 10)")
		},
		async ({ post_ids }) => {
			const result = await callGhostBlogApi('/api/posts/batch-details', 'POST', { post_ids });
			
			if (!result.success) {
				return {
					content: [{
						type: "text",
						text: `**Failed to get batch details**\n\n${result.error}`,
						isError: true
					}]
				};
			}

			const posts = result.data || [];
			if (posts.length === 0) {
				return {
					content: [{
						type: "text",
						text: `**No posts found**\n\nThe provided post IDs may be invalid or deleted.`
					}]
				};
			}

			const postDetails = posts.map((post: any) => 
				`**${post.title}**\nID: ${post.id}\nStatus: ${post.status}${post.featured ? ' ⭐' : ''}\nTags: ${post.tags?.join(', ') || 'None'}\nURL: ${post.url || 'Not available'}`
			).join('\n\n---\n\n');

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
		"Search posts by date pattern. Useful for finding posts from specific time periods.",
		{
			pattern: z.string().min(4).describe("Date pattern: YYYY (year), YYYY-MM (month), or YYYY-MM-DD (specific date)"),
			limit: z.number().int().min(1).max(50).default(5).describe("Maximum results (1-50)")
		},
		async (params) => {
			const queryParams = new URLSearchParams();
			queryParams.append('pattern', params.pattern);
			queryParams.append('limit', params.limit.toString());

			const result = await callGhostBlogApi(`/api/posts/search/by-date-pattern?${queryParams.toString()}`);
			
			if (!result.success) {
				return {
					content: [{
						type: "text",
						text: `**Date search failed**\n\n${result.error}`,
						isError: true
					}]
				};
			}

			const posts = result.data || [];
			if (posts.length === 0) {
				return {
					content: [{
						type: "text",
						text: `**No posts found for date pattern: ${params.pattern}**\n\nTry a different date pattern:\n• Year: YYYY (e.g., 2024)\n• Month: YYYY-MM (e.g., 2024-03)\n• Day: YYYY-MM-DD (e.g., 2024-03-15)`
					}]
				};
			}

			const postList = posts.map((post: any, index: number) => 
				`${index + 1}. **${post.title}**\n   Date: ${post.published_at || post.created_at}\n   Status: ${post.status}\n   Tags: ${post.tags?.join(', ') || 'None'}`
			).join('\n\n');

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
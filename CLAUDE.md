# Content Creation MCP Server - Implementation Guide

This guide documents the implementation of the Content Creation MCP Server that integrates with Ghost Blog Smart API for AI-powered content management through Claude Desktop.

## 🎯 Project Overview

**Purpose**: Enable AI-powered content creation and management for Ghost CMS through Claude Desktop using the Model Context Protocol (MCP).

**Architecture**:
```
Claude Desktop → Content Creation MCP → Ghost Blog Smart API → Ghost CMS
                 (Cloudflare Workers)    (Docker on animagent.ai)   (Sumatman Blog)
```

## 🏗️ Core Architecture

### Technology Stack

- **Runtime**: Cloudflare Workers (V8 isolates)
- **Protocol**: Model Context Protocol (MCP)
- **Authentication**: GitHub OAuth 2.0
- **Backend API**: Ghost Blog Smart API
- **Language**: TypeScript
- **Package Manager**: npm
- **Deploy Tool**: Wrangler CLI

### Project Structure

```
/
├── src/
│   ├── index.ts                 # Main MCP server entry point
│   ├── types.ts                 # TypeScript type definitions
│   ├── auth/
│   │   ├── github-handler.ts   # GitHub OAuth flow
│   │   └── oauth-utils.ts      # OAuth utilities
│   └── tools/
│       ├── ghost-blog-tools.ts # Ghost Blog API integration (13 tools)
│       └── register-tools.ts   # Tool registration logic
├── wrangler.jsonc              # Cloudflare Workers configuration
├── package.json                # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
├── .dev.vars                  # Local environment variables
└── README.md                  # User documentation
```

## 🔧 Configuration

### Environment Variables

```bash
# GitHub OAuth (Required)
GITHUB_CLIENT_ID=Ov23lijLeIH0nDV4c9Xo
GITHUB_CLIENT_SECRET=fafa8251f0ce06bff60e9aa7c5d19b699c41dca0

# API Authentication (Required)
COOKIE_ENCRYPTION_KEY=1fc21aec-7246-48c5-acef-d4743485de01  # Must match Ghost Blog API key

# Development
NODE_ENV=development
```

### Backend API Configuration

```typescript
// Ghost Blog Smart API endpoint
const API_BASE_URL = 'https://animagent.ai/ghost-blog-api';
const GHOST_BLOG_API_KEY = '1fc21aec-7246-48c5-acef-d4743485de01';
```

### Access Control

```typescript
// Single-user restriction (update with your GitHub username)
const ALLOWED_USERNAMES = new Set<string>([
  'preangelleo'  // Only this GitHub user can access the MCP server
]);
```

## 📦 Available MCP Tools

### Content Creation Tools (13 Total)

1. **`ghost_health_check`** - Check API status and version
2. **`ghost_api_info`** - Get API information and endpoints  
3. **`ghost_create_post`** - Create new blog post with optional AI image
4. **`ghost_smart_create`** - AI-enhanced post creation from ideas
5. **`ghost_get_posts`** - List posts with filters
6. **`ghost_advanced_search`** - Search with text and tags
7. **`ghost_get_post_details`** - Get complete post information
8. **`ghost_update_post`** - Update post content or metadata
9. **`ghost_update_post_image`** - Generate and update feature image
10. **`ghost_delete_post`** - Permanently delete a post
11. **`ghost_posts_summary`** - Get statistics and analytics
12. **`ghost_batch_get_details`** - Get multiple posts efficiently
13. **`ghost_search_by_date`** - Find posts by date patterns

### Tool Implementation Pattern

```typescript
server.tool(
  "ghost_create_post",
  "Create a new blog post in Ghost CMS",
  {
    title: z.string().min(1).describe("Title of the blog post"),
    content: z.string().min(1).describe("Content in HTML or Markdown"),
    status: z.enum(["draft", "published"]).optional(),
    tags: z.array(z.string()).optional(),
    use_generated_feature_image: z.boolean().optional(),
    prefer_flux: z.boolean().optional(),
    is_test: z.boolean().optional()
  },
  async (args) => {
    // Validate user permissions
    if (!ALLOWED_USERNAMES.has(props.login)) {
      return createErrorResponse("Unauthorized access");
    }

    // Call Ghost Blog Smart API
    const response = await fetch(`${API_BASE_URL}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': GHOST_BLOG_API_KEY
      },
      body: JSON.stringify(args)
    });

    // Return MCP-formatted response
    return createSuccessResponse("Post created", await response.json());
  }
);
```

## 🔐 Authentication Flow

### GitHub OAuth 2.0 Implementation

1. **Authorization Request** (`/authorize`)
   - Check for existing approval cookie
   - Redirect to GitHub for authentication
   - Store state in KV namespace

2. **GitHub Callback** (`/callback`)
   - Exchange code for access token
   - Fetch user information from GitHub
   - Validate against allowed usernames
   - Create signed approval cookie

3. **MCP Session** (`/mcp`)
   - Verify authenticated user
   - Initialize MCP agent with user context
   - Register Ghost Blog tools

### Security Features

- **Single-User Access**: Only configured GitHub username allowed
- **Signed Cookies**: HMAC-SHA256 signed approval cookies
- **API Key Protection**: Environment variable configuration
- **Session Management**: Cloudflare KV for OAuth state

## 🚀 Development Workflow

### Local Development

```bash
# Install dependencies
npm install

# Configure environment
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your credentials

# Start development server
wrangler dev
# Server runs at http://localhost:8792

# Type checking
npm run type-check
```

### Testing with Claude Desktop

```json
{
  "mcpServers": {
    "content-creation": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:8792/mcp"],
      "env": {}
    }
  }
}
```

### Production Deployment

```bash
# Login to Cloudflare
wrangler login

# Create KV namespace
wrangler kv namespace create "OAUTH_KV"

# Deploy to production
wrangler deploy

# Set production secrets
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put COOKIE_ENCRYPTION_KEY
```

## 📊 API Integration Details

### Ghost Blog Smart API Endpoints

All API calls are made to `https://animagent.ai/ghost-blog-api` with the following headers:

```typescript
headers: {
  'Content-Type': 'application/json',
  'X-API-Key': GHOST_BLOG_API_KEY
}
```

### Available Endpoints

- `GET /health` - Health check (no auth)
- `GET /` - API information (no auth)
- `POST /api/posts` - Create post with AI features
- `POST /api/smart-create` - AI-enhanced creation
- `GET /api/posts` - List posts with filters
- `GET /api/posts/advanced` - Advanced search
- `GET /api/posts/{id}` - Get post details
- `PUT /api/posts/{id}` - Update post
- `PUT /api/posts/{id}/image` - Update feature image
- `DELETE /api/posts/{id}` - Delete post
- `GET /api/posts/summary` - Statistics
- `POST /api/posts/batch` - Batch operations
- `GET /api/posts/date/{pattern}` - Date search

### AI Features

**Content Generation (Google Gemini)**:
- Transforms ideas into complete blog posts
- Generates titles, excerpts, and tags
- Multi-language support

**Image Generation**:
- **Replicate Flux**: Fast generation (3-7s)
- **Google Imagen**: Professional quality (10-15s)
- Multiple aspect ratios supported
- Automatic fallback between providers

## 🎨 Response Format Standards

### Success Response

```typescript
function createSuccessResponse(message: string, data?: any): McpResponse {
  return {
    content: [{
      type: "text",
      text: `**Success**\n\n${message}\n\n**Result:**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``
    }]
  };
}
```

### Error Response

```typescript
function createErrorResponse(message: string, details?: any): McpResponse {
  return {
    content: [{
      type: "text",
      text: `**Error**\n\n${message}`,
      isError: true
    }]
  };
}
```

## 🔍 Monitoring & Debugging

### Development Logs

```bash
# Watch development logs
wrangler dev

# Production logs
wrangler tail
```

### Common Issues & Solutions

1. **Authentication Errors**
   - Verify GitHub OAuth credentials
   - Check username in ALLOWED_USERNAMES
   - Clear cookies and re-authenticate

2. **API Connection Issues**
   - Verify Ghost Blog Smart API is running
   - Check API key matches
   - Test health endpoint directly

3. **Tool Execution Errors**
   - Check request parameters match schema
   - Verify API response format
   - Review error details in logs

## 📝 Important Notes

### Production Considerations

- **API Timeouts**: Extended timeouts for image generation (300s)
- **Rate Limiting**: Respect Ghost CMS and AI provider limits
- **Error Handling**: Always return user-friendly error messages
- **Test Mode**: Use `is_test: true` for safe experimentation

### Security Best Practices

- Never commit `.dev.vars` or secrets to repository
- Rotate API keys periodically
- Monitor access logs for unauthorized attempts
- Keep dependencies updated

## 🚦 Current Status

**Production Environment**:
- **MCP Server**: `https://content-creation-mcp-preangelleo.preangelleo.workers.dev`
- **Ghost Blog API**: `https://animagent.ai/ghost-blog-api`
- **Status**: ✅ Fully operational

**Features Implemented**:
- ✅ 13 Ghost Blog management tools
- ✅ GitHub OAuth authentication
- ✅ AI content generation (Gemini)
- ✅ AI image generation (Flux/Imagen)
- ✅ Single-user access control
- ✅ Test mode for safe experimentation

## 📚 Resources

- [Model Context Protocol Docs](https://modelcontextprotocol.io/)
- [Ghost CMS API](https://ghost.org/docs/admin-api/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Ghost Blog Smart API](https://github.com/preangelleo/ghost-blog-smart)

---

**Version**: 2.0.0  
**Last Updated**: 2025-08-28  
**Author**: leowang.net <me@leowang.net>
# 🚀 Content Creation MCP Server - AI-Powered Ghost CMS Management

**🎨 Create, manage, and enhance blog posts with AI** through Claude Desktop using the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)  
**🤖 AI Features**: Google Gemini content generation, Flux & Imagen image creation  
**🔐 Security**: GitHub OAuth authentication with single-user access control  
**☁️ Architecture**: Cloudflare Workers + Ghost Blog Smart API

Transform your content creation workflow with AI-powered tools that let you write blog posts from simple ideas, generate stunning feature images, and manage your Ghost CMS blog - all from Claude Desktop!

## ✨ Features

### 🤖 AI-Powered Content Creation
- **Smart Create**: Transform rough ideas into complete blog posts with AI
- **Auto Enhancement**: Generate titles, excerpts, and tags automatically
- **Multi-language Support**: Create content in any language
- **Test Mode**: Safely experiment without creating real posts

### 🎨 Dual AI Image Generation
- **Replicate Flux**: Ultra-fast generation (3-7 seconds)
- **Google Imagen**: Professional quality (10-15 seconds)
- **Multiple Aspect Ratios**: 16:9, 1:1, 9:16, 4:3, 3:2
- **Automatic Fallback**: Intelligent provider switching for reliability

### 📝 Complete Blog Management
- **Full CRUD Operations**: Create, read, update, delete posts
- **Advanced Search**: Text search, tag filtering, date patterns
- **Batch Operations**: Process multiple posts efficiently
- **Analytics**: Summary statistics and activity tracking
- **Featured Posts**: Manage featured content easily

### 🔒 Enterprise Security
- **GitHub OAuth**: Secure authentication flow
- **Single-User Access**: Restrict to your GitHub username
- **API Key Protection**: Environment-based configuration
- **Signed Cookies**: HMAC-secured session management

## 🛠️ Available MCP Tools (13 Total)

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

## 📋 Prerequisites

- **Node.js 18+** installed
- **Cloudflare account** (free tier works)
- **GitHub account** for OAuth
- **Ghost CMS** instance with Admin API access
- **Ghost Blog Smart API** deployed (see [ghost-blog-smart](https://github.com/preangelleo/ghost-blog-smart))

## 🚀 Quick Start

### 1. Clone and Setup

```bash
git clone https://github.com/preangelleo/content-creation-mcp.git
cd content-creation-mcp
npm install
npm install -g wrangler
```

### 2. Configure GitHub OAuth

Create a GitHub OAuth App at [GitHub Developer Settings](https://github.com/settings/developers):

**For Local Development:**
- Application name: `Content Creation MCP (Dev)`
- Homepage URL: `http://localhost:8792`
- Callback URL: `http://localhost:8792/callback`

**For Production:**
- Application name: `Content Creation MCP`
- Homepage URL: `https://your-worker.workers.dev`
- Callback URL: `https://your-worker.workers.dev/callback`

### 3. Setup Environment

```bash
# Copy example configuration
cp .dev.vars.example .dev.vars

# Edit .dev.vars with your credentials
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
COOKIE_ENCRYPTION_KEY=your_api_key_here  # Must match Ghost Blog API key
```

### 4. Configure Access Control

**IMPORTANT**: Update your GitHub username for exclusive access:

Edit `src/tools/ghost-blog-tools.ts` line 5-7:
```typescript
const ALLOWED_USERNAMES = new Set<string>([
  'your-github-username'  // Replace with YOUR username
]);
```

### 5. Test Locally

```bash
# Start development server
wrangler dev

# Server runs at http://localhost:8792
```

### 6. Deploy to Cloudflare

```bash
# Login to Cloudflare
wrangler login

# Create KV namespace
wrangler kv namespace create "OAUTH_KV"

# Update wrangler.jsonc with the KV namespace ID

# Deploy to production
wrangler deploy

# Set production secrets
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put COOKIE_ENCRYPTION_KEY
```

## 🔌 Claude Desktop Integration

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "content-creation": {
      "command": "npx",
      "args": ["mcp-remote", "https://your-worker.workers.dev/mcp"],
      "env": {}
    }
  }
}
```

## 💡 Usage Examples

### Create a Post with AI Enhancement
```
"Use ghost_smart_create to write about 'The future of AI in healthcare' as a draft"
```

### Create Post with Feature Image
```
"Use ghost_create_post to create a post titled 'My Journey' with content 'Story here...' and generate a feature image using Flux"
```

### Search and Manage Posts
```
"Use ghost_get_posts to show me the last 10 published posts"
"Use ghost_advanced_search to find posts tagged 'technology'"
"Use ghost_update_post to change post ID abc123 status to published"
```

## 🏗️ Architecture

```
Claude Desktop
    ↓
MCP Protocol (via npx mcp-remote)
    ↓
Cloudflare Workers (OAuth + MCP Server)
    ↓
Ghost Blog Smart API
    ↓
Ghost CMS
```

## 🔧 Configuration

### Ghost Blog Smart API

The MCP server connects to the Ghost Blog Smart API. Ensure it's deployed and accessible:

- Default URL: `https://animagent.ai/ghost-blog-api`
- API Key: Must match `COOKIE_ENCRYPTION_KEY`
- See [ghost-blog-smart](https://github.com/preangelleo/ghost-blog-smart) for deployment

### Timeouts

Some operations require extended timeouts:
- Image generation: 5 minutes (300 seconds)
- Smart create: 1 minute (60 seconds)
- Standard operations: 30 seconds

## 🧪 Testing

### Test with MCP Inspector

```bash
npx @modelcontextprotocol/inspector@latest
```

1. Connect to `http://localhost:8792/mcp`
2. Complete GitHub OAuth flow
3. Test tools with various parameters

### Test Individual Tools

All tools support `is_test: true` parameter for safe testing without creating real content.

## 📊 Monitoring

View logs and metrics:

```bash
# Development logs
wrangler dev

# Production logs
wrangler tail

# Cloudflare Dashboard
# Visit: https://dash.cloudflare.com
```

## 🔒 Security Features

- **Authentication**: GitHub OAuth 2.0 flow
- **Authorization**: Single-user access control
- **Session Security**: HMAC-signed cookies
- **API Protection**: Key-based authentication
- **No Hardcoded Secrets**: Environment variable configuration

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io/) by Anthropic
- [Ghost CMS](https://ghost.org/) for the blogging platform
- [Cloudflare Workers](https://workers.cloudflare.com/) for serverless infrastructure
- Google Gemini & Imagen for AI capabilities
- Replicate for Flux image generation

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/preangelleo/content-creation-mcp/issues)
- **Documentation**: [MCP Docs](https://modelcontextprotocol.io/docs)
- **Ghost Blog Smart**: [GitHub Repo](https://github.com/preangelleo/ghost-blog-smart)

---

**Made with ❤️ for content creators using Ghost CMS and Claude Desktop**

✨ Transform your ideas into published content with the power of AI!
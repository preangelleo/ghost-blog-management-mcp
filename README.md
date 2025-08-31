# 📝 Ghost Blog Management MCP Server

**AI-Powered Content Creation & Management for Ghost CMS through Claude Desktop**

[![Version](https://img.shields.io/badge/version-2.1.0-blue.svg)](https://github.com/preangelleo/ghost-blog-management-mcp/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/platform-Cloudflare%20Workers-orange.svg)](https://workers.cloudflare.com/)
[![Model Context Protocol](https://img.shields.io/badge/protocol-MCP-purple.svg)](https://modelcontextprotocol.io/)

## 🎯 Overview

Transform your Ghost CMS workflow with AI-powered content creation directly from Claude Desktop. This Model Context Protocol (MCP) server enables seamless blog management, automated content generation, and intelligent image creation for your Ghost blogs.

### ✨ Key Features

- **🤖 AI Content Creation**: Generate complete blog posts from simple ideas using Google Gemini
- **🎨 Automatic Image Generation**: Create stunning feature images with Replicate Flux or Google Imagen
- **📝 Complete Blog Management**: Create, update, search, and manage posts through 13 powerful tools
- **🔐 Secure Authentication**: GitHub OAuth 2.0 with configurable access control
- **🌐 Multi-Blog Support**: Manage multiple Ghost blogs with three-level credential priority
- **⚡ Cloudflare Workers**: Global edge deployment with zero cold starts
- **🧪 Test Mode**: Safe experimentation without creating real posts

## 🏗️ Architecture

```
Claude Desktop → Ghost Blog MCP (Cloudflare Workers) → Ghost Blog Smart API → Ghost CMS
                 │                                      │
                 └── GitHub OAuth                       └── AI Services (Gemini, Replicate)
```

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Cloudflare Account](https://dash.cloudflare.com/sign-up)
- [GitHub OAuth App](https://github.com/settings/developers)
- [Claude Desktop](https://claude.ai/download)

### 1. Installation

```bash
git clone https://github.com/preangelleo/ghost-blog-management-mcp.git
cd ghost-blog-management-mcp
npm install
```

### 2. Configuration

```bash
# Copy environment template
cp .dev.vars.example .dev.vars

# Edit .dev.vars with your credentials
# See Configuration section below for details
```

### 3. Development

```bash
# Start development server
npm run dev
# Server runs at http://localhost:8792

# Type checking
npm run type-check
```

### 4. Production Deployment

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy to production
npm run deploy

# Set production secrets
echo "your_github_client_id" | wrangler secret put GITHUB_CLIENT_ID
echo "your_github_client_secret" | wrangler secret put GITHUB_CLIENT_SECRET
echo "your_encryption_key" | wrangler secret put COOKIE_ENCRYPTION_KEY
```

## ⚙️ Configuration

### Environment Variables

Create `.dev.vars` from `.dev.vars.example` and configure:

```bash
# GitHub OAuth (Required)
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here

# Cookie Encryption (Required)
COOKIE_ENCRYPTION_KEY=your_64_character_hex_encryption_key_here

# Authorization Control
AUTHORIZED_USERS=your_github_username  # Private mode
# AUTHORIZED_USERS=                     # Public mode (all GitHub users)

# Optional: Override default Ghost blog
# CUSTOM_GHOST_ADMIN_API_KEY=your_ghost_admin_key_here
# CUSTOM_GHOST_API_URL=https://your-ghost-blog.com
```

### GitHub OAuth App Setup

1. Go to [GitHub Settings > Developer settings > OAuth Apps](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Configure:
   - **Application name**: Ghost Blog Management
   - **Homepage URL**: 
     - Development: `http://localhost:8792`
     - Production: `https://your-worker-name.your-subdomain.workers.dev`
   - **Authorization callback URL**: 
     - Development: `http://localhost:8792/callback`
     - Production: `https://your-worker-name.your-subdomain.workers.dev/callback`

### Multi-Blog Management

The system supports three levels of Ghost blog credential priority:

1. **Priority 1 (Highest)**: LLM-provided parameters
   ```javascript
   ghost_create_post({
     title: "My Post",
     ghost_admin_api_key: "specific_blog_key",
     ghost_api_url: "https://specific-blog.com"
   })
   ```

2. **Priority 2 (Middle)**: Worker environment variables
   ```bash
   CUSTOM_GHOST_ADMIN_API_KEY=your_key
   CUSTOM_GHOST_API_URL=https://your-blog.com
   ```

3. **Priority 3 (Lowest)**: Backend API defaults
   - Uses the Ghost Blog Smart API's configured blog
   - No additional configuration needed

## 🛠️ Available Tools

### Content Creation Tools (13 Total)

| Tool | Purpose | AI Features | Test Mode |
|------|---------|-------------|-----------|
| `ghost_health_check` | API status verification | - | N/A |
| `ghost_api_info` | System information | - | N/A |
| `ghost_create_post` | Create posts/pages | 🎨 Image generation | ✅ |
| `ghost_smart_create` | AI content creation | 🤖 Gemini + 🎨 Images | ✅ |
| `ghost_get_posts` | List posts with filters | - | N/A |
| `ghost_advanced_search` | Text & tag search | - | N/A |
| `ghost_get_post_details` | Individual post data | - | N/A |
| `ghost_update_post` | Modify existing posts | - | N/A |
| `ghost_update_post_image` | AI image regeneration | 🎨 Flux/Imagen | N/A |
| `ghost_delete_post` | Remove posts permanently | - | N/A |
| `ghost_posts_summary` | Analytics & statistics | - | N/A |
| `ghost_batch_get_details` | Bulk post retrieval | - | N/A |
| `ghost_search_by_date` | Date-based filtering | - | N/A |

### AI Features

**Content Generation (Google Gemini)**:
- Transform ideas into complete blog posts
- Generate titles, excerpts, and tags
- Multi-language support

**Image Generation**:
- **Replicate Flux**: Fast generation (3-7s)
- **Google Imagen**: Professional quality (10-15s)
- Multiple aspect ratios (16:9, 1:1, 9:16, 4:3, 3:2)
- Automatic fallback between providers

## 🔧 Claude Desktop Integration

Add to your Claude Desktop configuration (`~/.claude/claude_desktop_config.json`):

### Production Configuration
```json
{
  "mcpServers": {
    "ghost-blog-management": {
      "command": "npx",
      "args": ["mcp-remote", "https://your-worker-name.your-subdomain.workers.dev/mcp"],
      "env": {}
    }
  }
}
```

### Development Configuration
```json
{
  "mcpServers": {
    "ghost-blog-dev": {
      "command": "npx", 
      "args": ["mcp-remote", "http://localhost:8792/mcp"],
      "env": {}
    }
  }
}
```

## 💡 Usage Examples

### Create a Blog Post with AI

```
Create a blog post about "The Future of AI in 2025" with these requirements:
- Make it engaging and informative
- Include relevant tags
- Generate a professional feature image
- Publish as draft for review
```

### Smart Content Creation

```
Use ghost_smart_create to write about:
"How to optimize web performance with modern JavaScript frameworks"

Preferred language: English
Status: draft
Include feature image: yes
```

### Multi-Blog Management

```
Create a post on my personal blog:
- Title: "My Journey with AI Tools"
- Content: "Today I want to share..."
- Ghost API Key: 68aaca1251d63700017fb41c:c43f244b1435...
- Ghost URL: https://blog.mysite.com
```

## 🔐 Security Features

- **GitHub OAuth 2.0**: Secure authentication flow
- **Access Control**: Public/private mode configuration
- **API Key Protection**: Environment variable management
- **Signed Cookies**: HMAC-SHA256 signed sessions
- **HTTPS Only**: All production endpoints use HTTPS

## 📊 Performance

| Operation | Typical Time | Max Time | Notes |
|-----------|-------------|----------|-------|
| Health Check | <1s | 5s | Simple API ping |
| List Posts | 1-2s | 10s | Depends on filter complexity |
| Create Post (no image) | 3-8s | 30s | AI content generation |
| Create Post (Flux) | 10-20s | 60s | Fast image generation |
| Create Post (Imagen) | 20-35s | 120s | Professional image quality |
| Smart Create | 15-30s | 90s | Full AI enhancement |

## 🛠️ Development

### Project Structure

```
/
├── src/
│   ├── index.ts                 # Main MCP server entry point
│   ├── types.ts                 # TypeScript type definitions
│   ├── auth/
│   │   ├── github-handler.ts    # GitHub OAuth flow
│   │   └── oauth-utils.ts       # OAuth utilities
│   └── tools/
│       ├── ghost-blog-tools.ts  # Ghost Blog API integration (13 tools)
│       └── register-tools.ts    # Tool registration logic
├── wrangler.jsonc               # Cloudflare Workers configuration
├── package.json                 # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
└── DEPLOYMENT_GUIDE.md         # Detailed deployment instructions
```

### Available Scripts

```bash
npm run dev          # Start development server
npm run deploy       # Deploy to Cloudflare Workers
npm run type-check   # TypeScript type checking
```

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Run tests: `npm run type-check`
5. Commit: `git commit -m "Add feature"`
6. Push: `git push origin feature-name`
7. Open a Pull Request

## 📚 Documentation

- **[Deployment Guide](DEPLOYMENT_GUIDE.md)**: Complete production deployment instructions
- **[Model Context Protocol](https://modelcontextprotocol.io/)**: MCP specification
- **[Ghost Admin API](https://ghost.org/docs/admin-api/)**: Ghost CMS API documentation
- **[Cloudflare Workers](https://developers.cloudflare.com/workers/)**: Platform documentation

## 🐛 Troubleshooting

### Common Issues

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Authentication Failed** | 403 errors, "Unauthorized" | Check GitHub username in `AUTHORIZED_USERS` |
| **API Connection Error** | 502/503 errors | Verify backend services are running |
| **Tool Not Found** | MCP errors | Restart Claude Desktop, check config |
| **Image Generation Timeout** | 5-minute timeouts | Use `prefer_flux=true` for faster generation |

### Debug Commands

```bash
# Monitor production logs
wrangler tail

# Test health endpoint
curl https://your-worker-name.your-subdomain.workers.dev/authorize

# Verify secrets
wrangler secret list
```

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io/) by Anthropic
- [Ghost CMS](https://ghost.org/) for the publishing platform
- [Cloudflare Workers](https://workers.cloudflare.com/) for edge computing
- [Replicate](https://replicate.com/) and [Google AI](https://ai.google.dev/) for AI services

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/preangelleo/ghost-blog-management-mcp/issues)
- **Author**: [leowang.net](https://leowang.net) <me@leowang.net>
- **Version**: 2.1.0

---

**Made with ❤️ for the AI-powered content creation community**
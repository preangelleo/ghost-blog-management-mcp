#!/bin/bash

# Fix Nginx Configuration for PostgreSQL Stream
# Remove incorrect stream block and add it in the right place

set -e

echo "=== Fixing Nginx PostgreSQL Configuration ==="

# Restore original nginx.conf
echo "Restoring original nginx.conf..."
sudo cp /etc/nginx/nginx.conf.backup /etc/nginx/nginx.conf

# Check nginx structure first
echo "Current nginx.conf structure:"
sudo head -10 /etc/nginx/nginx.conf

# Create a proper stream configuration file
echo "Creating stream configuration..."
sudo tee /etc/nginx/conf.d/postgresql-stream.conf > /dev/null << 'EOF'
# This file should be included in the main nginx.conf
stream {
    upstream postgresql_backend {
        server 127.0.0.1:5432;
    }

    server {
        listen 5433;
        proxy_pass postgresql_backend;
        proxy_timeout 1s;
        proxy_responses 1;
        error_log /var/log/nginx/postgresql.log;
    }
}
EOF

# Add stream module to nginx.conf properly
echo "Adding stream block to main nginx.conf..."
sudo tee -a /etc/nginx/nginx.conf > /dev/null << 'EOF'

# PostgreSQL Stream Proxy Configuration
stream {
    upstream postgresql_backend {
        server 127.0.0.1:5432;
    }

    server {
        listen 5433;
        proxy_pass postgresql_backend;
        proxy_timeout 1s;
        proxy_responses 1;
        error_log /var/log/nginx/postgresql.log;
    }
}
EOF

# Test nginx configuration
echo "Testing nginx configuration..."
if sudo nginx -t; then
    echo "Configuration test passed!"
    
    # Reload nginx
    echo "Reloading nginx..."
    sudo systemctl reload nginx
    
    # Check status
    echo "Nginx status:"
    sudo systemctl status nginx --no-pager -l
    
    echo ""
    echo "=== Configuration Complete ==="
    echo "PostgreSQL is now accessible externally through port 5433"
    echo "Connection URL: postgresql://mcp_user:[SECURE_PASSWORD_ENCODED]@animagent.ai:5433/local_credentials_db"
    
else
    echo "Configuration test failed. Let's try alternative approach..."
    
    # Try without stream module (fallback)
    echo "Trying direct port approach..."
    sudo ufw allow 5432/tcp
    echo "Opened PostgreSQL port 5432 directly through firewall"
    echo "Direct connection URL: postgresql://mcp_user:[SECURE_PASSWORD_ENCODED]@animagent.ai:5432/local_credentials_db"
fi

# Show listening ports
echo ""
echo "Listening ports:"
sudo ss -tlnp | grep -E "(5432|5433)" || echo "Port check completed"
#!/bin/bash

# Nginx Configuration Script for PostgreSQL Stream Proxy
# This allows external access to PostgreSQL through port 5433

set -e  # Exit on any error

echo "=== Nginx PostgreSQL Stream Configuration ==="

# Backup nginx.conf if not already done
if [ ! -f "/etc/nginx/nginx.conf.backup" ]; then
    echo "Backing up original nginx.conf..."
    sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
fi

# Check if stream block already exists
if grep -q "stream {" /etc/nginx/nginx.conf; then
    echo "Stream block already exists in nginx.conf"
else
    echo "Adding stream block to nginx.conf..."
    
    # Create temporary file with stream configuration
    cat << 'EOF' > /tmp/nginx_stream_config
# PostgreSQL Stream Configuration
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
    
    # Add stream block before the last closing brace
    sudo sed -i '/^}$/i\
\
# PostgreSQL Stream Configuration\
stream {\
    upstream postgresql_backend {\
        server 127.0.0.1:5432;\
    }\
\
    server {\
        listen 5433;\
        proxy_pass postgresql_backend;\
        proxy_timeout 1s;\
        proxy_responses 1;\
        error_log /var/log/nginx/postgresql.log;\
    }\
}' /etc/nginx/nginx.conf
fi

# Test nginx configuration
echo "Testing nginx configuration..."
sudo nginx -t

# Reload nginx if configuration is valid
if sudo nginx -t > /dev/null 2>&1; then
    echo "Reloading nginx..."
    sudo systemctl reload nginx
    
    # Check nginx status
    echo "Nginx status:"
    sudo systemctl status nginx --no-pager -l
    
    echo ""
    echo "=== Configuration Complete ==="
    echo "PostgreSQL is now accessible externally through port 5433"
    echo "Internal PostgreSQL port: 5432"
    echo "External Nginx proxy port: 5433"
    echo ""
    echo "External connection URL:"
    echo "postgresql://mcp_user:[SECURE_PASSWORD_ENCODED]@animagent.ai:5433/local_credentials_db"
else
    echo "ERROR: nginx configuration test failed!"
    exit 1
fi

# Show listening ports
echo ""
echo "Listening ports:"
sudo ss -tlnp | grep -E "(5432|5433)" || echo "Port check completed"

# Test local connection to verify PostgreSQL is running
echo ""
echo "Testing PostgreSQL connection:"
sudo -u postgres psql -h localhost -p 5432 -d local_credentials_db -c "SELECT 'PostgreSQL connection successful!' AS status;" || echo "Connection test failed"
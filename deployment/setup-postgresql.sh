#!/bin/bash

# PostgreSQL Installation and Configuration Script for Ubuntu
# This script installs PostgreSQL, creates a database, user, and configures it for external access

set -e  # Exit on any error

echo "=== PostgreSQL Installation and Setup ==="

# Update package list
echo "Updating package list..."
sudo apt update

# Install PostgreSQL
echo "Installing PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL service
echo "Starting PostgreSQL service..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
echo "Creating database and user..."
sudo -u postgres psql << 'EOF'
-- Create database
CREATE DATABASE local_credentials_db;

-- Create user with strong password
CREATE USER mcp_user WITH PASSWORD '[SECURE_PASSWORD_CONFIGURED]';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE local_credentials_db TO mcp_user;

-- Grant schema privileges
\c local_credentials_db;
GRANT ALL ON SCHEMA public TO mcp_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mcp_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mcp_user;

-- Create the local_credentials table
CREATE TABLE IF NOT EXISTS local_credentials (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Grant table permissions specifically
GRANT ALL PRIVILEGES ON TABLE local_credentials TO mcp_user;
GRANT USAGE, SELECT ON SEQUENCE local_credentials_id_seq TO mcp_user;

-- Create an update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_local_credentials_updated_at 
    BEFORE UPDATE ON local_credentials 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Show created tables
\dt

-- Show table structure
\d local_credentials;
EOF

# Configure PostgreSQL for external access
echo "Configuring PostgreSQL for external access..."

# Find PostgreSQL version and configuration directory
PG_VERSION=$(sudo -u postgres psql -t -c "SELECT version();" | grep -oP '\d+\.\d+' | head -1)
PG_CONFIG_DIR="/etc/postgresql/$PG_VERSION/main"

echo "PostgreSQL version: $PG_VERSION"
echo "Configuration directory: $PG_CONFIG_DIR"

# Backup original configuration files
sudo cp "$PG_CONFIG_DIR/postgresql.conf" "$PG_CONFIG_DIR/postgresql.conf.backup"
sudo cp "$PG_CONFIG_DIR/pg_hba.conf" "$PG_CONFIG_DIR/pg_hba.conf.backup"

# Configure postgresql.conf for external connections
echo "Updating postgresql.conf..."
sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" "$PG_CONFIG_DIR/postgresql.conf"
sudo sed -i "s/#port = 5432/port = 5432/" "$PG_CONFIG_DIR/postgresql.conf"

# Configure pg_hba.conf for authentication
echo "Updating pg_hba.conf..."
# Add entry for external connections with password authentication
echo "host    local_credentials_db    mcp_user    0.0.0.0/0    md5" | sudo tee -a "$PG_CONFIG_DIR/pg_hba.conf"

# Restart PostgreSQL to apply changes
echo "Restarting PostgreSQL..."
sudo systemctl restart postgresql

# Check PostgreSQL status
echo "PostgreSQL status:"
sudo systemctl status postgresql --no-pager -l

# Test database connection
echo "Testing database connection..."
sudo -u postgres psql -d local_credentials_db -c "SELECT 'Database connection successful!' AS status;"

# Show connection info
echo ""
echo "=== Database Connection Information ==="
echo "Database: local_credentials_db"
echo "Username: mcp_user"
echo "Password: [SECURE_PASSWORD_CONFIGURED]"
echo "Host: localhost (or animagent.ai externally)"
echo "Port: 5432"
echo "Connection URL: postgresql://mcp_user:[SECURE_PASSWORD_ENCODED]@animagent.ai:5432/local_credentials_db"
echo ""
echo "=== Table Information ==="
sudo -u postgres psql -d local_credentials_db -c "\d local_credentials;"
echo ""
echo "=== Setup Complete ==="
echo "PostgreSQL has been installed and configured successfully!"
echo "The local_credentials table has been created with the required columns."
echo "External access is now enabled on port 5432."
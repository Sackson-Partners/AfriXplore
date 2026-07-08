#!/bin/bash

##
# Security Audit Script
# Runs comprehensive security checks on the AIN Platform codebase
##

set -e

echo "=================================="
echo "🔒 Security Audit - AIN Platform"
echo "=================================="
echo ""

# Color output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Function to report error
error() {
  echo -e "${RED}❌ ERROR: $1${NC}"
  ERRORS=$((ERRORS + 1))
}

# Function to report warning
warning() {
  echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
  WARNINGS=$((WARNINGS + 1))
}

# Function to report success
success() {
  echo -e "${GREEN}✅ $1${NC}"
}

echo "1. Checking for dependency vulnerabilities..."
echo "   Running pnpm audit..."

if pnpm audit --audit-level=high > /tmp/audit-output.txt 2>&1; then
  success "No high or critical vulnerabilities found"
else
  AUDIT_EXIT=$?
  if [ $AUDIT_EXIT -eq 1 ]; then
    error "High or critical vulnerabilities detected"
    cat /tmp/audit-output.txt
  fi
fi
echo ""

echo "2. Checking for hardcoded secrets..."
echo "   Scanning for common secret patterns..."

# Check for hardcoded API keys, tokens, passwords
SECRET_PATTERNS=(
  "password\s*=\s*['\"][^'\"]{8,}"
  "api[_-]?key\s*=\s*['\"][^'\"]{16,}"
  "secret\s*=\s*['\"][^'\"]{16,}"
  "token\s*=\s*['\"][^'\"]{16,}"
  "AKIA[0-9A-Z]{16}" # AWS Access Key
  "AIza[0-9A-Za-z\\-_]{35}" # Google API Key
  "sk-[a-zA-Z0-9]{20,}" # OpenAI API Key
  "ghp_[a-zA-Z0-9]{36}" # GitHub Personal Access Token
)

SECRETS_FOUND=0
for pattern in "${SECRET_PATTERNS[@]}"; do
  if grep -rE "$pattern" apps/ services/ packages/ --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude="*.md" 2>/dev/null; then
    SECRETS_FOUND=1
  fi
done

if [ $SECRETS_FOUND -eq 1 ]; then
  error "Potential hardcoded secrets detected. Review matches above."
else
  success "No hardcoded secrets detected"
fi
echo ""

echo "3. Checking environment variable configuration..."

# Check if .env files are gitignored
if grep -q "^\.env" .gitignore 2>/dev/null; then
  success ".env files are properly gitignored"
else
  error ".env not found in .gitignore - sensitive data could be committed"
fi

# Check for .env files in git history
if git log --all --full-history -- "*.env" 2>/dev/null | grep -q "commit"; then
  warning ".env files found in git history - secrets may have been committed"
else
  success "No .env files in git history"
fi
echo ""

echo "4. Checking HTTPS enforcement..."

# Check Next.js config for security headers
NEXTJS_CONFIGS=(
  "apps/platform-web/next.config.mjs"
  "apps/admin-web/next.config.mjs"
  "apps/geoswarm-web/next.config.mjs"
)

for config in "${NEXTJS_CONFIGS[@]}"; do
  if [ -f "$config" ]; then
    if grep -q "Content-Security-Policy" "$config"; then
      success "CSP headers configured in $config"
    else
      warning "CSP headers missing in $config"
    fi
  fi
done
echo ""

echo "5. Checking for HTTP usage in production..."

# Check for http:// URLs (excluding localhost)
if grep -rE "http://(?!localhost|127\.0\.0\.1)" apps/ services/ --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude="*.md" --exclude="*.test.*" 2>/dev/null | grep -v "http://www.w3.org" | grep -v "http://schemas." | head -5; then
  warning "HTTP URLs detected (should use HTTPS in production)"
else
  success "No HTTP URLs detected (excluding localhost)"
fi
echo ""

echo "6. Checking authentication configuration..."

# Check for DEV_BYPASS_AUTH in production configs
if grep -r "DEV_BYPASS_AUTH" .github/workflows/*.yml 2>/dev/null | grep -i "production"; then
  error "DEV_BYPASS_AUTH found in production workflows"
else
  success "No DEV_BYPASS_AUTH in production workflows"
fi

# Check for proper JWT secret configuration
if grep -rE "JWT_SECRET\s*=\s*['\"][^'\"]{8,}" apps/ services/ --exclude-dir=node_modules 2>/dev/null; then
  error "Hardcoded JWT_SECRET detected"
else
  success "No hardcoded JWT secrets"
fi
echo ""

echo "7. Checking database security..."

# Check for SQL injection vulnerabilities (looking for string concatenation in queries)
if grep -rE "\`.*\$\{.*\}.*\`.*query|query.*\`.*\$\{.*\}.*\`" services/ packages/database --exclude-dir=node_modules --exclude="*.test.*" 2>/dev/null | head -5; then
  warning "Potential SQL injection risk - using template literals in queries"
  echo "   Use parameterized queries instead"
else
  success "No obvious SQL injection patterns detected"
fi

# Check for connection string in code
if grep -rE "postgresql://[^'\"\s]+" apps/ services/ packages/ --exclude-dir=node_modules --exclude="*.md" --exclude="*.example" 2>/dev/null; then
  error "Hardcoded database connection strings detected"
else
  success "No hardcoded database connection strings"
fi
echo ""

echo "8. Checking CORS configuration..."

# Check for overly permissive CORS
if grep -rE "origin:\s*['\"]?\*['\"]?" services/ --exclude-dir=node_modules 2>/dev/null; then
  error "Wildcard CORS origin detected - allows any domain"
else
  success "No wildcard CORS configuration"
fi

# Check for credentials: true with wildcard origin
if grep -B5 -A5 "credentials:\s*true" services/ --exclude-dir=node_modules 2>/dev/null | grep -E "origin:\s*['\"]?\*"; then
  error "CORS credentials enabled with wildcard origin (security risk)"
fi
echo ""

echo "9. Checking rate limiting configuration..."

# Check if rate limiting is enabled
RATE_LIMIT_FILES=$(find services/ -name "*.ts" -exec grep -l "rateLimit\|rate-limit" {} \; 2>/dev/null | wc -l)
if [ "$RATE_LIMIT_FILES" -gt 0 ]; then
  success "Rate limiting configured in $RATE_LIMIT_FILES files"
else
  warning "No rate limiting configuration detected"
fi
echo ""

echo "10. Checking file permissions..."

# Check for overly permissive file permissions
if find . -type f -perm -002 ! -path "*/node_modules/*" ! -path "*/.git/*" 2>/dev/null | head -5 | grep -q .; then
  warning "World-writable files detected"
else
  success "No world-writable files"
fi

# Check for executable scripts
EXECUTABLE_SCRIPTS=$(find scripts/ -type f -name "*.sh" 2>/dev/null | wc -l)
if [ "$EXECUTABLE_SCRIPTS" -gt 0 ]; then
  success "$EXECUTABLE_SCRIPTS shell scripts found in scripts/"
fi
echo ""

echo "11. Checking TypeScript configuration..."

# Check for strict mode
if grep -r "\"strict\":\s*true" tsconfig*.json 2>/dev/null | grep -v node_modules | head -1; then
  success "TypeScript strict mode enabled"
else
  warning "TypeScript strict mode not enabled"
fi
echo ""

echo "=================================="
echo "📊 Security Audit Summary"
echo "=================================="
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✅ All security checks passed!${NC}"
  echo ""
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}⚠️  $WARNINGS warnings found${NC}"
  echo ""
  echo "Review warnings and consider addressing them before production deployment."
  exit 0
else
  echo -e "${RED}❌ $ERRORS errors and $WARNINGS warnings found${NC}"
  echo ""
  echo "Critical security issues must be resolved before production deployment."
  exit 1
fi

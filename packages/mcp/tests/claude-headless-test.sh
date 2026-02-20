#!/bin/bash
#
# Claude Code Headless Mode Live Tests for Ariadne MCP Server
#
# This script tests the MCP server using Claude Code in headless mode (claude -p).
# It validates the real user experience rather than just programmatic MCP client behavior.
#
# Prerequisites:
#   - Claude Code CLI installed (claude command available)
#   - ANTHROPIC_API_KEY set in environment
#   - MCP package built (npm run build in packages/mcp)
#
# Usage:
#   ./claude-headless-test.sh [--verbose]
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
MCP_CONFIG="$SCRIPT_DIR/mcp-test-config.json"
LOG_FILE="$SCRIPT_DIR/logs.txt"

VERBOSE=false
if [[ "$1" == "--verbose" ]]; then
    VERBOSE=true
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_verbose() {
    if $VERBOSE; then
        echo -e "[DEBUG] $1"
    fi
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Clear log file at start
    : > "$LOG_FILE"
    log_verbose "Log file: $LOG_FILE"

    # Check claude CLI
    if ! command -v claude &> /dev/null; then
        log_error "Claude Code CLI not found. Install it first."
        exit 1
    fi
    log_verbose "Claude CLI found: $(which claude)"

    # Check API key
    if [[ -z "${ANTHROPIC_API_KEY}" ]]; then
        log_warn "ANTHROPIC_API_KEY not set. Claude will use its configured key."
    fi

    # Check MCP config exists
    if [[ ! -f "$MCP_CONFIG" ]]; then
        log_error "MCP config not found at: $MCP_CONFIG"
        exit 1
    fi
    log_verbose "MCP config found: $MCP_CONFIG"

    # Check MCP server is built
    if [[ ! -f "$PROJECT_ROOT/packages/mcp/dist/server.js" ]]; then
        log_error "MCP server not built. Run 'npm run build' in packages/mcp first."
        exit 1
    fi
    log_verbose "MCP server built: $PROJECT_ROOT/packages/mcp/dist/server.js"

    # Check fixtures exist
    if [[ ! -d "$PROJECT_ROOT/packages/core/tests/fixtures/typescript/code" ]]; then
        log_error "Test fixtures not found at: $PROJECT_ROOT/packages/core/tests/fixtures/typescript/code"
        exit 1
    fi
    log_verbose "Fixtures found: $PROJECT_ROOT/packages/core/tests/fixtures/typescript/code"

    log_info "All prerequisites met."
}

# Test 1: Basic tool discovery
test_tool_discovery() {
    log_info "Test 1: Tool Discovery"
    log_info "Checking if Claude can see the list_entrypoints tool..."

    cd "$PROJECT_ROOT"

    local output
    echo "=== Test 1: Tool Discovery ===" >> "$LOG_FILE"
    output=$(claude -p "What MCP tools do you have available? Just list them briefly." \
        --mcp-config "$MCP_CONFIG" \
        --output-format json \
        --no-session-persistence \
        --allowedTools "mcp__ariadne__list_entrypoints" \
        --debug mcp \
        2>> "$LOG_FILE") || true

    echo "Response: $output" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
    log_verbose "Raw output: $output"

    if echo "$output" | grep -qi "list_entrypoints"; then
        log_info "PASS: Tool 'list_entrypoints' discovered"
        return 0
    else
        log_error "FAIL: Tool 'list_entrypoints' not found in output"
        echo "Output was:"
        echo "$output"
        return 1
    fi
}

# Test 2: Tool invocation on fixtures
test_tool_invocation() {
    log_info "Test 2: Tool Invocation"
    log_info "Running list_entrypoints on fixture code..."

    cd "$PROJECT_ROOT"

    local output
    echo "=== Test 2: Tool Invocation ===" >> "$LOG_FILE"
    output=$(claude -p "Use the list_entrypoints tool to analyze the codebase. Show me the results." \
        --mcp-config "$MCP_CONFIG" \
        --output-format json \
        --no-session-persistence \
        --allowedTools "mcp__ariadne__list_entrypoints" \
        --debug mcp \
        2>> "$LOG_FILE") || true

    echo "Response: $output" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
    log_verbose "Raw output: $output"

    # Check for expected output patterns
    local passed=true

    if echo "$output" | grep -qi "entry point"; then
        log_info "  - Found 'entry point' in output"
    else
        log_warn "  - Missing 'entry point' pattern"
        passed=false
    fi

    if $passed; then
        log_info "PASS: Tool invocation succeeded"
        return 0
    else
        log_error "FAIL: Tool invocation did not produce expected output"
        echo "Output was:"
        echo "$output"
        return 1
    fi
}

# Test 3: Filtered analysis (folder parameter)
test_filtered_analysis() {
    log_info "Test 3: Filtered Analysis"
    log_info "Testing file/folder filtering parameters..."

    cd "$PROJECT_ROOT"

    local output
    echo "=== Test 3: Filtered Analysis ===" >> "$LOG_FILE"
    output=$(claude -p "Use list_entrypoints with folders parameter set to ['functions'] to analyze only the functions subfolder." \
        --mcp-config "$MCP_CONFIG" \
        --output-format json \
        --no-session-persistence \
        --allowedTools "mcp__ariadne__list_entrypoints" \
        --debug mcp \
        2>> "$LOG_FILE") || true

    echo "Response: $output" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
    log_verbose "Raw output: $output"

    # This test is more about verifying the parameter is accepted
    if echo "$output" | grep -qiE "(entry point|function|no entry)"; then
        log_info "PASS: Filtered analysis completed"
        return 0
    else
        log_error "FAIL: Filtered analysis did not produce expected output"
        echo "Output was:"
        echo "$output"
        return 1
    fi
}

# Test 4: show_call_graph_neighborhood tool discovery
test_neighborhood_discovery() {
    log_info "Test 4: Neighborhood Tool Discovery"
    log_info "Checking if Claude can see the show_call_graph_neighborhood tool..."

    cd "$PROJECT_ROOT"

    local output
    echo "=== Test 4: Neighborhood Tool Discovery ===" >> "$LOG_FILE"
    output=$(claude -p "What MCP tools do you have available? Just list them briefly." \
        --mcp-config "$MCP_CONFIG" \
        --output-format json \
        --no-session-persistence \
        --allowedTools "mcp__ariadne__show_call_graph_neighborhood" \
        --debug mcp \
        2>> "$LOG_FILE") || true

    echo "Response: $output" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
    log_verbose "Raw output: $output"

    if echo "$output" | grep -qi "show_call_graph_neighborhood"; then
        log_info "PASS: Tool 'show_call_graph_neighborhood' discovered"
        return 0
    else
        log_error "FAIL: Tool 'show_call_graph_neighborhood' not found in output"
        echo "Output was:"
        echo "$output"
        return 1
    fi
}

# Test 5: show_call_graph_neighborhood basic invocation
test_neighborhood_invocation() {
    log_info "Test 5: Neighborhood Tool Invocation"
    log_info "Running show_call_graph_neighborhood on fixture code..."

    cd "$PROJECT_ROOT"

    local output
    echo "=== Test 5: Neighborhood Tool Invocation ===" >> "$LOG_FILE"
    output=$(claude -p "Use the show_call_graph_neighborhood tool with symbol_ref 'integration/constructor_method_chain.ts:12#get_name' to show the call graph neighborhood." \
        --mcp-config "$MCP_CONFIG" \
        --output-format json \
        --no-session-persistence \
        --allowedTools "mcp__ariadne__show_call_graph_neighborhood" \
        --debug mcp \
        2>> "$LOG_FILE") || true

    echo "Response: $output" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
    log_verbose "Raw output: $output"

    # Check for expected output patterns
    if echo "$output" | grep -qiE "(call graph|get_name|callers|callees)"; then
        log_info "PASS: Neighborhood tool invocation succeeded"
        return 0
    else
        log_error "FAIL: Neighborhood tool invocation did not produce expected output"
        echo "Output was:"
        echo "$output"
        return 1
    fi
}

# Test 6: show_call_graph_neighborhood with depth parameters
test_neighborhood_with_depth() {
    log_info "Test 6: Neighborhood Tool with Depth Parameters"
    log_info "Testing callers_depth parameter on nested call chain..."

    cd "$PROJECT_ROOT"

    local output
    echo "=== Test 6: Neighborhood Tool with Depth ===" >> "$LOG_FILE"
    output=$(claude -p "Use the show_call_graph_neighborhood tool with symbol_ref 'integration/nested_scopes.ts:18#inner_function' and callers_depth set to 1 to show only immediate callers." \
        --mcp-config "$MCP_CONFIG" \
        --output-format json \
        --no-session-persistence \
        --allowedTools "mcp__ariadne__show_call_graph_neighborhood" \
        --debug mcp \
        2>> "$LOG_FILE") || true

    echo "Response: $output" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
    log_verbose "Raw output: $output"

    # Check for expected output patterns
    if echo "$output" | grep -qiE "(callers|outer_function|1 level|call graph)"; then
        log_info "PASS: Neighborhood tool with depth parameters succeeded"
        return 0
    else
        log_error "FAIL: Neighborhood tool with depth parameters did not produce expected output"
        echo "Output was:"
        echo "$output"
        return 1
    fi
}

# Run all tests
run_tests() {
    local total=0
    local passed=0
    local failed=0

    echo ""
    echo "========================================"
    echo " Ariadne MCP - Claude Headless Tests"
    echo "========================================"
    echo ""

    check_prerequisites
    echo ""

    # Test 1
    ((total++))
    if test_tool_discovery; then
        ((passed++))
    else
        ((failed++))
    fi
    echo ""

    # Test 2
    ((total++))
    if test_tool_invocation; then
        ((passed++))
    else
        ((failed++))
    fi
    echo ""

    # Test 3
    ((total++))
    if test_filtered_analysis; then
        ((passed++))
    else
        ((failed++))
    fi
    echo ""

    # Test 4
    ((total++))
    if test_neighborhood_discovery; then
        ((passed++))
    else
        ((failed++))
    fi
    echo ""

    # Test 5
    ((total++))
    if test_neighborhood_invocation; then
        ((passed++))
    else
        ((failed++))
    fi
    echo ""

    # Test 6
    ((total++))
    if test_neighborhood_with_depth; then
        ((passed++))
    else
        ((failed++))
    fi
    echo ""

    # Summary
    echo "========================================"
    echo " Test Summary"
    echo "========================================"
    echo "Total:  $total"
    echo -e "Passed: ${GREEN}$passed${NC}"
    if [[ $failed -gt 0 ]]; then
        echo -e "Failed: ${RED}$failed${NC}"
    else
        echo "Failed: $failed"
    fi
    echo ""

    log_info "Logs written to: $LOG_FILE"

    if [[ $failed -eq 0 ]]; then
        log_info "All tests passed!"
        exit 0
    else
        log_error "Some tests failed."
        exit 1
    fi
}

# Main
run_tests

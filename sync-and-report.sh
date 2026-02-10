#!/bin/bash
# Renault Preisdaten Sync & Report
# Lädt täglich die neuesten Dateien und sendet Vergleichsreport per Email

DATA_DIR="/Users/bot/Documents/renault-tool-v3/data"
REPORT_DIR="/Users/bot/Documents/renault-tool-v3/reports"
EMAIL="martin@s-a-z.com"

mkdir -p "$DATA_DIR" "$REPORT_DIR"

echo "$(date): Starting Renault sync..."

# Get list of files from SFTP
FILES=$(expect << 'EOF' 2>/dev/null
spawn sftp -P 2022 -o StrictHostKeyChecking=no renault@transfer.oe.parts
expect "password:"
send "MBLnamwhWwgpSd7\r"
expect "sftp>"
send "ls -1 TLDRAGP_*\r"
expect "sftp>"
send "quit\r"
expect eof
EOF
)

# Extract file names and sort
SORTED_FILES=$(echo "$FILES" | grep "TLDRAGP_" | grep -v "sftp>" | sort -r)
LATEST=$(echo "$SORTED_FILES" | head -1 | tr -d '\r')
PREVIOUS=$(echo "$SORTED_FILES" | head -2 | tail -1 | tr -d '\r')

echo "Latest: $LATEST"
echo "Previous: $PREVIOUS"

# Download latest if not exists
if [ ! -f "$DATA_DIR/$LATEST" ]; then
    echo "Downloading $LATEST..."
    expect << EOF 2>/dev/null
spawn sftp -P 2022 -o StrictHostKeyChecking=no renault@transfer.oe.parts
expect "password:"
send "MBLnamwhWwgpSd7\r"
expect "sftp>"
send "get $LATEST $DATA_DIR/$LATEST\r"
expect "sftp>"
send "quit\r"
expect eof
EOF
fi

# Download previous if not exists
if [ ! -f "$DATA_DIR/$PREVIOUS" ]; then
    echo "Downloading $PREVIOUS..."
    expect << EOF 2>/dev/null
spawn sftp -P 2022 -o StrictHostKeyChecking=no renault@transfer.oe.parts
expect "password:"
send "MBLnamwhWwgpSd7\r"
expect "sftp>"
send "get $PREVIOUS $DATA_DIR/$PREVIOUS\r"
expect "sftp>"
send "quit\r"
expect eof
EOF
fi

echo "Files ready. Running comparison..."

# Run comparison script
node /Users/bot/Documents/renault-tool-v3/compare.js "$DATA_DIR/$LATEST" "$DATA_DIR/$PREVIOUS" "$REPORT_DIR"

echo "$(date): Done!"

#!/bin/sh
# Пересобирает папку для-теста (самодостаточная копия для открытия с диска) из prototype/
set -e
cd "$(dirname "$0")/.."
D=для-теста; P=prototype
mkdir -p "$D/vendor/gridstack" "$D/vendor/anthropic"
cp $P/offer.html $P/spravochnik.html $P/kb-data.js $P/kb-ui.css $P/manager-2027.css $P/manager-2027.js $P/logo.png $P/ai-assistant.js $P/ai-assistant.css $P/kb-real.js "$D/"
cp $P/vendor/gridstack/* "$D/vendor/gridstack/"
cp $P/vendor/anthropic/* "$D/vendor/anthropic/"
cp backup/original/bitrix_cache/template_combined.css "$D/"
sed 's|{{LOGO}}|logo.png|' $P/claude-style.src.html > "$D/manager-claude.html"
sed 's|{{LOGO}}|logo.png|' $P/kp.src.html > "$D/kp.html"
sed 's|\.\./backup/original/bitrix_cache/template_combined\.css|template_combined.css|' $P/index.html > "$D/bitrix-layer.html"
echo "для-теста обновлена"

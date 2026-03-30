const fs = require('fs');

const oldSvg = '<div class="logo-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 55%; height: auto;"><path d="M6 4h6a5.5 5.5 0 0 1 0 11H6v7"></path><path d="M17 2l1.5 3.5L22 7l-3.5 1.5L17 12l-1.5-3.5L12 7l3.5-1.5z"></path></svg></div>';
const oldSvgSm = '<div class="logo-icon logo-icon-sm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 55%; height: auto;"><path d="M6 4h6a5.5 5.5 0 0 1 0 11H6v7"></path><path d="M17 2l1.5 3.5L22 7l-3.5 1.5L17 12l-1.5-3.5L12 7l3.5-1.5z"></path></svg></div>';

const newSvgNode = '<div class="logo-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 60%; height: auto;"><path d="M12 3a9 9 0 0 0 9 9 9 9 0 0 0-9 9 9 9 0 0 0-9-9 9 9 0 0 0 9-9Z"></path></svg></div>';
const newSvgSmNode = '<div class="logo-icon logo-icon-sm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 60%; height: auto;"><path d="M12 3a9 9 0 0 0 9 9 9 9 0 0 0-9 9 9 9 0 0 0-9-9 9 9 0 0 0 9-9Z"></path></svg></div>';

const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  if (content.includes(oldSvg)) {
    content = content.replaceAll(oldSvg, newSvgNode);
    changed = true;
  }
  if (content.includes(oldSvgSm)) {
    content = content.replaceAll(oldSvgSm, newSvgSmNode);
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
  }
}

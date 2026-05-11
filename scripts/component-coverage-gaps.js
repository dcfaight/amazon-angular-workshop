const fs = require('fs');
const path = require('path');

function getMissedLines(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const lineCountSection = html.split('<td class="line-count quiet">')[1];
  const lineCoverageSection = html.split('<td class="line-coverage quiet">')[1];
  if (!lineCountSection || !lineCoverageSection) return [];
  const lineNumbers = [...lineCountSection.matchAll(/<a name='L(\d+)'><\/a>/g)].map(m => Number(m[1]));
  const coverageStates = [...lineCoverageSection.matchAll(/<span class="cline-any (cline-[^"]+)">/g)].map(m => m[1]);
  const missed = [];
  const max = Math.min(lineNumbers.length, coverageStates.length);
  for (let i = 0; i < max; i++) {
    if (coverageStates[i] === 'cline-no') missed.push(lineNumbers[i]);
  }
  return missed;
}

const targets = [
  'coverage/amazon-angular-workshop/app/checkout/checkout.component.ts.html',
  'coverage/amazon-angular-workshop/app/order-history/order-history.component.ts.html',
];

for (const filePath of targets) {
  const missed = getMissedLines(filePath);
  const label = filePath.replace('coverage/amazon-angular-workshop/app/', '').replace('.html', '');
  console.log(label + ': missed lines = ' + (missed.length ? missed.join(', ') : 'none'));
}

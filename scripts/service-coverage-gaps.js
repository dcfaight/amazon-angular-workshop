const fs = require('fs');
const path = require('path');

const dir = path.join('coverage', 'amazon-angular-workshop', 'app', 'services');
const files = fs.readdirSync(dir).filter((name) => name.endsWith('.ts.html'));

for (const fileName of files) {
  const html = fs.readFileSync(path.join(dir, fileName), 'utf8');
  const lineCountSection = html.split('<td class="line-count quiet">')[1];
  const lineCoverageSection = html.split('<td class="line-coverage quiet">')[1];

  if (!lineCountSection || !lineCoverageSection) {
    continue;
  }

  const lineNumbers = [...lineCountSection.matchAll(/<a name='L(\d+)'><\/a>/g)].map((m) => Number(m[1]));
  const coverageStates = [...lineCoverageSection.matchAll(/<span class="cline-any (cline-[^"]+)">/g)].map((m) => m[1]);

  const max = Math.min(lineNumbers.length, coverageStates.length);
  const missed = [];

  for (let i = 0; i < max; i += 1) {
    if (coverageStates[i] === 'cline-no') {
      missed.push(lineNumbers[i]);
    }
  }

  if (missed.length) {
    console.log(`${fileName.replace('.html', '')}: ${missed.join(',')}`);
  }
}

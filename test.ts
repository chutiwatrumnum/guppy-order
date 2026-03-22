import fs from 'fs';

const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
for (let i = 1595; i < 1620; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}

for (let i = 2000; i < lines.length; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}

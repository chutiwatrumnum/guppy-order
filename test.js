const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');

for (let i = 1600; i < 1620; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}

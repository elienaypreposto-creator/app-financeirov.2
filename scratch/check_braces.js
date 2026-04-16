const fs = require('fs');

const content = fs.readFileSync('c:/Users/elien/OneDrive/Documentos/app-financeiro/src/app/(dashboard)/lancamentos/page.tsx', 'utf8');

function checkBalance(text) {
    let stack = [];
    let lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        for (let j = 0; j < line.length; j++) {
            let char = line[j];
            if (char === '{' || char === '(' || char === '[') {
                stack.push({ char, line: i + 1, col: j + 1 });
            } else if (char === '}' || char === ')' || char === ']') {
                if (stack.length === 0) {
                    console.log(`Unmatched ${char} at line ${i + 1}, col ${j + 1}`);
                } else {
                    let last = stack.pop();
                    if ((char === '}' && last.char !== '{') ||
                        (char === ')' && last.char !== '(') ||
                        (char === ']' && last.char !== '[')) {
                        console.log(`Mismatch: ${last.char} at L${last.line} with ${char} at L${i + 1}`);
                    }
                }
            }
        }
    }
    if (stack.length > 0) {
        console.log("Unclosed tokens:");
        stack.forEach(s => console.log(`${s.char} at line ${s.line}`));
    } else {
        console.log("All balanced!");
    }
}

checkBalance(content);

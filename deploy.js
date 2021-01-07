const { execSync } = require('child_process');
const path = require('path');

const thisFile = path.basename(process.argv[1]);
const basicExceptions = ['.DS_Store', 'package-*', '*.log', '.gitignore', '.git'];
const dirsExcept = {
    './client': basicExceptions,
    './server': basicExceptions,
    '.': [...basicExceptions, 'client', 'server', thisFile],
};

const deployables = [];

for (let dir in dirsExcept) {
    const excludedFiles = dirsExcept[dir].join(' -or -name ');
    const findFiles = `find ${dir} -maxdepth 1 -mindepth 1 -not \\( -name ${excludedFiles} \\)`;
    const foundFiles = execSync(findFiles, { encoding: 'utf-8' });

    foundFiles
        .match(/.+(?=\n)/g)
        .forEach(f => deployables.push(f));
}

const targetPath = process.argv[2] || '../nordeste';

deployables.forEach(d => execSync(`cp -r ${d} ${path.join(targetPath, path.dirname(d))}`))
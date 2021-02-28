const { execSync } = require('child_process');
const path = require('path');
const moment = require('./server/node_modules/moment');

const targetPath = process.argv[2] || '../nordeste';
const install = process.argv.includes('-i');
const thisFile = path.basename(process.argv[1]);

const cmd = command => execSync(command, { encoding: 'utf-8' });

const deployables = [];
const basicExceptions = ['build', 'node_modules', '.DS_Store', 'package-*', '*.log', '.gitignore', '.git'];
const dirsExcept = {
    './client': basicExceptions,
    './server': basicExceptions,
    '.': [...basicExceptions, 'client', 'server', thisFile],
};

for (let dir in dirsExcept) {
    const excludedFiles = dirsExcept[dir].join(' -or -name ');
    const foundFiles = cmd(`find ${dir} -maxdepth 1 -mindepth 1 -not \\( -name ${excludedFiles} \\)`);
    foundFiles.match(/.+(?=\n)/g).forEach(f => deployables.push(f));
}

deployables.forEach(d => cmd(`cp -r ${d} ${path.join(targetPath, path.dirname(d))}`))

const absoluteTarget = cmd(`(cd ${targetPath}; pwd)`).replace(/\n/g, '');
const serverFolder = path.join(absoluteTarget, 'server');
const clientFolder = path.join(absoluteTarget, 'client');

if (install) {
    cmd(`npm --prefix ${serverFolder} install`);
    cmd(`npm --prefix ${clientFolder} install`);
}
cmd(`npm --prefix ${clientFolder} run build`);
cmd(`(cd ${absoluteTarget}; git add .)`);
cmd(`(cd ${absoluteTarget}; git commit -m "deployed by script @ ${moment().format('YYYY-MM-DD HH:mm:ss Z')}")`);
cmd(`(cd ${absoluteTarget}; git push)`);

// npm known issue: https://github.com/npm/npm/issues/17322
cmd(`rm -rf ${path.join(serverFolder, 'server')}`);
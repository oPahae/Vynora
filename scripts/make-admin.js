// Promeut (ou retrograde) un compte administrateur depuis la ligne de commande.
//   npm run make-admin -- email@exemple.com
//   npm run make-admin -- email@exemple.com --remove
//   npm run make-admin -- admin@admin.com --create "MotDePasse123!"   (cree le compte, deja verifie)
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// Lecture minimale du fichier .env (aucune dependance supplementaire).
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((line) => {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
      if (!match || line.trim().startsWith('#')) return;
      if (process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    });
}
loadEnv(path.join(__dirname, '..', '.env.local'));
loadEnv(path.join(__dirname, '..', '.env'));

async function main() {
  const email = process.argv[2];
  const remove = process.argv.includes('--remove');
  if (!email || email.startsWith('--')) {
    console.error('Usage : npm run make-admin -- <email> [--remove]');
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  const createIndex = process.argv.indexOf('--create');
  if (createIndex !== -1) {
    const password = process.argv[createIndex + 1];
    if (!password || password.length < 8) {
      console.error('Precisez un mot de passe de 8 caracteres minimum : --create "MotDePasse123!"');
      process.exit(1);
    }
    const [existing] = await connection.execute('SELECT id FROM user WHERE email = ?', [email.toLowerCase()]);
    if (existing.length === 0) {
      const hash = await bcrypt.hash(password, 10);
      await connection.execute(
        "INSERT INTO user (firstName, lastName, email, emailVerifiedAt, password, gender, role) VALUES ('Admin', 'Systeme', ?, NOW(), ?, NULL, 'admin')",
        [email.toLowerCase(), hash]
      );
      await connection.end();
      console.log(`Compte administrateur cree : ${email} (mot de passe : celui fourni).`);
      return;
    }
    console.log('Ce compte existe deja : promotion en administrateur.');
  }

  const [result] = await connection.execute('UPDATE user SET role = ? WHERE email = ?', [remove ? 'user' : 'admin', email.toLowerCase()]);
  await connection.end();

  if (result.affectedRows === 0) {
    console.error(`Aucun compte avec l'email ${email}`);
    process.exit(1);
  }
  console.log(remove ? `${email} n'est plus administrateur.` : `${email} est maintenant administrateur.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

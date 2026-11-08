import mysql from 'mysql2/promise';

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      dateStrings: true
    });
  }

  return pool;
}

export async function query(sql, params = []) {
  const normalizedParams = params.map(value => {
    if (typeof value === 'number' && Number.isSafeInteger(value)) {
      return BigInt(value);
    }

    return value;
  });

  const [rows] = await getPool().execute(sql, normalizedParams);

  return rows;
}

export async function getConnection() {
  return getPool().getConnection();
}

export default getPool;
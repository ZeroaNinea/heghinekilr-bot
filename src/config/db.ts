import { Sequelize } from "@sequelize/core";
import { SqliteDialect } from "@sequelize/sqlite3";

const sequelize = new Sequelize({
  dialect: SqliteDialect,
  storage: "sequelize.sqlite",
});

async function connection() {
  try {
    await sequelize.authenticate();
    console.log(" ✅ The database connocted!");
  } catch (error) {
    console.error(" ❌ Unable to connect to the database:", error);
  }
}

export default connection;

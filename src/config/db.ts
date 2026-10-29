import { Sequelize } from "sequelize";
// import { SqliteDialect } from "@sequelize/sqlite3";
// import SQLite from "sqlite3";

// export const sequelize = new Sequelize({
//   dialect: SqliteDialect,
//   storage: "sequelize.sqlite",
//   // dialectOptions: {
//   //   mode: SQLite.OPEN_READWRITE | SQLite.OPEN_CREATE | SQLite.OPEN_FULLMUTEX,
//   // },
// });

export const sequelize = new Sequelize("", "", "", {
  dialect: "sqlite",
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

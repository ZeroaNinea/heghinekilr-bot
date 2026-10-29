import { Sequelize } from "sequelize";

export const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "sequelize.sqlite",
  logging: false,
});

export async function connection(): Promise<void> {
  await sequelize.authenticate();
  console.log("✅ Database connected!");
}

export default connection;

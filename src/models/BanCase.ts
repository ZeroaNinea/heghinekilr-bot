import { DataTypes, Model } from "sequelize";
import { sequelize } from "@/config/db.js";

class BanCase extends Model {
  declare id: number;
  declare guild_id: string;
  declare author_id: string;
  declare banned_username: string[];
  declare banned_id: string[];
  declare reason: string;
  declare server_urls: string[];
}

BanCase.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    guild_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    author_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    banned_username: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    banned_id: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    server_urls: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
  },
  {
    sequelize,
    modelName: "BanCase",
  },
);

export default BanCase;

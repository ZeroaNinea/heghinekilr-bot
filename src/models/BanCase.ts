import { DataTypes, Model } from "sequelize";
import { sequelize } from "@/config/db.js";

export interface IBanCase {
  id: number;
  guild_ids: string[];
  author_id: string;
  banned_usernames: string[];
  banned_ids: string[];
  reason: string;
  source_urls: string[];
}

class BanCase extends Model {
  declare id: number;
  declare guild_ids: string[];
  declare author_id: string;
  declare banned_usernames: string[];
  declare banned_ids: string[];
  declare reason: string;
  declare source_urls: string[];
}

BanCase.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    guild_ids: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    author_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    banned_usernames: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    banned_ids: {
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

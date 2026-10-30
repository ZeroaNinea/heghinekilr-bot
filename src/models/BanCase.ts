import { DataTypes, Model } from "sequelize";
import { sequelize } from "@/config/db.js";

class BanCase extends Model {
  declare id: number;
  declare guild_id: string;
  declare author_id: string;
  declare banned_username: string;
  declare banned_id: string;
  declare reason: string;
  declare attachments: string[];
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
      type: DataTypes.STRING,
      allowNull: false,
    },
    banned_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    attachments: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
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

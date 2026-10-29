import { DataTypes, Model } from "sequelize";
import { sequelize } from "@/config/db.js";

class BanMessage extends Model {
  declare id: number;
  declare guild_id: string;
  declare channel_id: string;
  declare message_id: string;
  declare author_id: string;
  declare user_id: string | null;
  declare message: string;
}

BanMessage.init(
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
    channel_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    message_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    author_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "BanMessage",
  },
);

export default BanMessage;

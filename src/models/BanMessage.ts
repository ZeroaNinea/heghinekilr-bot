import { DataTypes, Model } from "sequelize";
import { sequelize } from "@/config/db.js";

class BanMessage extends Model {
  declare guild_id: number;
  declare stuff_id: number;
  declare user_id: number | null;
  declare message: string;
}

BanMessage.init(
  {
    guild_id: {
      type: DataTypes.NUMBER,
      allowNull: false,
    },
    stuff_id: {
      type: DataTypes.NUMBER,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.NUMBER,
      allowNull: true,
    },
    message: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "BanMessage",
  },
);

export default BanMessage;

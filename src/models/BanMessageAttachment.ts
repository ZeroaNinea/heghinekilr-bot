import { DataTypes, Model } from "sequelize";
import { sequelize } from "@/config/db.js";

class BanMessageAttachment extends Model {
  declare id: number;
  declare message_id: string;
  declare attachment_id: string;
  declare filename: string;
  declare url: string;
  declare content_type: string | null;
  declare size: number;
}

BanMessageAttachment.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    message_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    attachment_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    filename: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    content_type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "BanMessageAttachment",
  },
);

export default BanMessageAttachment;

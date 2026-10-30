import { DataTypes, Model } from "sequelize";
import { sequelize } from "@/config/db.js";

class BanAttachment extends Model {
  declare id: number;
  declare case_id: string;
  declare attachment_id: string;
  declare filename: string;
  declare url: string;
  declare content_type: string | null;
  declare size: number;
}

BanAttachment.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    case_id: {
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
    modelName: "BanAttachment",
  },
);

export default BanAttachment;

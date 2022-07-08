import axios from "axios";
import dotenv from 'dotenv';

dotenv.config();

export const metaApi = axios.create({
  baseURL: "https://graph.facebook.com/v13.0",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${process.env.TOKEN}`,
  }
});

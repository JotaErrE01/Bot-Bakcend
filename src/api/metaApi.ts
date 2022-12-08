import axios from "axios";
// import dotenv from 'dotenv';

// dotenv.config();

// export const metaApi = axios.create({
//   baseURL: process.env.META_API,
//   headers: {
//     "Content-Type": "application/json",
//     "Authorization": `Bearer ${process.env.TOKEN}`,
//   }
// });

export const createApi = (token: string) => axios.create({
  baseURL: process.env.META_API,
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  }
});

// export default metaApi;


import dotenv from 'dotenv';
import Server from './models/Server';

// Leer variables de entorno
dotenv.config();

// Instanciar el servidor
const server = new Server();

server.listen();

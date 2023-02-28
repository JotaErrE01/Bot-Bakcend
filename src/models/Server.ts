import http from 'http';
import { Server as SocketServer } from 'socket.io';
import express, { Application } from 'express';
import { webHookRouter } from '../routes';
import { Sockets } from './Socket';

class Server {
  private app: Application;
  private port: number;
  private server: http.Server;
  private io: SocketServer;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '80');

    // http server
    this.server = http.createServer(this.app);

    // Configuraciones de sockets
    this.io = new SocketServer(this.server, {
      cors: {
        origin: '*',
      }
    });

    // this.middlewares();
    // this.routes();
  }

  middlewares() {
    // TODO: habilar cors with a whitelist of origins see udemy react course
    // this.app.use(cors({
    //   origin: '*',
    // }));

    // lectura del body
    this.app.use(express.json());
  }

  routes() {
    this.app.use('/api', (req, res, next) => {
      Object.assign(req, { io: this.io });
      webHookRouter(req, res, next);
    });
  }

  // Esta configuración se puede tener aquí o como propieda de clase
  // depende mucho de lo que necesites
  configurarSockets() {
    console.log('Configurando sockets');
    new Sockets(this.io);
  }

  execute() {
    // Inicializar Middlewares
    this.middlewares();

    this.routes(); // rutas de mi aplicación

    // Inicializar sockets
    this.configurarSockets();

    // Inicializar Server
    this.server.listen(this.port, () => {
      console.log(`🚀 Server running on port ${this.port} 🚀`);
    });
  }
}

export default Server;

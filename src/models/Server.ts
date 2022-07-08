import express, { Application } from 'express';
import cors from 'cors';
import { webHookRouter } from '../routes';

class Server {
  private app: Application;
  private port: string;

  constructor() {
    this.app = express();
    this.port = process.env.PORT || '3000';
    this.middlewares();
    this.routes();
  }

  middlewares() {
    // habilitar el cors
    this.app.use(cors({
      origin: '*',
    }));

    // lectura del body
    this.app.use(express.json());
  }

  routes() {
    this.app.use('/', webHookRouter);
  }

  listen() {
    this.app.listen(this.port, () => {
      console.log(`Server running on port ${this.port}`);
    })
  }

}

export default Server;

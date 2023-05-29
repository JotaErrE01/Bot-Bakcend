import { Request, Response } from 'express';
import { Server, Server as SocketServer } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';


export const createSocketEvent = async (req: Request, res: Response) => {
  const io: SocketServer<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any> = (req as any).io;
  if(!io) return res.status(500).json({ msg: 'Error en el servidor' });
  if(!req.body) return res.status(400).json({ msg: 'Faltan datos' });

  const { eventName, data, room } = req.body;

  if (room) {
    io.to(room).emit(eventName, data);
  } else {
    io.emit(eventName, data);
  }

  return res.status(200).json({ msg: 'Evento creado' });
}

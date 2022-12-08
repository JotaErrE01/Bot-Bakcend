import socketio from 'socket.io';

export class Sockets {
  private io: socketio.Server;

  constructor(io: socketio.Server) {
    this.io = io;
    this.socketEvents();
  }

  socketEvents() {
    // On connection
    this.io.on('connection', (socket) => {
      const uid = socket.handshake.query['uid'];
      const empresaId = socket.handshake.query['empresaId'];
      console.log({uid: socket.handshake.query['uid']});
      console.log({empresaId: socket.handshake.query['empresaId']});
      // console.log('client conected');
      // don't delete this if you want to use the socket in the routes and send events onlly to the client that made the request
      // socket.broadcast.emit('message', false);

      // sala global de la empresa
      socket.join(empresaId!.toString());

      // console.log({uid});
      
      
      // sala personal de chat uno a uno
      socket.join(uid!.toString());
      // this.io.emit('message', 'Bienvenido al servidor');
      // socket.join('room-1');

      // TODO: Validar el JWT 
      // Si el token no es válido, desconectar

      // TODO: Saber que usuario está activo mediante el UID

      // TODO: Emitir todos los usuarios conectados

      // TODO: Socket join, uid

      // TODO: Escuchar cuando el cliente manda un mensaje
      // mensaje-personal

      // TODO: Disconnect
      // Marcar en la BD que el usuario se desconecto
      // TODO: Emitir todos los usuarios conectados
    });
  }


}

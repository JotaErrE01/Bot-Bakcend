import { App, ChatHistory, Cliente, Usuario } from '@prisma/client';
import cron from 'node-cron';
import { Messages } from ".";
import { MetaApi } from "../api";
import { prisma } from '../db/config';
import { Server as SocketServer } from 'socket.io';

export const chatTimeOut = (io: SocketServer, aplication: App, dataMsg: Messages.IGetDataMessage, startDate: Date, client: Cliente, timing: number = 5, asesor?: Usuario) => {
  console.log('🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻🧑‍💻');
  
  // get the current date with javascript
  const createdAt = new Date(startDate);
  console.log(startDate);
  
  const minutes = timing * 60000;
  console.log(minutes);
  // const stopTime = new Date(createdAt.getTime() + (timing * 1000));
  const stopTime = new Date(createdAt.getTime() + minutes);
  const cronString = `${stopTime.getSeconds()} ${stopTime.getMinutes()} ${stopTime.getHours()} ${stopTime.getDate()} ${stopTime.getMonth() + 1} *`;

  const task = cron.getTasks().get(client.id.toString());
  if (task) task.stop();

  console.log({task});
  
  
  const job = cron.schedule(cronString, async () => {
    await sendStopMessage(dataMsg, aplication, client, asesor);
    io.emit('chatTimeOut', { clienteId: client.id });  
    job.stop();
  }, {
    scheduled: true,
    timezone: 'America/Guayaquil',
    name: client.id.toString()
  });
}

const sendStopMessage = async (dataMsg: Messages.IGetDataMessage, aplication: App, client: Cliente, asesor?: Usuario): Promise<boolean> => {
  const { cliente, usuario } = prisma;
  const dataMessage = {
    "messaging_product": "whatsapp",
    "to": `${dataMsg.from}`,
    "type": "text",
    "text": {
      body: 'El tiempo de respuesta ha finalizado. Si desea continuar con la conversación, por favor escriba "Hola"',
    },
  };

  console.log('🛑🛑🛑🛑🛑');
  

  const metaApi = MetaApi.createApi(aplication.token!);

  try {
    const clientDb = await cliente.findUnique({
      where: {
        id: client.id,
      },
    });

    if (!clientDb || clientDb.isDeleted) throw new Error('Cliente no encontrado');
    // if (!client.isChating) throw new Error('El cliente no está chateando');

    await cliente.update({
      where: {
        id: client.id,
      },
      data: {
        chatAsesorId: null,
        ultimoMensajeId: null,
        conversacionId: null,
        isChating: false,
        asociatedDepartmentId: null,
      }
    });

    if(asesor){
      await usuario.update({
        where: {
          id: asesor.id,
        },
        data: {
          quantityChats: {
            decrement: 1,
          }
        }
      });
    }
    // if (chat.asesorId) {
    // }

    const { data } = await metaApi.post(`/${aplication.phoneNumberId}/messages`, dataMessage);

    // TODO: Guardar el mensaje en la base de datos

    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
}